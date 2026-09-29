/**
 * @fileoverview Rank fusion for hybrid search.
 *
 * Hybrid search has to merge two rankings that are not on the same scale. BM25
 * scores are unbounded and depend on corpus statistics — the same document can
 * score 4 today and 11 once the index grows — while cosine similarity sits in
 * [-1, 1]. Adding them directly lets whichever side happens to have the larger
 * numbers dictate the ranking.
 *
 * Two strategies, both here:
 *
 * - `rrf` — Reciprocal Rank Fusion. Ignores scores entirely and uses only rank
 *   position: `score(d) = Σ weight_i / (k + rank_i(d))`. Scale-free, needs no
 *   tuning, and degrades gracefully when one side returns nothing. The default.
 * - `weighted` — min-max normalizes each side to [0, 1] and blends them with
 *   `alpha`. Sensitive to outliers and to corpus drift, but it is what a
 *   human tuning a slider expects, so the dashboard exposes it.
 *
 * Both take and return plain `{ id, score }` arrays, which keeps this module
 * independent of the search engine's result shape and trivial to test on
 * hand-written rank lists.
 *
 * @author NooblyJS Team
 * @version 1.0.0
 * @since 2026-08-27
 */

'use strict';

/**
 * Conventional RRF constant. Large enough that the top few ranks are not
 * wildly more valuable than the next few, small enough that rank still matters.
 */
const DEFAULT_RRF_K = 60;

/**
 * Sort a copy of a result list by descending score and drop repeat ids,
 * keeping each id's best entry.
 *
 * @param {Array<{id: string, score: number}>} list Candidate results.
 * @return {Array<{id: string, score: number}>} Cleaned, ranked copy.
 * @private
 */
function rank_(list) {
  if (!Array.isArray(list) || list.length === 0) return [];

  const cleaned = list.filter(
    entry => entry && entry.id != null && Number.isFinite(entry.score)
  );
  cleaned.sort((a, b) => b.score - a.score);

  const seen = new Set();
  const out = [];
  for (const entry of cleaned) {
    const id = String(entry.id);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ id, score: entry.score });
  }
  return out;
}

/**
 * Min-max normalize scores into [0, 1].
 *
 * A list whose scores are all equal (including a single-entry list) normalizes
 * to 1 rather than 0: every entry is equally and maximally relevant to that
 * retriever, and mapping them to 0 would let the other side silently win.
 *
 * @param {Array<{id: string, score: number}>} ranked Ranked results.
 * @return {Map<string, {raw: number, norm: number}>} id → raw and normalized score.
 * @private
 */
function normalizeScores_(ranked) {
  const out = new Map();
  if (ranked.length === 0) return out;

  const max = ranked[0].score;
  const min = ranked[ranked.length - 1].score;
  const span = max - min;

  for (const entry of ranked) {
    out.set(entry.id, {
      raw: entry.score,
      norm: span === 0 ? 1 : (entry.score - min) / span
    });
  }
  return out;
}

/**
 * Reciprocal Rank Fusion over any number of ranked lists.
 *
 * @param {Array<Array<{id: string, score: number}>>} lists Ranked lists. Order
 *   is meaningful only in that it determines `listIndex` in the contributions.
 * @param {Object} [options] Fusion options.
 * @param {number} [options.k=60] Rank damping constant. Smaller values weight
 *   the very top of each list more heavily.
 * @param {Array<number>} [options.weights] Per-list multipliers, positionally
 *   aligned with `lists`. Defaults to 1 for every list.
 * @return {Array<{id: string, score: number, contributions:
 *   Array<{listIndex: number, rank: number, score: number}>}>} Fused ranking,
 *   descending. `rank` is 1-based.
 *
 * @example
 * rrf([bm25Results, vectorResults]);
 *
 * @example
 * // Trust the lexical side twice as much
 * rrf([bm25Results, vectorResults], { weights: [2, 1] });
 */
function rrf(lists, options = {}) {
  const k = typeof options.k === 'number' && options.k > 0 ? options.k : DEFAULT_RRF_K;
  const weights = Array.isArray(options.weights) ? options.weights : null;
  const source = Array.isArray(lists) ? lists : [];

  /** @type {Map<string, {id: string, score: number, contributions: Array}>} */
  const fused = new Map();

  for (let listIndex = 0; listIndex < source.length; listIndex++) {
    const ranked = rank_(source[listIndex]);
    const weight = weights?.[listIndex] ?? 1;
    if (weight === 0) continue;

    for (let position = 0; position < ranked.length; position++) {
      const entry = ranked[position];
      const rank = position + 1;
      const contribution = weight / (k + rank);

      let existing = fused.get(entry.id);
      if (!existing) {
        existing = { id: entry.id, score: 0, contributions: [] };
        fused.set(entry.id, existing);
      }
      existing.score += contribution;
      existing.contributions.push({ listIndex, rank, score: entry.score });
    }
  }

  const results = Array.from(fused.values());
  results.sort((a, b) => b.score - a.score);
  return results;
}

/**
 * Weighted blend of min-max normalized scores.
 *
 * A document present in only one list contributes 0 from the other, so
 * appearing in both is rewarded — which is the behaviour hybrid search wants.
 *
 * @param {Array<{id: string, score: number}>} lexical BM25 results.
 * @param {Array<{id: string, score: number}>} semantic Vector results.
 * @param {Object} [options] Fusion options.
 * @param {number} [options.alpha=0.5] Weight on the lexical side; the semantic
 *   side gets `1 - alpha`. Clamped to [0, 1].
 * @return {Array<{id: string, score: number, lexicalScore: number|null,
 *   semanticScore: number|null}>} Fused ranking, descending. The per-side
 *   scores are the original values, not the normalized ones.
 *
 * @example
 * weighted(bm25Results, vectorResults, { alpha: 0.3 }); // lean semantic
 */
function weighted(lexical, semantic, options = {}) {
  const rawAlpha = typeof options.alpha === 'number' ? options.alpha : 0.5;
  const alpha = Math.min(1, Math.max(0, rawAlpha));

  const lexicalScores = normalizeScores_(rank_(lexical));
  const semanticScores = normalizeScores_(rank_(semantic));

  const ids = new Set([...lexicalScores.keys(), ...semanticScores.keys()]);
  const results = [];

  for (const id of ids) {
    const lex = lexicalScores.get(id);
    const sem = semanticScores.get(id);
    results.push({
      id,
      score: alpha * (lex?.norm ?? 0) + (1 - alpha) * (sem?.norm ?? 0),
      lexicalScore: lex?.raw ?? null,
      semanticScore: sem?.raw ?? null
    });
  }

  results.sort((a, b) => b.score - a.score);
  return results;
}

/**
 * Fuse a lexical and a semantic ranking into the shape the search engine
 * returns to callers.
 *
 * This is the entry point `SearchService.search()` uses; `rrf` and `weighted`
 * remain exported for direct use and for testing.
 *
 * @param {Array<{id: string, score: number}>} lexical BM25 results.
 * @param {Array<{id: string, score: number}>} semantic Vector results.
 * @param {Object} [options] Fusion options.
 * @param {string} [options.method='rrf'] `'rrf'` or `'weighted'`.
 * @param {number} [options.k=60] RRF rank damping.
 * @param {number} [options.alpha=0.5] Weighted-fusion lexical weight.
 * @param {Array<number>} [options.weights] Per-list weights for RRF,
 *   as `[lexical, semantic]`.
 * @return {Array<{id: string, score: number, lexicalScore: number|null,
 *   semanticScore: number|null, matchedBy: string}>} Fused ranking, descending.
 *   `matchedBy` is `'lexical'`, `'semantic'` or `'both'`.
 * @throws {Error} If `method` is not a known strategy.
 *
 * @example
 * const fused = fuse(lexicalHits, vectorHits, { method: 'rrf' });
 * // → [{ id, score, lexicalScore, semanticScore, matchedBy: 'both' }, ...]
 */
function fuse(lexical, semantic, options = {}) {
  const method = options.method || 'rrf';

  if (method === 'weighted') {
    return weighted(lexical, semantic, options).map(entry => ({
      ...entry,
      matchedBy: matchedBy_(entry.lexicalScore, entry.semanticScore)
    }));
  }

  if (method !== 'rrf') {
    throw new Error(`Unknown fusion method "${method}" — expected 'rrf' or 'weighted'`);
  }

  return rrf([lexical, semantic], options).map(entry => {
    const lexicalScore = scoreFrom_(entry.contributions, 0);
    const semanticScore = scoreFrom_(entry.contributions, 1);
    return {
      id: entry.id,
      score: entry.score,
      lexicalScore,
      semanticScore,
      matchedBy: matchedBy_(lexicalScore, semanticScore)
    };
  });
}

/**
 * Pull one list's original score out of an RRF contribution set.
 *
 * @param {Array<{listIndex: number, score: number}>} contributions
 * @param {number} listIndex
 * @return {number|null}
 * @private
 */
function scoreFrom_(contributions, listIndex) {
  const found = contributions.find(c => c.listIndex === listIndex);
  return found ? found.score : null;
}

/**
 * Label which retriever(s) found a document.
 *
 * @param {number|null} lexicalScore
 * @param {number|null} semanticScore
 * @return {string} `'lexical'`, `'semantic'` or `'both'`.
 * @private
 */
function matchedBy_(lexicalScore, semanticScore) {
  if (lexicalScore != null && semanticScore != null) return 'both';
  return lexicalScore != null ? 'lexical' : 'semantic';
}

module.exports = { rrf, weighted, fuse, DEFAULT_RRF_K };
