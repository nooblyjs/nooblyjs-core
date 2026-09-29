/**
 * @fileoverview Indexer-compatibility normalization for search providers.
 *
 * Different search providers expose different surfaces. The local engine
 * (`SearchService`, types `default`/`tokens`/`memory`/`files`) natively exposes
 * an "indexer-facing" API — `indexDocument`, `removeDocument`, `loadFromDisk`,
 * `saveToDisk` — and returns search results with the stored source fields spread
 * at the top level. The remote providers (`solr`, `api`) expose only the generic
 * CRUD surface (`add`/`replace`/`remove`/`search`) and return results shaped as
 * `{ id, key, score, obj }`.
 *
 * This module makes every provider present the same indexer-facing contract so
 * that a consumer (e.g. a crawler/indexer) can swap providers by changing only
 * the factory `type`/`options` — no consumer code changes. The normalization is
 * ADDITIVE: it only fills in methods a provider is missing and never overrides a
 * provider that already implements the contract natively, so existing callers
 * that use the generic CRUD surface keep working unchanged.
 *
 * @author NooblyJS Team
 * @version 1.0.0
 * @since 1.0.15
 */

'use strict';

/**
 * Ensure `provider` exposes the indexer-facing contract:
 *   - loadFromDisk(containerName)            → Promise<boolean>
 *   - saveToDisk(containerName)              → Promise<boolean>
 *   - indexDocument(id, content, meta, c)    → Promise<*>  (upsert)
 *   - removeDocument(id, c)                  → Promise<boolean> (+ chunk children)
 *   - search(query, c)                       → results with source fields spread top-level
 *
 * Providers that already implement the contract natively (e.g. `tokens`) are
 * returned untouched.
 *
 * @param {Object} provider The constructed search provider instance.
 * @param {Object} [options] Provider options.
 * @param {string} [options.subDocumentDelimiter='#chunk-'] Delimiter used by
 *   chunking indexers to derive sub-document ids (`<parentId><delimiter><n>`).
 *   removeDocument cleans up these children since external stores can't be
 *   introspected synchronously the way the in-memory token index can.
 * @return {Object} The same provider instance, with any missing methods added.
 */
function applyIndexerCompat(provider, options = {}) {
  if (!provider || typeof provider !== 'object') return provider;

  // A provider that already speaks the indexer contract (tokens) is left as-is.
  const isNative = typeof provider.indexDocument === 'function'
    && typeof provider.loadFromDisk === 'function';
  if (isNative) return provider;

  const chunkDelimiter = options.subDocumentDelimiter || '#chunk-';
  // Safety cap on the sequential chunk-child probe so a pathological id can
  // never spin forever against the backing store.
  const MAX_CHUNK_PROBE = 100000;

  const logInfo = (msg) => {
    if (typeof provider.log === 'function') provider.log('info', msg);
    else if (provider.logger && typeof provider.logger.info === 'function') provider.logger.info(msg);
  };

  // ── Persistence shims ───────────────────────────────────────────────
  // External stores (SOLR, remote API) ARE the persistence layer. Returning
  // false from loadFromDisk signals "no local cache to restore" so the indexer
  // proceeds to (re)crawl source documents; saveToDisk is a successful no-op.
  if (typeof provider.loadFromDisk !== 'function') {
    provider.loadFromDisk = async () => {
      logInfo('loadFromDisk: external store is authoritative, signalling rebuild');
      return false;
    };
  }
  if (typeof provider.saveToDisk !== 'function') {
    provider.saveToDisk = async () => true;
  }

  // ── indexDocument (upsert) ──────────────────────────────────────────
  // Maps the legacy token API onto the generic CRUD surface. The document body
  // carries `content` plus all metadata; `id` is set last so it always wins as
  // the unique key regardless of metadata contents.
  if (typeof provider.indexDocument !== 'function') {
    provider.indexDocument = async (id, content, metadata = {}, containerName) => {
      const doc = { ...metadata, content: content || '', id };
      if (typeof provider.replace === 'function') {
        // replace() upserts by uniqueKey — the clean path for re-indexing.
        return provider.replace(doc, { containerName, idField: 'id' });
      }
      // Fallback for providers without replace(): remove-then-add upsert.
      if (typeof provider.remove === 'function') {
        try { await provider.remove(id, containerName); } catch (_) { /* not present */ }
      }
      return provider.add(id, doc, containerName);
    };
  }

  // ── removeDocument (+ chunk-child cleanup) ──────────────────────────
  // A chunking indexer stores large documents as `<id><delim><n>` sub-docs and
  // never stores the bare `<id>`. The in-memory token index can enumerate and
  // delete those children; an external store cannot be enumerated synchronously,
  // so we probe sequentially from chunk 0 until a delete reports "not found".
  if (typeof provider.removeDocument !== 'function') {
    provider.removeDocument = async (id, containerName) => {
      let removed = false;
      try { removed = await provider.remove(id, containerName); } catch (_) { removed = false; }

      for (let i = 0; i < MAX_CHUNK_PROBE; i++) {
        const childId = `${id}${chunkDelimiter}${i}`;
        let childRemoved = false;
        try { childRemoved = await provider.remove(childId, containerName); } catch (_) { childRemoved = false; }
        if (!childRemoved) break; // chunks are contiguous from 0; stop at first gap
      }
      return removed;
    };
  }

  // ── search result normalization ─────────────────────────────────────
  // Spread the stored source object to the top level so consumers can read
  // fields (path, type, …) directly off each result — matching the `tokens`
  // provider's shape. `obj`, `id`, `key`, `score` are preserved, so callers that
  // read the original `{ id, key, score, obj }` shape keep working.
  if (typeof provider.search === 'function' && !provider.__indexerSearchWrapped) {
    const nativeSearch = provider.search.bind(provider);
    provider.search = async (query, containerOrOptions) => {
      const results = await nativeSearch(query, containerOrOptions);
      if (!Array.isArray(results)) return results;
      return results.map((r) => {
        if (r && typeof r === 'object' && r.obj && typeof r.obj === 'object' && !Array.isArray(r.obj)) {
          return { ...r.obj, ...r };
        }
        return r;
      });
    };
    provider.__indexerSearchWrapped = true;
  }

  return provider;
}

module.exports = { applyIndexerCompat };
