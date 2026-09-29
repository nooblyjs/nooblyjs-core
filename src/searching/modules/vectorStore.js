/**
 * @fileoverview Dense vector index for semantic search.
 *
 * One store per search container. Vectors live in a single packed
 * `Float32Array` of `capacity × dimensions` rather than one array per document:
 * a contiguous buffer keeps the k-nearest-neighbour scan in cache and makes
 * persistence a raw buffer write instead of a JSON encode of several hundred
 * thousand floats.
 *
 * Every vector is expected to arrive L2-normalized (which `EmbeddingClient`
 * guarantees), so cosine similarity is a plain dot product and `knn` needs no
 * per-row division.
 *
 * Search is brute force. That is a deliberate choice, not an omission — at 384
 * dimensions a scan of 100,000 rows is a few tens of milliseconds, which covers
 * the realistic size of an index in this framework. Beyond that the answer is
 * to restrict the scan with the `allow` option (rerank the lexical top-N) or to
 * move to a real vector database behind the `api` provider, not to grow an
 * approximate index here.
 *
 * Chunked documents: a long document is embedded as several chunk rows sharing
 * a `parentId`. `knn` max-pools by parent, so a document returns once at its
 * best-matching passage instead of flooding the results with its own fragments.
 *
 * @author NooblyJS Team
 * @version 1.0.0
 * @since 2026-08-27
 */

'use strict';

/** Bumped when the serialized layout changes in a way older data can't satisfy. */
const STORE_FORMAT_VERSION = '1.0.0';

const DEFAULT_INITIAL_CAPACITY = 128;

/**
 * A growable, brute-force-searchable set of equal-width vectors keyed by
 * document id.
 *
 * @class
 */
class VectorStore {
  /**
   * @param {Object} options Configuration.
   * @param {number} options.dimensions Vector width. Fixed for the lifetime of
   *   the store — mixing widths is meaningless.
   * @param {string} [options.model] Model identifier recorded in the serialized
   *   metadata. Vectors from different models are not comparable, and this is
   *   what lets a loader detect that and discard rather than silently mix.
   * @param {number} [options.capacity=128] Initial row capacity. Grows by
   *   doubling; sizing it near the expected document count avoids re-copies.
   * @throws {Error} If `dimensions` is not a positive integer.
   */
  constructor(options = {}) {
    const dimensions = options.dimensions;
    if (!Number.isInteger(dimensions) || dimensions <= 0) {
      throw new Error('VectorStore requires a positive integer `dimensions`');
    }

    this.dimensions = dimensions;
    this.model = options.model || null;

    this.capacity_ = Math.max(1, options.capacity || DEFAULT_INITIAL_CAPACITY);
    this.data_ = new Float32Array(this.capacity_ * dimensions);

    /** @type {Array<string|null>} row → document id, null when free. */
    this.rowIds_ = new Array(this.capacity_).fill(null);
    /** @type {Array<string|null>} row → parent document id. */
    this.rowParents_ = new Array(this.capacity_).fill(null);
    /** @type {Map<string, number>} document id → row. */
    this.rowIndex_ = new Map();
    /** @type {Map<string, Set<number>>} parent id → its rows. */
    this.parentIndex_ = new Map();
    /** @type {Array<number>} rows vacated by remove(), reused before growing. */
    this.free_ = [];

    this.count_ = 0;
    this.highWater_ = 0;
  }

  /** @return {number} Live vector count. */
  get size() {
    return this.count_;
  }

  /** @return {number} Distinct parent documents represented. */
  get parentCount() {
    return this.parentIndex_.size;
  }

  /**
   * Insert or replace a vector.
   *
   * @param {string} id Vector id. For a chunk, the `<parent>#chunk-<n>` id.
   * @param {Float32Array|Array<number>} vector Unit-length vector.
   * @param {string} [parentId=id] Owning document, for max-pooling and bulk
   *   removal. Chunks pass their parent document's id.
   * @return {boolean} True when a new row was allocated, false on replace.
   * @throws {Error} If the id is empty or the vector width is wrong.
   *
   * @example
   * store.upsert('doc-1', vector);
   * store.upsert('doc-1#chunk-0', chunkVector, 'doc-1');
   */
  upsert(id, vector, parentId = id) {
    if (!id || typeof id !== 'string') {
      throw new Error('VectorStore.upsert requires a non-empty string id');
    }
    if (!vector || vector.length !== this.dimensions) {
      throw new Error(
        `VectorStore.upsert: expected a ${this.dimensions}-dimensional vector, got ${vector?.length}`
      );
    }

    const existing = this.rowIndex_.get(id);
    if (existing !== undefined) {
      this.data_.set(vector, existing * this.dimensions);
      this.reparent_(existing, id, parentId);
      return false;
    }

    const row = this.allocateRow_();
    this.data_.set(vector, row * this.dimensions);
    this.rowIds_[row] = id;
    this.rowIndex_.set(id, row);
    this.rowParents_[row] = parentId;
    this.addToParent_(parentId, row);
    this.count_++;
    return true;
  }

  /**
   * Remove a single vector. Its row is returned to the free list and reused by
   * the next insert, so churn does not grow the buffer.
   *
   * @param {string} id Vector id.
   * @return {boolean} True when a vector was removed.
   */
  remove(id) {
    const row = this.rowIndex_.get(id);
    if (row === undefined) return false;

    this.rowIndex_.delete(id);
    this.removeFromParent_(this.rowParents_[row], row);
    this.rowIds_[row] = null;
    this.rowParents_[row] = null;
    this.free_.push(row);
    this.count_--;
    return true;
  }

  /**
   * Remove a document and every chunk belonging to it.
   *
   * This is why rows carry a parent: an external store has to probe
   * `<id>#chunk-0`, `#chunk-1`, … until one is missing, whereas here the
   * children are simply known.
   *
   * @param {string} parentId Document id.
   * @return {number} Number of vectors removed.
   *
   * @example
   * store.removeDocument('doc-1'); // drops doc-1 and all of its chunks
   */
  removeDocument(parentId) {
    const rows = this.parentIndex_.get(parentId);
    if (!rows) return this.remove(parentId) ? 1 : 0;

    let removed = 0;
    for (const row of Array.from(rows)) {
      const id = this.rowIds_[row];
      if (id != null && this.remove(id)) removed++;
    }
    return removed;
  }

  /**
   * @param {string} id Vector id.
   * @return {boolean} True when the id has a vector.
   */
  has(id) {
    return this.rowIndex_.has(id);
  }

  /**
   * Retrieve a stored vector.
   *
   * @param {string} id Vector id.
   * @return {Float32Array|null} A copy, safe for the caller to mutate.
   */
  get(id) {
    const row = this.rowIndex_.get(id);
    if (row === undefined) return null;
    const offset = row * this.dimensions;
    return this.data_.slice(offset, offset + this.dimensions);
  }

  /**
   * Find the nearest stored documents to a query vector by cosine similarity.
   *
   * Scores are max-pooled per parent, so each document appears once, attributed
   * to its best-matching chunk.
   *
   * @param {Float32Array|Array<number>} queryVector Unit-length query vector.
   * @param {Object} [options] Search options.
   * @param {number} [options.k=10] Maximum documents to return.
   * @param {number} [options.minScore=-Infinity] Discard matches below this
   *   cosine similarity.
   * @param {Set<string>|Array<string>} [options.allow] Restrict the scan to
   *   these parent ids — used to rerank a lexical candidate pool instead of the
   *   whole index.
   * @return {Array<{id: string, chunkId: string, score: number}>} Sorted by
   *   descending score.
   * @throws {Error} If the query vector width does not match the store.
   *
   * @example
   * const hits = store.knn(queryVector, { k: 20, minScore: 0.15 });
   *
   * @example
   * // Rerank only what BM25 already liked
   * const hits = store.knn(queryVector, { k: 10, allow: lexicalIds });
   */
  knn(queryVector, options = {}) {
    if (!queryVector || queryVector.length !== this.dimensions) {
      throw new Error(
        `VectorStore.knn: expected a ${this.dimensions}-dimensional query vector, got ${queryVector?.length}`
      );
    }

    const k = Number.isInteger(options.k) && options.k > 0 ? options.k : 10;
    const minScore = typeof options.minScore === 'number' ? options.minScore : -Infinity;
    const allow = options.allow
      ? (options.allow instanceof Set ? options.allow : new Set(options.allow))
      : null;

    const dimensions = this.dimensions;
    const data = this.data_;
    /** @type {Map<string, {id: string, chunkId: string, score: number}>} */
    const best = new Map();

    for (let row = 0; row < this.highWater_; row++) {
      const chunkId = this.rowIds_[row];
      if (chunkId === null) continue;
      const parentId = this.rowParents_[row];
      if (allow && !allow.has(parentId)) continue;

      let score = 0;
      const offset = row * dimensions;
      for (let d = 0; d < dimensions; d++) score += data[offset + d] * queryVector[d];

      if (score < minScore) continue;
      const current = best.get(parentId);
      if (current === undefined || score > current.score) {
        best.set(parentId, { id: parentId, chunkId, score });
      }
    }

    const results = Array.from(best.values());
    results.sort((a, b) => b.score - a.score);
    return results.length > k ? results.slice(0, k) : results;
  }

  /**
   * Drop every vector, keeping the allocated buffer for reuse.
   *
   * @return {number} Number of vectors dropped.
   */
  clear() {
    const previous = this.count_;
    this.rowIds_.fill(null);
    this.rowParents_.fill(null);
    this.rowIndex_.clear();
    this.parentIndex_.clear();
    this.free_.length = 0;
    this.count_ = 0;
    this.highWater_ = 0;
    return previous;
  }

  /**
   * Repack live rows to the front of the buffer and empty the free list.
   *
   * Only worth calling after heavy deletion: `knn` skips free rows cheaply, but
   * it still walks past them, so a store that was large and is now small scans
   * faster once compacted.
   *
   * @return {number} Number of rows moved.
   */
  compact() {
    if (this.free_.length === 0) return 0;

    let write = 0;
    let moved = 0;
    for (let read = 0; read < this.highWater_; read++) {
      const id = this.rowIds_[read];
      if (id === null) continue;
      if (read !== write) {
        this.data_.copyWithin(
          write * this.dimensions,
          read * this.dimensions,
          (read + 1) * this.dimensions
        );
        const parentId = this.rowParents_[read];
        this.rowIds_[write] = id;
        this.rowParents_[write] = parentId;
        this.rowIndex_.set(id, write);
        this.removeFromParent_(parentId, read);
        this.addToParent_(parentId, write);
        this.rowIds_[read] = null;
        this.rowParents_[read] = null;
        moved++;
      }
      write++;
    }

    this.free_.length = 0;
    this.highWater_ = write;
    return moved;
  }

  /**
   * Summary for the semantic status endpoint and the dashboard.
   *
   * @return {{size: number, parents: number, dimensions: number,
   *   capacity: number, freeRows: number, model: string|null}}
   */
  stats() {
    return {
      size: this.count_,
      parents: this.parentIndex_.size,
      dimensions: this.dimensions,
      capacity: this.capacity_,
      freeRows: this.free_.length,
      model: this.model
    };
  }

  /**
   * Pack the live vectors for persistence.
   *
   * Vectors go out as a raw buffer rather than JSON: JSON-encoding floats
   * roughly triples the size on disk and costs far more to parse back.
   * Non-mutating — free rows are skipped during packing, and the store itself
   * is left as it was.
   *
   * @return {{buffer: Buffer, meta: Object}} `buffer` holds `size × dimensions`
   *   little-endian float32s; `meta` carries the ids, parents and the model the
   *   vectors were produced by.
   *
   * @example
   * const { buffer, meta } = store.serialize();
   * await fs.writeFile('vectors.bin', buffer);
   * await fs.writeFile('vectors.meta.json', JSON.stringify(meta));
   */
  serialize() {
    const packed = new Float32Array(this.count_ * this.dimensions);
    const ids = new Array(this.count_);
    const parents = new Array(this.count_);

    let write = 0;
    for (let row = 0; row < this.highWater_; row++) {
      const id = this.rowIds_[row];
      if (id === null) continue;
      packed.set(
        this.data_.subarray(row * this.dimensions, (row + 1) * this.dimensions),
        write * this.dimensions
      );
      ids[write] = id;
      parents[write] = this.rowParents_[row];
      write++;
    }

    return {
      buffer: Buffer.from(packed.buffer, packed.byteOffset, packed.byteLength),
      meta: {
        version: STORE_FORMAT_VERSION,
        dimensions: this.dimensions,
        model: this.model,
        count: this.count_,
        ids,
        parents
      }
    };
  }

  /**
   * Rebuild a store from `serialize()` output.
   *
   * Returns `null` rather than throwing when the data cannot be trusted — a
   * format change, a dimension change, or (when `expect.model` is supplied) a
   * different embedding model. A `null` return means "re-embed", which is
   * exactly how the search engine's disk loader already treats stale data.
   *
   * @param {{buffer: Buffer|ArrayBuffer|Uint8Array, meta: Object}} serialized
   *   Output of a previous `serialize()`.
   * @param {Object} [expect] Expectations to validate against.
   * @param {number} [expect.dimensions] Required width.
   * @param {string} [expect.model] Required model identifier.
   * @return {VectorStore|null} The restored store, or `null` if unusable.
   *
   * @example
   * const store = VectorStore.deserialize(
   *   { buffer, meta },
   *   { dimensions: 384, model: 'text-embedding-3-small' }
   * );
   * if (!store) await reembedEverything();
   */
  static deserialize(serialized, expect = {}) {
    const meta = serialized?.meta;
    if (!meta || meta.version !== STORE_FORMAT_VERSION) return null;
    if (!Number.isInteger(meta.dimensions) || meta.dimensions <= 0) return null;
    if (expect.dimensions != null && meta.dimensions !== expect.dimensions) return null;
    if (expect.model != null && meta.model !== expect.model) return null;
    if (!Array.isArray(meta.ids) || !Array.isArray(meta.parents)) return null;
    if (meta.ids.length !== meta.count || meta.parents.length !== meta.count) return null;

    const source = serialized.buffer;
    if (!source) return null;

    const expectedFloats = meta.count * meta.dimensions;
    const expectedBytes = expectedFloats * Float32Array.BYTES_PER_ELEMENT;

    let bytes;
    try {
      bytes = source instanceof Uint8Array ? source : new Uint8Array(source);
    } catch (_) {
      return null; // not a buffer-like value
    }
    if (bytes.byteLength < expectedBytes) return null; // truncated

    // A Buffer read back from disk is a view into Node's shared pool and can
    // start at any byte offset. Float32Array demands 4-byte alignment, so copy
    // rather than fail when the offset happens to be odd.
    let values;
    if (bytes.byteOffset % Float32Array.BYTES_PER_ELEMENT === 0) {
      values = new Float32Array(bytes.buffer, bytes.byteOffset, expectedFloats);
    } else {
      const aligned = new Uint8Array(expectedBytes);
      aligned.set(bytes.subarray(0, expectedBytes));
      values = new Float32Array(aligned.buffer);
    }

    const store = new VectorStore({
      dimensions: meta.dimensions,
      model: meta.model,
      capacity: Math.max(meta.count, DEFAULT_INITIAL_CAPACITY)
    });

    for (let i = 0; i < meta.count; i++) {
      store.upsert(
        meta.ids[i],
        values.subarray(i * meta.dimensions, (i + 1) * meta.dimensions),
        meta.parents[i] ?? meta.ids[i]
      );
    }
    return store;
  }

  // ─── Row allocation ──────────────────────────────────────────────

  /**
   * Claim a row, reusing a freed one before extending the buffer.
   *
   * @return {number} Row index.
   * @private
   */
  allocateRow_() {
    if (this.free_.length > 0) return this.free_.pop();
    if (this.highWater_ >= this.capacity_) this.grow_();
    return this.highWater_++;
  }

  /**
   * Double the buffer, copying existing rows across.
   *
   * @private
   */
  grow_() {
    const capacity = this.capacity_ * 2;
    const data = new Float32Array(capacity * this.dimensions);
    data.set(this.data_);
    this.data_ = data;
    this.rowIds_.length = capacity;
    this.rowParents_.length = capacity;
    this.rowIds_.fill(null, this.capacity_);
    this.rowParents_.fill(null, this.capacity_);
    this.capacity_ = capacity;
  }

  // ─── Parent bookkeeping ──────────────────────────────────────────

  /**
   * @param {string} parentId
   * @param {number} row
   * @private
   */
  addToParent_(parentId, row) {
    let rows = this.parentIndex_.get(parentId);
    if (!rows) { rows = new Set(); this.parentIndex_.set(parentId, rows); }
    rows.add(row);
  }

  /**
   * @param {string} parentId
   * @param {number} row
   * @private
   */
  removeFromParent_(parentId, row) {
    const rows = this.parentIndex_.get(parentId);
    if (!rows) return;
    rows.delete(row);
    if (rows.size === 0) this.parentIndex_.delete(parentId);
  }

  /**
   * Move an existing row to a different parent, if it changed.
   *
   * @param {number} row
   * @param {string} id
   * @param {string} parentId
   * @private
   */
  reparent_(row, id, parentId) {
    const previous = this.rowParents_[row];
    if (previous === parentId) return;
    this.removeFromParent_(previous, row);
    this.rowParents_[row] = parentId;
    this.addToParent_(parentId, row);
  }
}

module.exports = { VectorStore, STORE_FORMAT_VERSION };
