/**
 * @fileoverview Unit tests for hybrid-search rank fusion.
 *
 * The point of fusion is that BM25 and cosine scores are not on the same scale,
 * so the tests use score ranges that are deliberately incomparable — a lexical
 * list in the tens, a semantic list in [0, 1] — and assert that the fused
 * ranking depends on rank, not on which side happens to have bigger numbers.
 *
 * @author NooblyJS Team
 * @version 1.0.0
 * @since 2026-08-27
 */

'use strict';

const { rrf, weighted, fuse, DEFAULT_RRF_K } =
  require('../../../src/searching/modules/fusion');

/** Ids in fused order. */
const ids = (results) => results.map(r => r.id);

/** A BM25-shaped list: unbounded scores. */
const lexical = [
  { id: 'a', score: 42.7 },
  { id: 'b', score: 18.2 },
  { id: 'c', score: 3.1 }
];

/** A cosine-shaped list: scores in [0, 1], different ordering. */
const semantic = [
  { id: 'c', score: 0.91 },
  { id: 'd', score: 0.78 },
  { id: 'a', score: 0.44 }
];

describe('rrf', () => {
  it('ranks a document appearing in both lists above one appearing in either', () => {
    const fused = rrf([lexical, semantic]);
    // 'a' is 1st and 3rd; 'c' is 3rd and 1st. Both beat the single-list entries.
    expect(ids(fused).slice(0, 2).sort()).toEqual(['a', 'c']);
    expect(ids(fused).slice(2).sort()).toEqual(['b', 'd']);
  });

  it('ignores score magnitude entirely and uses only rank', () => {
    const tiny = [{ id: 'x', score: 0.0001 }, { id: 'y', score: 0.00005 }];
    const huge = [{ id: 'x', score: 999999 }, { id: 'y', score: 500000 }];
    expect(ids(rrf([tiny]))).toEqual(ids(rrf([huge])));
  });

  it('scores by the reciprocal-rank formula', () => {
    const fused = rrf([[{ id: 'a', score: 10 }]], { k: 60 });
    expect(fused[0].score).toBeCloseTo(1 / 61, 10);
  });

  it('uses k=60 by default', () => {
    expect(DEFAULT_RRF_K).toBe(60);
    expect(rrf([[{ id: 'a', score: 1 }]])[0].score).toBeCloseTo(1 / 61, 10);
  });

  it('weights the top of each list more heavily as k shrinks', () => {
    const single = [[{ id: 'a', score: 1 }, { id: 'b', score: 0.9 }]];
    const gapAtK1 = (() => { const f = rrf(single, { k: 1 }); return f[0].score - f[1].score; })();
    const gapAtK60 = (() => { const f = rrf(single, { k: 60 }); return f[0].score - f[1].score; })();
    expect(gapAtK1).toBeGreaterThan(gapAtK60);
  });

  it('applies per-list weights', () => {
    const onlyLexical = [{ id: 'a', score: 5 }];
    const onlySemantic = [{ id: 'b', score: 0.5 }];

    const balanced = rrf([onlyLexical, onlySemantic]);
    expect(balanced[0].score).toBeCloseTo(balanced[1].score, 10);

    const leaning = rrf([onlyLexical, onlySemantic], { weights: [2, 1] });
    expect(ids(leaning)).toEqual(['a', 'b']);
    expect(leaning[0].score).toBeCloseTo(2 * leaning[1].score, 10);
  });

  it('skips a list weighted to zero', () => {
    expect(ids(rrf([lexical, semantic], { weights: [1, 0] }))).toEqual(['a', 'b', 'c']);
  });

  it('records where each contribution came from, with 1-based ranks', () => {
    const fused = rrf([lexical, semantic]);
    const a = fused.find(r => r.id === 'a');

    expect(a.contributions).toEqual([
      { listIndex: 0, rank: 1, score: 42.7 },
      { listIndex: 1, rank: 3, score: 0.44 }
    ]);
  });

  it('re-sorts a list that arrives out of order', () => {
    const scrambled = [{ id: 'low', score: 1 }, { id: 'high', score: 100 }];
    expect(ids(rrf([scrambled]))).toEqual(['high', 'low']);
  });

  it('keeps only the best entry for a repeated id', () => {
    const duplicated = [{ id: 'a', score: 1 }, { id: 'a', score: 50 }, { id: 'b', score: 10 }];
    const fused = rrf([duplicated]);

    expect(ids(fused)).toEqual(['a', 'b']);
    expect(fused[0].contributions).toHaveLength(1);
    expect(fused[0].contributions[0].score).toBe(50);
  });

  it('drops entries with a missing id or a non-finite score', () => {
    const messy = [
      { id: 'a', score: 1 },
      { id: null, score: 5 },
      { id: 'b', score: NaN },
      { id: 'c', score: Infinity }
    ];
    expect(ids(rrf([messy]))).toEqual(['a']);
  });

  it('handles empty and absent lists', () => {
    expect(rrf([])).toEqual([]);
    expect(rrf([[], []])).toEqual([]);
    expect(rrf(null)).toEqual([]);
    expect(ids(rrf([lexical, []]))).toEqual(['a', 'b', 'c']);
  });
});

describe('weighted', () => {
  it('blends min-max normalized scores', () => {
    const fused = weighted(
      [{ id: 'a', score: 10 }, { id: 'b', score: 0 }],
      [{ id: 'b', score: 1 }, { id: 'a', score: 0 }],
      { alpha: 0.5 }
    );
    // Both normalize to 1 and 0 on opposite sides, so they tie at 0.5.
    expect(fused[0].score).toBeCloseTo(0.5, 10);
    expect(fused[1].score).toBeCloseTo(0.5, 10);
  });

  it('follows the lexical list at alpha 1 and the semantic list at alpha 0', () => {
    expect(ids(weighted(lexical, semantic, { alpha: 1 })).slice(0, 3)).toEqual(['a', 'b', 'c']);
    expect(ids(weighted(lexical, semantic, { alpha: 0 })).slice(0, 3)).toEqual(['c', 'd', 'a']);
  });

  it('clamps alpha into [0, 1]', () => {
    expect(ids(weighted(lexical, semantic, { alpha: 5 })))
      .toEqual(ids(weighted(lexical, semantic, { alpha: 1 })));
    expect(ids(weighted(lexical, semantic, { alpha: -5 })))
      .toEqual(ids(weighted(lexical, semantic, { alpha: 0 })));
  });

  it('defaults alpha to 0.5', () => {
    expect(weighted(lexical, semantic)).toEqual(weighted(lexical, semantic, { alpha: 0.5 }));
  });

  it('normalizes an all-equal list to 1 rather than 0', () => {
    const flat = [{ id: 'a', score: 7 }, { id: 'b', score: 7 }];
    const fused = weighted(flat, [], { alpha: 1 });
    expect(fused[0].score).toBeCloseTo(1, 10);
    expect(fused[1].score).toBeCloseTo(1, 10);
  });

  it('normalizes a single-entry list to 1', () => {
    expect(weighted([{ id: 'a', score: 3 }], [], { alpha: 1 })[0].score).toBeCloseTo(1, 10);
  });

  it('rewards a document found by both sides', () => {
    const both = [{ id: 'shared', score: 5 }, { id: 'lexOnly', score: 5 }];
    const sem = [{ id: 'shared', score: 0.9 }];
    const fused = weighted(both, sem, { alpha: 0.5 });

    expect(fused[0].id).toBe('shared');
    expect(fused[0].score).toBeGreaterThan(fused[1].score);
  });

  it('reports the original scores, not the normalized ones', () => {
    const fused = weighted(lexical, semantic, { alpha: 0.5 });
    const a = fused.find(r => r.id === 'a');
    const d = fused.find(r => r.id === 'd');

    expect(a.lexicalScore).toBe(42.7);
    expect(a.semanticScore).toBe(0.44);
    expect(d.lexicalScore).toBeNull();
    expect(d.semanticScore).toBe(0.78);
  });

  it('handles empty input on either side', () => {
    expect(weighted([], [])).toEqual([]);
    expect(ids(weighted(lexical, []))).toEqual(['a', 'b', 'c']);
    expect(ids(weighted([], semantic))).toEqual(['c', 'd', 'a']);
  });
});

describe('fuse', () => {
  it('defaults to RRF', () => {
    expect(fuse(lexical, semantic).map(r => r.id))
      .toEqual(rrf([lexical, semantic]).map(r => r.id));
  });

  it('dispatches to weighted fusion on request', () => {
    expect(ids(fuse(lexical, semantic, { method: 'weighted', alpha: 1 })).slice(0, 3))
      .toEqual(['a', 'b', 'c']);
  });

  it('rejects an unknown method rather than silently falling back', () => {
    expect(() => fuse(lexical, semantic, { method: 'magic' }))
      .toThrow(/Unknown fusion method "magic"/);
  });

  it('labels how each document was matched', () => {
    const byId = Object.fromEntries(fuse(lexical, semantic).map(r => [r.id, r]));

    expect(byId.a.matchedBy).toBe('both');
    expect(byId.c.matchedBy).toBe('both');
    expect(byId.b.matchedBy).toBe('lexical');
    expect(byId.d.matchedBy).toBe('semantic');
  });

  it('carries both original scores through RRF fusion', () => {
    const byId = Object.fromEntries(fuse(lexical, semantic).map(r => [r.id, r]));

    expect(byId.a.lexicalScore).toBe(42.7);
    expect(byId.a.semanticScore).toBe(0.44);
    expect(byId.b.semanticScore).toBeNull();
    expect(byId.d.lexicalScore).toBeNull();
  });

  it('labels matches the same way under either method', () => {
    const viaRrf = Object.fromEntries(fuse(lexical, semantic).map(r => [r.id, r.matchedBy]));
    const viaWeighted = Object.fromEntries(
      fuse(lexical, semantic, { method: 'weighted' }).map(r => [r.id, r.matchedBy])
    );
    expect(viaWeighted).toEqual(viaRrf);
  });

  it('degrades to the surviving list when one retriever returns nothing', () => {
    const semanticOnly = fuse([], semantic);
    expect(ids(semanticOnly)).toEqual(['c', 'd', 'a']);
    expect(semanticOnly.every(r => r.matchedBy === 'semantic')).toBe(true);

    const lexicalOnly = fuse(lexical, []);
    expect(ids(lexicalOnly)).toEqual(['a', 'b', 'c']);
    expect(lexicalOnly.every(r => r.matchedBy === 'lexical')).toBe(true);
  });

  it('returns nothing when both retrievers return nothing', () => {
    expect(fuse([], [])).toEqual([]);
  });
});
