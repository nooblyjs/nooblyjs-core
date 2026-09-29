/**
 * @fileoverview Encrypted file settings provider.
 * Stores grouped key/value settings in a single JSON file that is encrypted at
 * rest with AES-256-GCM. The encryption key is derived from a master secret
 * using scrypt with a per-file random salt, and every write uses a fresh IV.
 *
 * The decrypted document is a plain key/value structure organised into named
 * groups, so a UI can render one panel per group:
 *
 *   {
 *     "database": { "host": "localhost", "port": 5432 },
 *     "smtp":     { "user": "mailer", "password": "s3cret" }
 *   }
 *
 * @author NooblyJS Team
 * @version 1.0.0
 * @since 1.0.0
 */

'use strict';

const fs = require('node:fs').promises;
const path = require('node:path');
const crypto = require('node:crypto');

/** @const {string} Envelope format identifier written to disk. */
const FILE_FORMAT = 'nooblyjs-settings';

/** @const {number} Current on-disk envelope version. */
const FILE_VERSION = 1;

/** @const {string} Cipher used for the settings payload. */
const CIPHER = 'aes-256-gcm';

/** @const {string} Group used when a caller does not supply one. */
const DEFAULT_GROUP = 'default';

/** @const {string} Placeholder returned in place of a secret value. */
const MASK = '********';

/** @const {!RegExp} Allowed characters for group names. */
const GROUP_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 ._-]{0,63}$/;

/** @const {!RegExp} Allowed characters for setting keys. */
const KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

/** @const {!Object} scrypt parameters used for key derivation. */
const KDF_PARAMS = { name: 'scrypt', keyLength: 32, N: 16384, r: 8, p: 1 };

/**
 * Encrypted file backed settings store with group support.
 *
 * Settings are held in memory once loaded and persisted back to disk on every
 * mutation (unless `autosave` is turned off), so reads are cheap and the file
 * on disk is never left in a partially written state.
 *
 * @class
 */
class SettingsService {
  /**
   * Initializes the settings provider.
   *
   * @param {Object=} options Provider configuration.
   * @param {string=} options.filepath Path of the encrypted settings file.
   * @param {string=} options.secret Master secret used to derive the encryption
   *     key. Falls back to `process.env.SETTINGS_SECRET`, then
   *     `process.env.SESSION_SECRET`, then a development-only default.
   * @param {boolean=} options.autosave Persist to disk on every mutation
   *     (defaults to true).
   * @param {boolean=} options.maskSecrets Mask values flagged as secret when
   *     reading through the bulk accessors (defaults to true).
   * @param {string=} options.instanceName Name of this service instance.
   * @param {EventEmitter=} eventEmitter Emitter for settings lifecycle events.
   */
  constructor(options = {}, eventEmitter) {
    this.settings = {};
    this.settings.description =
        'The following settings are needed for this provider';
    this.settings.list = [
      {
        setting: 'filepath',
        type: 'string',
        description: 'Path of the encrypted settings file',
        values: ['./.application/settings/settings.enc.json'],
      },
      {
        setting: 'autosave',
        type: 'options',
        description: 'Write the encrypted file on every change',
        values: ['true', 'false'],
      },
      {
        setting: 'maskSecrets',
        type: 'options',
        description: 'Mask values flagged as secret when listing settings',
        values: ['true', 'false'],
      },
    ];

    this.settings.filepath =
        options.filepath || './.application/settings/settings.enc.json';
    this.settings.autosave = options.autosave === false ? 'false' : 'true';
    this.settings.maskSecrets = options.maskSecrets === false ? 'false' : 'true';
    this.settings.algorithm = CIPHER;

    this.eventEmitter_ = eventEmitter;
    this.instanceName_ = options.instanceName || 'default';

    // The master secret is deliberately kept off `this.settings` so it can
    // never leak through the settings API used by the admin screen.
    this.secret_ = this.resolveSecret_(options);

    /** @private {?Object} Decrypted document, null until loaded. */
    this.store_ = null;
    /** @private {?Buffer} Salt of the currently loaded file. */
    this.salt_ = null;
    /** @private {?Buffer} Cached key derived from secret_ and salt_. */
    this.key_ = null;
    /** @private {?Promise} In-flight load, so concurrent callers share it. */
    this.loading_ = null;
    /** @private {!Promise} Serialises writes to the settings file. */
    this.writeQueue_ = Promise.resolve();
  }

  /**
   * Resolves the master secret from options or the environment.
   *
   * @param {!Object} options Provider options.
   * @return {string} The master secret.
   * @private
   */
  resolveSecret_(options) {
    const secret = options.secret
        || process.env.SETTINGS_SECRET
        || process.env.SESSION_SECRET;

    if (secret) return secret;

    this.usingFallbackSecret_ = true;
    return 'nooblyjs-core-settings-secret-change-me';
  }

  // ---------------------------------------------------------------------------
  // Provider configuration (framework convention)
  // ---------------------------------------------------------------------------

  /**
   * Gets the provider configuration used by the service settings screen.
   *
   * @return {Promise<Object>} The provider settings descriptor.
   */
  async getSettings() {
    return this.settings;
  }

  /**
   * Updates the provider configuration.
   * Changing the file path drops the in-memory document so the new file is
   * loaded on the next access.
   *
   * @param {!Object} settings Map of setting name to new value.
   * @return {Promise<void>} Resolves when the configuration is applied.
   */
  async saveSettings(settings) {
    for (let i = 0; i < this.settings.list.length; i++) {
      const name = this.settings.list[i].setting;
      if (settings[name] != null) {
        const previous = this.settings[name];
        this.settings[name] = settings[name];

        if (name === 'filepath' && previous !== settings[name]) {
          this.store_ = null;
          this.salt_ = null;
          this.key_ = null;
          this.loading_ = null;
        }

        this.emit_('settings:setting-changed', {
          setting: name,
          value: settings[name],
        });
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Encryption
  // ---------------------------------------------------------------------------

  /**
   * Derives the AES key for the given salt, caching the result.
   *
   * @param {!Buffer} salt Key derivation salt.
   * @param {!Object=} params scrypt parameters from the file envelope.
   * @return {!Buffer} A 32 byte key.
   * @private
   */
  deriveKey_(salt, params = KDF_PARAMS) {
    if (this.key_ && this.salt_ && salt.equals(this.salt_)) {
      return this.key_;
    }

    const key = crypto.scryptSync(this.secret_, salt, params.keyLength, {
      N: params.N,
      r: params.r,
      p: params.p,
      // scrypt with N=16384/r=8 needs more than the default 32MB budget.
      maxmem: 64 * 1024 * 1024,
    });

    this.salt_ = salt;
    this.key_ = key;
    return key;
  }

  /**
   * Encrypts the decrypted document into an on-disk envelope.
   *
   * @param {!Object} document The plaintext settings document.
   * @return {!Object} The envelope to serialise to disk.
   * @private
   */
  encrypt_(document) {
    const salt = this.salt_ || crypto.randomBytes(16);
    const key = this.deriveKey_(salt);
    const iv = crypto.randomBytes(12);

    const cipher = crypto.createCipheriv(CIPHER, key, iv);
    const payload = Buffer.concat([
      cipher.update(JSON.stringify(document), 'utf8'),
      cipher.final(),
    ]);

    return {
      format: FILE_FORMAT,
      version: FILE_VERSION,
      algorithm: CIPHER,
      kdf: { ...KDF_PARAMS, salt: salt.toString('hex') },
      iv: iv.toString('hex'),
      authTag: cipher.getAuthTag().toString('hex'),
      updated: new Date().toISOString(),
      payload: payload.toString('base64'),
    };
  }

  /**
   * Decrypts an on-disk envelope back into the settings document.
   *
   * @param {!Object} envelope Parsed contents of the settings file.
   * @return {!Object} The plaintext settings document.
   * @throws {Error} When the envelope is malformed or the secret is wrong.
   * @private
   */
  decrypt_(envelope) {
    if (!envelope || envelope.format !== FILE_FORMAT) {
      throw new Error('Settings file is not a recognised settings envelope');
    }
    if (envelope.algorithm !== CIPHER) {
      throw new Error(`Unsupported settings cipher: ${envelope.algorithm}`);
    }

    const salt = Buffer.from(envelope.kdf.salt, 'hex');
    const key = this.deriveKey_(salt, { ...KDF_PARAMS, ...envelope.kdf });

    const decipher = crypto.createDecipheriv(
        CIPHER, key, Buffer.from(envelope.iv, 'hex'));
    decipher.setAuthTag(Buffer.from(envelope.authTag, 'hex'));

    try {
      const plain = Buffer.concat([
        decipher.update(Buffer.from(envelope.payload, 'base64')),
        decipher.final(),
      ]);
      return JSON.parse(plain.toString('utf8'));
    } catch (error) {
      throw new Error(
          'Unable to decrypt settings file - the master secret is incorrect '
          + 'or the file has been tampered with');
    }
  }

  // ---------------------------------------------------------------------------
  // Persistence
  // ---------------------------------------------------------------------------

  /**
   * Creates an empty settings document.
   *
   * @return {!Object} A new document with a single default group.
   * @private
   */
  emptyDocument_() {
    return {
      version: FILE_VERSION,
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      groups: {
        [DEFAULT_GROUP]: {
          description: 'Ungrouped settings',
          values: {},
          meta: {},
        },
      },
    };
  }

  /**
   * Loads and decrypts the settings file, creating it when absent.
   * Concurrent callers share a single load.
   *
   * @return {Promise<!Object>} The decrypted settings document.
   * @private
   */
  async load_() {
    if (this.store_) return this.store_;
    if (this.loading_) return this.loading_;

    this.loading_ = (async () => {
      const filepath = path.resolve(this.settings.filepath);
      try {
        const raw = await fs.readFile(filepath, 'utf8');
        this.store_ = this.decrypt_(JSON.parse(raw));
        this.emit_('settings:loaded', {
          filepath,
          groups: Object.keys(this.store_.groups).length,
        });
      } catch (error) {
        if (error.code !== 'ENOENT') {
          this.emit_('settings:error', { operation: 'load', error: error.message });
          throw error;
        }
        this.store_ = this.emptyDocument_();
        await this.persist_();
        this.emit_('settings:created', { filepath });
      }
      return this.store_;
    })();

    try {
      return await this.loading_;
    } finally {
      this.loading_ = null;
    }
  }

  /**
   * Encrypts and writes the current document to disk.
   * Writes go to a temporary file first and are then renamed, so a crash mid
   * write cannot destroy the existing settings.
   *
   * @return {Promise<void>} Resolves once the file is on disk.
   * @private
   */
  async persist_() {
    const filepath = path.resolve(this.settings.filepath);
    const document = this.store_;

    this.writeQueue_ = this.writeQueue_.then(async () => {
      document.updated = new Date().toISOString();
      const envelope = this.encrypt_(document);
      const tempPath = `${filepath}.${process.pid}.tmp`;

      await fs.mkdir(path.dirname(filepath), { recursive: true });
      await fs.writeFile(tempPath, JSON.stringify(envelope, null, 2), {
        encoding: 'utf8',
        mode: 0o600,
      });
      await fs.rename(tempPath, filepath);
    }, () => {});

    await this.writeQueue_;
  }

  /**
   * Persists the document when autosave is enabled.
   *
   * @return {Promise<void>} Resolves when the write completes or is skipped.
   * @private
   */
  async autosave_() {
    if (this.settings.autosave !== 'false') {
      await this.persist_();
    }
  }

  /**
   * Forces the in-memory settings to be written to disk.
   * Useful when autosave has been disabled.
   *
   * @return {Promise<void>} Resolves once the file is written.
   */
  async save() {
    await this.load_();
    await this.persist_();
  }

  /**
   * Discards the in-memory document so the next read decrypts the file again.
   *
   * @return {Promise<!Object>} The freshly loaded document.
   */
  async reload() {
    this.store_ = null;
    this.loading_ = null;
    return this.load_();
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /**
   * Emits an event when an emitter was supplied.
   *
   * @param {string} name Event name.
   * @param {!Object} payload Event payload.
   * @private
   */
  emit_(name, payload) {
    if (this.eventEmitter_) {
      this.eventEmitter_.emit(name, { instance: this.instanceName_, ...payload });
    }
  }

  /**
   * Splits a `group.key` reference into its parts.
   * When an explicit group is supplied the key is used verbatim.
   *
   * @param {string} key The setting key, optionally `group.key`.
   * @param {string=} group Explicit group name.
   * @return {{group: string, key: string}} The resolved reference.
   * @private
   */
  resolveRef_(key, group) {
    if (typeof key !== 'string' || key.trim() === '') {
      throw new Error('Invalid key: must be a non-empty string');
    }

    if (group == null && key.includes('.')) {
      const index = key.indexOf('.');
      return {
        group: key.slice(0, index),
        key: key.slice(index + 1),
      };
    }

    return { group: group || DEFAULT_GROUP, key };
  }

  /**
   * Validates a group name.
   *
   * @param {string} group The group name.
   * @throws {Error} When the name is not usable.
   * @private
   */
  validateGroup_(group) {
    if (!GROUP_PATTERN.test(group || '')) {
      throw new Error(
          `Invalid group name '${group}': use 1-64 letters, digits, spaces, `
          + 'dots, dashes or underscores');
    }
  }

  /**
   * Validates a setting key.
   *
   * @param {string} key The setting key.
   * @throws {Error} When the key is not usable.
   * @private
   */
  validateKey_(key) {
    if (!KEY_PATTERN.test(key || '')) {
      throw new Error(
          `Invalid setting key '${key}': use 1-128 letters, digits, dots, `
          + 'dashes or underscores');
    }
  }

  /**
   * Returns a group, throwing when it does not exist.
   *
   * @param {!Object} document The settings document.
   * @param {string} group Group name.
   * @return {!Object} The group record.
   * @throws {Error} When the group is unknown.
   * @private
   */
  requireGroup_(document, group) {
    const record = document.groups[group];
    if (!record) {
      throw new Error(`Unknown settings group: ${group}`);
    }
    return record;
  }

  /**
   * Applies secret masking to a group's values.
   *
   * @param {!Object} record The group record.
   * @param {boolean} reveal Whether secret values should be returned in clear.
   * @return {!Object} A key/value map for the group.
   * @private
   */
  readGroupValues_(record, reveal) {
    const mask = !reveal && this.settings.maskSecrets !== 'false';
    const values = {};

    for (const [key, value] of Object.entries(record.values)) {
      values[key] = mask && record.meta[key]?.secret ? MASK : value;
    }

    return values;
  }

  // ---------------------------------------------------------------------------
  // Values
  // ---------------------------------------------------------------------------

  /**
   * Reads a single setting value.
   *
   * @param {string} key Setting key, or `group.key` when group is omitted.
   * @param {string=} group Group to read from (defaults to 'default').
   * @return {Promise<*>} The stored value, or undefined when not present.
   *
   * @example
   * const host = await settings.get('host', 'database');
   *
   * @example
   * const host = await settings.get('database.host');
   */
  async get(key, group) {
    const ref = this.resolveRef_(key, group);
    const document = await this.load_();
    const record = document.groups[ref.group];

    if (!record || !(ref.key in record.values)) {
      this.emit_('settings:miss', { group: ref.group, key: ref.key });
      return undefined;
    }

    this.emit_('settings:get', { group: ref.group, key: ref.key });
    return record.values[ref.key];
  }

  /**
   * Checks whether a setting exists.
   *
   * @param {string} key Setting key, or `group.key` when group is omitted.
   * @param {string=} group Group to check (defaults to 'default').
   * @return {Promise<boolean>} True when the setting is present.
   */
  async has(key, group) {
    const ref = this.resolveRef_(key, group);
    const document = await this.load_();
    return Boolean(document.groups[ref.group]
        && ref.key in document.groups[ref.group].values);
  }

  /**
   * Creates or updates a setting.
   * The group is created automatically when it does not yet exist.
   *
   * @param {string} key Setting key, or `group.key` when group is omitted.
   * @param {*} value Any JSON serialisable value.
   * @param {string=} group Group to write to (defaults to 'default').
   * @param {Object=} meta Optional metadata for the key.
   * @param {boolean=} meta.secret Mask this value when listing settings.
   * @param {string=} meta.description Human readable description.
   * @param {string=} meta.type Hint used by the admin screen ('string',
   *     'number', 'boolean', 'json').
   * @return {Promise<*>} The stored value.
   * @throws {Error} When the key, group or value is not usable.
   *
   * @example
   * await settings.set('password', 'hunter2', 'smtp', { secret: true });
   */
  async set(key, value, group, meta = {}) {
    const ref = this.resolveRef_(key, group);
    this.validateGroup_(ref.group);
    this.validateKey_(ref.key);

    if (value === undefined) {
      throw new Error('Invalid value: cannot be undefined');
    }
    if (typeof value === 'function' || typeof value === 'bigint') {
      throw new Error(`Invalid value: ${typeof value} cannot be stored`);
    }

    const document = await this.load_();
    if (!document.groups[ref.group]) {
      await this.createGroup(ref.group);
    }

    const record = document.groups[ref.group];
    const existed = ref.key in record.values;
    const previousMeta = record.meta[ref.key] || {};

    record.values[ref.key] = value;
    record.meta[ref.key] = {
      ...previousMeta,
      ...meta,
      secret: meta.secret != null ? Boolean(meta.secret)
          : Boolean(previousMeta.secret),
      updated: new Date().toISOString(),
    };

    await this.autosave_();

    this.emit_(existed ? 'settings:updated' : 'settings:created-key', {
      group: ref.group,
      key: ref.key,
      secret: record.meta[ref.key].secret,
    });

    return value;
  }

  /**
   * Removes a setting.
   *
   * @param {string} key Setting key, or `group.key` when group is omitted.
   * @param {string=} group Group to delete from (defaults to 'default').
   * @return {Promise<boolean>} True when a setting was removed.
   */
  async delete(key, group) {
    const ref = this.resolveRef_(key, group);
    const document = await this.load_();
    const record = document.groups[ref.group];

    if (!record || !(ref.key in record.values)) {
      return false;
    }

    delete record.values[ref.key];
    delete record.meta[ref.key];
    await this.autosave_();

    this.emit_('settings:deleted', { group: ref.group, key: ref.key });
    return true;
  }

  /**
   * Returns the metadata recorded for a setting.
   *
   * @param {string} key Setting key, or `group.key` when group is omitted.
   * @param {string=} group Group to read from (defaults to 'default').
   * @return {Promise<?Object>} The metadata, or null when unknown.
   */
  async getMeta(key, group) {
    const ref = this.resolveRef_(key, group);
    const document = await this.load_();
    return document.groups[ref.group]?.meta[ref.key] || null;
  }

  // ---------------------------------------------------------------------------
  // Groups
  // ---------------------------------------------------------------------------

  /**
   * Creates a settings group.
   *
   * @param {string} group Name of the group.
   * @param {string=} description Description shown in the admin screen.
   * @return {Promise<!Object>} Summary of the created group.
   * @throws {Error} When the group name is invalid or already taken.
   */
  async createGroup(group, description = '') {
    this.validateGroup_(group);
    const document = await this.load_();

    if (document.groups[group]) {
      throw new Error(`Settings group already exists: ${group}`);
    }

    document.groups[group] = {
      description,
      values: {},
      meta: {},
      created: new Date().toISOString(),
    };

    await this.autosave_();
    this.emit_('settings:group-created', { group });

    return { name: group, description, count: 0 };
  }

  /**
   * Updates a group's description.
   *
   * @param {string} group Name of the group.
   * @param {string} description New description.
   * @return {Promise<!Object>} Summary of the updated group.
   * @throws {Error} When the group does not exist.
   */
  async updateGroup(group, description) {
    const document = await this.load_();
    const record = this.requireGroup_(document, group);

    record.description = description || '';
    await this.autosave_();
    this.emit_('settings:group-updated', { group });

    return {
      name: group,
      description: record.description,
      count: Object.keys(record.values).length,
    };
  }

  /**
   * Deletes a group and every setting it contains.
   * The default group is cleared rather than removed.
   *
   * @param {string} group Name of the group.
   * @return {Promise<boolean>} True when a group was removed or cleared.
   */
  async deleteGroup(group) {
    const document = await this.load_();

    if (!document.groups[group]) {
      return false;
    }

    if (group === DEFAULT_GROUP) {
      document.groups[group].values = {};
      document.groups[group].meta = {};
    } else {
      delete document.groups[group];
    }

    await this.autosave_();
    this.emit_('settings:group-deleted', { group });
    return true;
  }

  /**
   * Lists all groups with a summary of their contents.
   *
   * @return {Promise<Array<{name: string, description: string, count: number,
   *     secrets: number}>>} One entry per group.
   */
  async listGroups() {
    const document = await this.load_();

    return Object.entries(document.groups).map(([name, record]) => ({
      name,
      description: record.description || '',
      count: Object.keys(record.values).length,
      secrets: Object.values(record.meta).filter((m) => m.secret).length,
      created: record.created || document.created,
    }));
  }

  /**
   * Reads every setting in a group as a plain key/value object.
   *
   * @param {string=} group Group to read (defaults to 'default').
   * @param {Object=} options Read options.
   * @param {boolean=} options.reveal Return secret values in clear text.
   * @return {Promise<!Object>} Key/value map for the group.
   * @throws {Error} When the group does not exist.
   *
   * @example
   * const db = await settings.getGroup('database');
   * connect(db.host, db.port);
   */
  async getGroup(group = DEFAULT_GROUP, options = {}) {
    const document = await this.load_();
    const record = this.requireGroup_(document, group);
    return this.readGroupValues_(record, options.reveal === true);
  }

  /**
   * Reads a group including per-key metadata, for rendering the admin screen.
   *
   * @param {string=} group Group to read (defaults to 'default').
   * @param {Object=} options Read options.
   * @param {boolean=} options.reveal Return secret values in clear text.
   * @return {Promise<!Object>} Group name, description and detailed entries.
   * @throws {Error} When the group does not exist.
   */
  async getGroupDetail(group = DEFAULT_GROUP, options = {}) {
    const document = await this.load_();
    const record = this.requireGroup_(document, group);
    const values = this.readGroupValues_(record, options.reveal === true);

    return {
      name: group,
      description: record.description || '',
      entries: Object.keys(record.values).map((key) => ({
        key,
        value: values[key],
        secret: Boolean(record.meta[key]?.secret),
        description: record.meta[key]?.description || '',
        type: record.meta[key]?.type || typeof record.values[key],
        updated: record.meta[key]?.updated || null,
      })),
    };
  }

  // ---------------------------------------------------------------------------
  // Bulk operations
  // ---------------------------------------------------------------------------

  /**
   * Reads every group as a nested key/value object.
   *
   * @param {Object=} options Read options.
   * @param {boolean=} options.reveal Return secret values in clear text.
   * @return {Promise<!Object<string, !Object>>} Map of group name to key/values.
   *
   * @example
   * const all = await settings.getAll();
   * // { database: { host: 'localhost' }, smtp: { password: '********' } }
   */
  async getAll(options = {}) {
    const document = await this.load_();
    const result = {};

    for (const [name, record] of Object.entries(document.groups)) {
      result[name] = this.readGroupValues_(record, options.reveal === true);
    }

    return result;
  }

  /**
   * Merges a nested `{group: {key: value}}` object into the store.
   * Existing keys are overwritten, groups that are not mentioned are untouched.
   *
   * @param {!Object<string, !Object>} groups Settings to import.
   * @param {Object=} options Import options.
   * @param {boolean=} options.replace Empty the store before importing.
   * @return {Promise<{groups: number, keys: number}>} Import counts.
   * @throws {Error} When the payload is not a nested object.
   */
  async import(groups, options = {}) {
    if (!groups || typeof groups !== 'object' || Array.isArray(groups)) {
      throw new Error('Invalid import payload: expected an object of groups');
    }

    const document = await this.load_();

    if (options.replace) {
      document.groups = this.emptyDocument_().groups;
    }

    let keyCount = 0;
    const previousAutosave = this.settings.autosave;
    this.settings.autosave = 'false';

    try {
      for (const [group, values] of Object.entries(groups)) {
        if (!values || typeof values !== 'object' || Array.isArray(values)) {
          throw new Error(`Invalid import payload for group '${group}'`);
        }

        this.validateGroup_(group);
        if (!document.groups[group]) {
          await this.createGroup(group);
        }

        for (const [key, value] of Object.entries(values)) {
          await this.set(key, value, group);
          keyCount++;
        }
      }
    } finally {
      this.settings.autosave = previousAutosave;
    }

    await this.autosave_();
    this.emit_('settings:imported', {
      groups: Object.keys(groups).length,
      keys: keyCount,
    });

    return { groups: Object.keys(groups).length, keys: keyCount };
  }

  /**
   * Re-encrypts the settings file under a new master secret.
   * A fresh salt and key are generated, so the previous secret can no longer
   * decrypt the file once this resolves.
   *
   * @param {string} newSecret The new master secret.
   * @return {Promise<void>} Resolves once the file has been rewritten.
   * @throws {Error} When the new secret is empty.
   */
  async rotateSecret(newSecret) {
    if (typeof newSecret !== 'string' || newSecret.trim() === '') {
      throw new Error('Invalid secret: must be a non-empty string');
    }

    await this.load_();

    this.secret_ = newSecret;
    this.usingFallbackSecret_ = false;
    this.salt_ = null;
    this.key_ = null;

    await this.persist_();
    this.emit_('settings:secret-rotated', {});
  }

  /**
   * Returns counts and file information for the service dashboard.
   *
   * @return {Promise<!Object>} Statistics describing the settings store.
   */
  async getStatistics() {
    const document = await this.load_();
    const filepath = path.resolve(this.settings.filepath);

    let groupCount = 0;
    let keyCount = 0;
    let secretCount = 0;

    for (const record of Object.values(document.groups)) {
      groupCount++;
      keyCount += Object.keys(record.values).length;
      secretCount += Object.values(record.meta).filter((m) => m.secret).length;
    }

    let fileSize = 0;
    try {
      fileSize = (await fs.stat(filepath)).size;
    } catch (error) {
      fileSize = 0;
    }

    return {
      groups: groupCount,
      keys: keyCount,
      secrets: secretCount,
      encrypted: true,
      algorithm: CIPHER,
      filepath,
      fileSize,
      updated: document.updated,
      created: document.created,
      usingFallbackSecret: Boolean(this.usingFallbackSecret_),
    };
  }
}

module.exports = SettingsService;
