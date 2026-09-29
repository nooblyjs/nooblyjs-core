/**
 * @fileoverview Levenshtein edit-distance helper used for fuzzy matching
 * in the token-based search provider. Iterative two-row implementation
 * with early termination once the running minimum exceeds maxDistance.
 *
 * @author NooblyJS Team
 * @version 1.0.0
 * @since 1.0.17
 */

'use strict';

/**
 * Compute the Levenshtein edit distance between two strings.
 * Returns Infinity if the distance is known to exceed maxDistance.
 *
 * @param {string} a First string.
 * @param {string} b Second string.
 * @param {number} [maxDistance=Infinity] Early-termination threshold.
 * @return {number} Edit distance, or Infinity when above maxDistance.
 */
function distance(a, b, maxDistance = Infinity) {
  if (a === b) return 0;
  if (!a) return b.length <= maxDistance ? b.length : Infinity;
  if (!b) return a.length <= maxDistance ? a.length : Infinity;
  if (Math.abs(a.length - b.length) > maxDistance) return Infinity;

  let prev = new Array(b.length + 1);
  let curr = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    const ai = a.charCodeAt(i - 1);
    for (let j = 1; j <= b.length; j++) {
      const cost = ai === b.charCodeAt(j - 1) ? 0 : 1;
      const v = Math.min(
        curr[j - 1] + 1,
        prev[j] + 1,
        prev[j - 1] + cost
      );
      curr[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > maxDistance) return Infinity;
    const tmp = prev;
    prev = curr;
    curr = tmp;
  }

  return prev[b.length];
}

module.exports = { distance };
