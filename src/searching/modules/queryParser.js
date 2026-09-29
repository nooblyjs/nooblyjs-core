/**
 * @fileoverview Search query syntax.
 *
 * One parser for the query syntax every search provider honours, so a caller
 * gets the same semantics whichever backend is configured. Currently that
 * syntax is exact phrases: text wrapped in double quotes must appear verbatim
 * (adjacent, in order, case-insensitive) rather than merely contributing its
 * words to the score.
 *
 * @author NooblyJS Team
 * @version 1.0.0
 * @since 2026-07-22
 */

'use strict';

/**
 * Collapse text to a stream of lowercase words separated by single spaces,
 * padded with a leading/trailing space. Phrase matching is a plain `indexOf`
 * over this normalized form, which makes it punctuation- and whitespace-
 * agnostic ("Oracle-MySQL", "Oracle\n  MySQL" and "Oracle MySQL" all match the
 * phrase `oracle mysql`) while the padding keeps matches on word boundaries
 * (`"SQL"` does not match "MySQL").
 *
 * Collapsing runs of separators rather than allowing an arbitrary run between
 * words also stops the synthetic `_all` field's JSON from producing cross-field
 * false positives: `{"a":"Oracle","b":"MySQL"}` normalizes to ` a oracle b
 * mysql `, which the phrase ` oracle mysql ` correctly fails to match.
 *
 * @param {string} text
 * @return {string} Padded, normalized text — or '' when there are no words.
 */
function normalizeForPhrase(text) {
  if (text == null) return '';
  const collapsed = String(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
  return collapsed ? ` ${collapsed} ` : '';
}

/**
 * Split a query into its quoted phrases and a remainder used for tokenization.
 *
 * Both straight (`"`) and curly (`“ ”`) quotes are honored — users paste from
 * Word and Teams. An unterminated quote treats the rest of the query as a
 * phrase, matching what users expect from web search engines. The remainder
 * keeps the phrase words (minus the quote characters) so they still contribute
 * to relevance scoring; the phrase itself is enforced separately.
 *
 * @param {string} query
 * @return {{phrases: Array<string>, remainder: string}}
 *
 * @example
 * parseQuotedPhrases('Oracle "MySQL Enterprise" licence');
 * // → { phrases: ['MySQL Enterprise'],
 * //     remainder: 'Oracle MySQL Enterprise licence' }
 */
function parseQuotedPhrases(query) {
  const src = String(query == null ? '' : query);
  const phrases = [];
  let remainder = '';
  let i = 0;

  while (i < src.length) {
    const ch = src[i];
    const closer = ch === '"' ? '"' : (ch === '“' ? '”' : null);
    if (!closer) {
      remainder += ch;
      i++;
      continue;
    }
    let end = src.indexOf(closer, i + 1);
    // A curly-open quote closed with a straight quote is a common paste artifact.
    if (end === -1 && closer === '”') end = src.indexOf('"', i + 1);
    const body = end === -1 ? src.slice(i + 1) : src.slice(i + 1, end);
    if (body.trim()) phrases.push(body.trim());
    remainder += ` ${body} `;
    i = end === -1 ? src.length : end + 1;
  }

  return { phrases, remainder: remainder.replace(/\s+/g, ' ').trim() };
}

module.exports = { parseQuotedPhrases, normalizeForPhrase };
