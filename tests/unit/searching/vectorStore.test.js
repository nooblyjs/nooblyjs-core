/**
 * @fileoverview Unit tests for the dense vector store.
 *
 * The correctness bar for `knn` is set by a naive reference implementation
 * written inline: the packed-buffer, free-list and max-pooling machinery exists
 * for speed and memory, and must produce exactly what the obvious slow version
 * would.
 *
 * @author NooblyJS Team
 * @version 1.0.0
 * @since 2026-08-27
 */

'use strict';

const { VectorStore, STORE_FORMAT_VERSION } =
  require('../../../src/searching/modules/vectorStore');
const { hashEmbed } = require('../../../src/searching/modules/embeddings');

/** Deterministic unit vector for a label, at the given width. */
const vec = (label, dimensions = 16) => hashEmbed(label, dimensions);

/** Explicit unit vector along one axis — makes expected scores obvious. */
const axis = (index, dimensions = 4) => {
  const v = new Float32Array(dimensions);
  v[index] = 1;
  return v;
};

/**
 * The obvious slow implementation of `knn`, used as the oracle: score every
 * entry, keep each parent's best, sort, slice.
 */
const naiveKnn = (entries, query, k) => {
  const best = new Map();
  for (const { id, parentId, vector } of entries) {
    let score = 0;
    for (let i = 0; i < vector.length; i++) score += vector[i] * query[i];
    const current = best.get(parentId);
    if (!current || score > current.score) best.set(parentId, { id: parentId, chunkId: id, score });
  }
  return Array.from(best.values()).sort((a, b) => b.score - a.score).slice(0, k);
};

describe('VectorStore — construction', () => {
  it('requires a positive integer dimensions', () => {
    expect(() => new VectorStore({})).toThrow(/positive integer/);
    expect(() => new VectorStore({ dimensions: 0 })).toThrow(/positive integer/);
    expect(() => new VectorStore({ dimensions: 1.5 })).toThrow(/positive integer/);
    expect(() => new VectorStore({ dimensions: -8 })).toThrow(/positive integer/);
  });

  it('starts empty', () => {
    const store = new VectorStore({ dimensions: 8 });
    expect(store.size).toBe(0);
    expect(store.parentCount).toBe(0);
    expect(store.dimensions).toBe(8);
  });
});

describe('VectorStore — upsert and remove', () => {
  let store;
  beforeEach(() => { store = new VectorStore({ dimensions: 16 }); });

  it('adds vectors and reports size', () => {
    expect(store.upsert('a', vec('alpha'))).toBe(true);
    expect(store.upsert('b', vec('beta'))).toBe(true);
    expect(store.size).toBe(2);
  });

  it('replaces in place without allocating a new row', () => {
    store.upsert('a', vec('alpha'));
    expect(store.upsert('a', vec('rewritten'))).toBe(false);
    expect(store.size).toBe(1);
    expect(Array.from(store.get('a'))).toEqual(Array.from(vec('rewritten')));
  });

  it('rejects a vector of the wrong width', () => {
    expect(() => store.upsert('a', new Float32Array(4))).toThrow(/16-dimensional/);
  });

  it('rejects an empty id', () => {
    expect(() => store.upsert('', vec('alpha'))).toThrow(/non-empty string id/);
    expect(() => store.upsert(null, vec('alpha'))).toThrow(/non-empty string id/);
  });

  it('reports membership and returns a defensive copy', () => {
    store.upsert('a', vec('alpha'));
    expect(store.has('a')).toBe(true);
    expect(store.has('nope')).toBe(false);
    expect(store.get('nope')).toBeNull();

    const copy = store.get('a');
    copy[0] = 999;
    expect(store.get('a')[0]).not.toBe(999);
  });

  it('removes a vector and reports whether it was there', () => {
    store.upsert('a', vec('alpha'));
    expect(store.remove('a')).toBe(true);
    expect(store.remove('a')).toBe(false);
    expect(store.size).toBe(0);
    expect(store.has('a')).toBe(false);
  });

  it('reuses a freed row instead of growing the buffer', () => {
    const small = new VectorStore({ dimensions: 4, capacity: 4 });
    for (const id of ['a', 'b', 'c', 'd']) small.upsert(id, axis(0));
    expect(small.stats().capacity).toBe(4);

    small.remove('b');
    small.remove('c');
    small.upsert('e', axis(1));
    small.upsert('f', axis(2));

    expect(small.size).toBe(4);
    expect(small.stats().capacity).toBe(4); // no growth: the freed rows were reused
    expect(small.stats().freeRows).toBe(0);
  });

  it('grows past its initial capacity', () => {
    const small = new VectorStore({ dimensions: 4, capacity: 2 });
    for (let i = 0; i < 9; i++) small.upsert(`doc-${i}`, axis(i % 4));

    expect(small.size).toBe(9);
    expect(small.stats().capacity).toBeGreaterThanOrEqual(9);
    for (let i = 0; i < 9; i++) expect(small.has(`doc-${i}`)).toBe(true);
  });

  it('clears everything but keeps the buffer for reuse', () => {
    store.upsert('a', vec('alpha'));
    store.upsert('b', vec('beta'));

    expect(store.clear()).toBe(2);
    expect(store.size).toBe(0);
    expect(store.parentCount).toBe(0);
    expect(store.has('a')).toBe(false);

    store.upsert('c', vec('gamma'));
    expect(store.size).toBe(1);
  });
});

describe('VectorStore — chunked documents', () => {
  let store;
  beforeEach(() => { store = new VectorStore({ dimensions: 16 }); });

  it('removes a document and all of its chunks in one call', () => {
    store.upsert('doc-1#chunk-0', vec('one'), 'doc-1');
    store.upsert('doc-1#chunk-1', vec('two'), 'doc-1');
    store.upsert('doc-1#chunk-2', vec('three'), 'doc-1');
    store.upsert('doc-2', vec('other'), 'doc-2');

    expect(store.removeDocument('doc-1')).toBe(3);
    expect(store.size).toBe(1);
    expect(store.has('doc-2')).toBe(true);
  });

  it('removes an unchunked document by its own id', () => {
    store.upsert('doc-1', vec('one'));
    expect(store.removeDocument('doc-1')).toBe(1);
    expect(store.size).toBe(0);
  });

  it('returns zero for an unknown document', () => {
    expect(store.removeDocument('missing')).toBe(0);
  });

  it('counts parents, not rows', () => {
    store.upsert('doc-1#chunk-0', vec('one'), 'doc-1');
    store.upsert('doc-1#chunk-1', vec('two'), 'doc-1');
    expect(store.size).toBe(2);
    expect(store.parentCount).toBe(1);
  });

  it('returns a chunked document once, at its best-matching chunk', () => {
    const query = axis(0);
    const chunked = new VectorStore({ dimensions: 4 });

    chunked.upsert('doc-1#chunk-0', axis(1), 'doc-1'); // orthogonal, score 0
    chunked.upsert('doc-1#chunk-1', axis(0), 'doc-1'); // exact match, score 1
    chunked.upsert('doc-1#chunk-2', axis(2), 'doc-1'); // orthogonal, score 0

    const hits = chunked.knn(query, { k: 10 });
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({ id: 'doc-1', chunkId: 'doc-1#chunk-1' });
    expect(hits[0].score).toBeCloseTo(1, 6);
  });

  it('moves a row to a new parent when reparented', () => {
    store.upsert('shared', vec('x'), 'doc-1');
    store.upsert('shared', vec('x'), 'doc-2');

    expect(store.removeDocument('doc-1')).toBe(0);
    expect(store.removeDocument('doc-2')).toBe(1);
    expect(store.size).toBe(0);
  });
});

describe('VectorStore — knn', () => {
  it('ranks by cosine similarity', () => {
    const store = new VectorStore({ dimensions: 4 });
    store.upsert('exact', axis(0));
    store.upsert('orthogonal', axis(1));
    store.upsert('opposite', Float32Array.from([-1, 0, 0, 0]));

    const hits = store.knn(axis(0), { k: 10 });
    expect(hits.map(h => h.id)).toEqual(['exact', 'orthogonal', 'opposite']);
    expect(hits[0].score).toBeCloseTo(1, 6);
    expect(hits[1].score).toBeCloseTo(0, 6);
    expect(hits[2].score).toBeCloseTo(-1, 6);
  });

  it('matches a naive reference implementation over many vectors', () => {
    const dimensions = 32;
    const store = new VectorStore({ dimensions, capacity: 4 });
    const entries = [];

    for (let i = 0; i < 200; i++) {
      const parentId = `doc-${i % 60}`;          // deliberate chunk fan-out
      const id = `${parentId}#chunk-${i}`;
      const vector = vec(`content number ${i}`, dimensions);
      store.upsert(id, vector, parentId);
      entries.push({ id, parentId, vector });
    }

    const query = vec('content number 7', dimensions);
    const expected = naiveKnn(entries, query, 10);
    const actual = store.knn(query, { k: 10 });

    expect(actual.map(h => h.id)).toEqual(expected.map(h => h.id));
    actual.forEach((hit, i) => expect(hit.score).toBeCloseTo(expected[i].score, 5));
  });

  it('limits results to k', () => {
    const store = new VectorStore({ dimensions: 4 });
    for (let i = 0; i < 20; i++) store.upsert(`doc-${i}`, vec(`text ${i}`, 4));
    expect(store.knn(axis(0), { k: 5 })).toHaveLength(5);
  });

  it('defaults k to 10', () => {
    const store = new VectorStore({ dimensions: 4 });
    for (let i = 0; i < 20; i++) store.upsert(`doc-${i}`, vec(`text ${i}`, 4));
    expect(store.knn(axis(0))).toHaveLength(10);
  });

  it('drops matches below minScore', () => {
    const store = new VectorStore({ dimensions: 4 });
    store.upsert('exact', axis(0));
    store.upsert('orthogonal', axis(1));
    store.upsert('opposite', Float32Array.from([-1, 0, 0, 0]));

    const hits = store.knn(axis(0), { k: 10, minScore: 0.5 });
    expect(hits.map(h => h.id)).toEqual(['exact']);
  });

  it('restricts the scan to an allow-set, for reranking a lexical candidate pool', () => {
    const store = new VectorStore({ dimensions: 4 });
    store.upsert('exact', axis(0));
    store.upsert('orthogonal', axis(1));
    store.upsert('also-exact', axis(0));

    expect(store.knn(axis(0), { k: 10, allow: new Set(['orthogonal']) }).map(h => h.id))
      .toEqual(['orthogonal']);
    expect(store.knn(axis(0), { k: 10, allow: ['exact', 'orthogonal'] }).map(h => h.id))
      .toEqual(['exact', 'orthogonal']);
  });

  it('filters the allow-set by parent, not by chunk id', () => {
    const store = new VectorStore({ dimensions: 4 });
    store.upsert('doc-1#chunk-0', axis(0), 'doc-1');
    store.upsert('doc-2#chunk-0', axis(0), 'doc-2');

    const hits = store.knn(axis(0), { k: 10, allow: ['doc-1'] });
    expect(hits.map(h => h.id)).toEqual(['doc-1']);
  });

  it('returns nothing from an empty store', () => {
    expect(new VectorStore({ dimensions: 4 }).knn(axis(0), { k: 5 })).toEqual([]);
  });

  it('skips removed rows', () => {
    const store = new VectorStore({ dimensions: 4 });
    store.upsert('exact', axis(0));
    store.upsert('also-exact', axis(0));
    store.remove('exact');

    expect(store.knn(axis(0), { k: 10 }).map(h => h.id)).toEqual(['also-exact']);
  });

  it('rejects a query vector of the wrong width', () => {
    const store = new VectorStore({ dimensions: 8 });
    expect(() => store.knn(new Float32Array(4))).toThrow(/8-dimensional query/);
    expect(() => store.knn(null)).toThrow(/8-dimensional query/);
  });
});

describe('VectorStore — compact', () => {
  it('repacks live rows and empties the free list without changing results', () => {
    const store = new VectorStore({ dimensions: 4, capacity: 8 });
    store.upsert('a', axis(0));
    store.upsert('b', axis(1));
    store.upsert('c', axis(2));
    store.upsert('d', axis(3));
    store.remove('b');
    store.remove('c');

    expect(store.stats().freeRows).toBe(2);
    const before = store.knn(axis(0), { k: 10 });

    expect(store.compact()).toBe(1); // only 'd' has to move
    expect(store.stats().freeRows).toBe(0);
    expect(store.size).toBe(2);
    expect(store.knn(axis(0), { k: 10 })).toEqual(before);
    expect(Array.from(store.get('d'))).toEqual(Array.from(axis(3)));
  });

  it('is a no-op when there is nothing to reclaim', () => {
    const store = new VectorStore({ dimensions: 4 });
    store.upsert('a', axis(0));
    expect(store.compact()).toBe(0);
  });

  it('keeps parent bookkeeping correct after compaction', () => {
    const store = new VectorStore({ dimensions: 4, capacity: 8 });
    store.upsert('doc-1#chunk-0', axis(0), 'doc-1');
    store.upsert('spacer', axis(1), 'spacer');
    store.upsert('doc-1#chunk-1', axis(2), 'doc-1');
    store.remove('spacer');
    store.compact();

    expect(store.removeDocument('doc-1')).toBe(2);
    expect(store.size).toBe(0);
  });
});

describe('VectorStore — serialization', () => {
  const build = () => {
    const store = new VectorStore({ dimensions: 8, model: 'test-model' });
    store.upsert('doc-1#chunk-0', vec('first chunk', 8), 'doc-1');
    store.upsert('doc-1#chunk-1', vec('second chunk', 8), 'doc-1');
    store.upsert('doc-2', vec('other document', 8), 'doc-2');
    return store;
  };

  it('round-trips ids, parents, vectors and search results', () => {
    const store = build();
    const query = vec('first chunk', 8);
    const before = store.knn(query, { k: 10 });

    const restored = VectorStore.deserialize(store.serialize());

    expect(restored).not.toBeNull();
    expect(restored.size).toBe(3);
    expect(restored.dimensions).toBe(8);
    expect(restored.model).toBe('test-model');
    expect(restored.knn(query, { k: 10 })).toEqual(before);
    expect(restored.removeDocument('doc-1')).toBe(2);
  });

  it('does not mutate the store it serializes, and skips freed rows', () => {
    const store = build();
    store.remove('doc-2');

    const { meta } = store.serialize();
    expect(meta.count).toBe(2);
    expect(meta.ids).toEqual(['doc-1#chunk-0', 'doc-1#chunk-1']);
    expect(store.stats().freeRows).toBe(1); // untouched by serialize
  });

  it('records the format version and the model', () => {
    const { meta } = build().serialize();
    expect(meta.version).toBe(STORE_FORMAT_VERSION);
    expect(meta.model).toBe('test-model');
    expect(meta.dimensions).toBe(8);
  });

  it('serializes an empty store', () => {
    const empty = new VectorStore({ dimensions: 8 });
    const restored = VectorStore.deserialize(empty.serialize());
    expect(restored.size).toBe(0);
  });

  it('survives an unaligned buffer, as read back from a pooled file read', () => {
    const store = build();
    const { buffer, meta } = store.serialize();

    // Node's Buffer pool hands out views at arbitrary offsets; emulate a
    // 1-byte-misaligned one, which Float32Array cannot view directly.
    const padded = Buffer.alloc(buffer.length + 1);
    buffer.copy(padded, 1);
    const misaligned = padded.subarray(1);
    expect(misaligned.byteOffset % 4).not.toBe(0);

    const restored = VectorStore.deserialize({ buffer: misaligned, meta });
    expect(restored).not.toBeNull();
    expect(restored.size).toBe(3);
    expect(Array.from(restored.get('doc-2'))).toEqual(Array.from(store.get('doc-2')));
  });

  it('discards data from a different embedding model', () => {
    const serialized = build().serialize();
    expect(VectorStore.deserialize(serialized, { model: 'a-different-model' })).toBeNull();
    expect(VectorStore.deserialize(serialized, { model: 'test-model' })).not.toBeNull();
  });

  it('discards data of a different width', () => {
    const serialized = build().serialize();
    expect(VectorStore.deserialize(serialized, { dimensions: 384 })).toBeNull();
    expect(VectorStore.deserialize(serialized, { dimensions: 8 })).not.toBeNull();
  });

  it('discards data from an unrecognised format version', () => {
    const serialized = build().serialize();
    serialized.meta.version = '0.0.1';
    expect(VectorStore.deserialize(serialized)).toBeNull();
  });

  it('discards a truncated buffer rather than reading garbage', () => {
    const serialized = build().serialize();
    serialized.buffer = serialized.buffer.subarray(0, 12);
    expect(VectorStore.deserialize(serialized)).toBeNull();
  });

  it('discards metadata that disagrees with itself', () => {
    const serialized = build().serialize();
    serialized.meta.ids = ['only-one'];
    expect(VectorStore.deserialize(serialized)).toBeNull();
  });

  it('discards malformed input', () => {
    expect(VectorStore.deserialize(null)).toBeNull();
    expect(VectorStore.deserialize({})).toBeNull();
    expect(VectorStore.deserialize({ meta: { version: STORE_FORMAT_VERSION } })).toBeNull();
  });
});
