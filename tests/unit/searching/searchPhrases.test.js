/**
 * @fileoverview Unit tests for exact-phrase (quoted) search.
 *
 * A quoted segment in a query is an instruction: match these words adjacent and
 * in this order, ignoring case. The motivating failure is a search for
 * `Oracle MySQL` returning every Oracle product because both words appear
 * somewhere in the document — `"Oracle MySQL"` must return only the documents
 * that actually say "Oracle MySQL".
 *
 * @author NooblyJS Team
 * @version 1.0.0
 * @since 2026-07-22
 */

'use strict';

const EventEmitter = require('events');
const createSearchService = require('../../../src/searching');
const { parseQuotedPhrases, normalizeForPhrase } =
  require('../../../src/searching/modules/queryParser');

/** Result ids, in score order. */
const ids = (results) => results.map(r => r.id);

describe('parseQuotedPhrases', () => {
  it('splits quoted phrases out while keeping their words in the remainder', () => {
    expect(parseQuotedPhrases('Oracle "MySQL Enterprise" licence')).toEqual({
      phrases: ['MySQL Enterprise'],
      remainder: 'Oracle MySQL Enterprise licence'
    });
  });

  it('returns no phrases for an unquoted query', () => {
    expect(parseQuotedPhrases('Oracle MySQL')).toEqual({
      phrases: [], remainder: 'Oracle MySQL'
    });
  });

  it('handles multiple phrases and curly quotes', () => {
    expect(parseQuotedPhrases('“Oracle MySQL” and "Change Request"').phrases)
      .toEqual(['Oracle MySQL', 'Change Request']);
  });

  it('treats an unterminated quote as a phrase to the end of the query', () => {
    expect(parseQuotedPhrases('cost of "Oracle MySQL').phrases).toEqual(['Oracle MySQL']);
  });

  it('ignores empty quotes', () => {
    expect(parseQuotedPhrases('Oracle "" MySQL').phrases).toEqual([]);
  });
});

describe('normalizeForPhrase', () => {
  it('collapses punctuation and whitespace to single spaces and pads the edges', () => {
    expect(normalizeForPhrase('Oracle-MySQL,  Enterprise')).toBe(' oracle mysql enterprise ');
  });

  it('returns empty for text with no words', () => {
    expect(normalizeForPhrase('   ---   ')).toBe('');
  });
});

describe('Exact-phrase search', () => {
  let search;

  beforeEach(async () => {
    search = createSearchService('default', { snippet: { enabled: true } }, new EventEmitter());
    // Wiki-shaped usage: indexDocument(id, content, metadata).
    await search.indexDocument(
      'adjacent',
      'The estate includes Oracle MySQL Enterprise Edition for the CRM.',
      { path: 'adjacent.md' }
    );
    await search.indexDocument(
      'scattered',
      'Oracle Fusion and Oracle Forms are licensed; separately we run a MySQL community server.',
      { path: 'scattered.md' }
    );
    await search.indexDocument(
      'spanning',
      'Notes about   Oracle\n   MySQL   across lines.',
      { path: 'spanning.md' }
    );
  });

  it('returns every document mentioning either word when unquoted', async () => {
    expect(ids(await search.search('Oracle MySQL')).sort())
      .toEqual(['adjacent', 'scattered', 'spanning']);
  });

  it('returns only documents where the words are adjacent when quoted', async () => {
    expect(ids(await search.search('"Oracle MySQL"')).sort())
      .toEqual(['adjacent', 'spanning']);
  });

  it('ignores case', async () => {
    expect(ids(await search.search('"oracle mysql"')).sort())
      .toEqual(['adjacent', 'spanning']);
  });

  it('ignores intervening punctuation and line breaks', async () => {
    expect(ids(await search.search('"Oracle MySQL"'))).toContain('spanning');
  });

  it('respects word boundaries — a quoted word is not a substring match', async () => {
    expect(await search.search('"SQL"')).toEqual([]);
    expect(ids(await search.search('"MySQL"')).sort())
      .toEqual(['adjacent', 'scattered', 'spanning']);
  });

  it('requires the phrase but leaves loose terms OR-combined as usual', async () => {
    // "CRM" is optional (default combineWith is OR) so it only lifts the
    // ranking; the phrase is what decides membership.
    expect(ids(await search.search('CRM "Oracle MySQL"'))).toEqual(['adjacent', 'spanning']);
    expect(ids(await search.search('CRM "Oracle MySQL"', { combineWith: 'AND' })))
      .toEqual(['adjacent']);
  });

  it('ANDs multiple phrases together', async () => {
    expect(ids(await search.search('"Oracle MySQL" "Enterprise Edition"'))).toEqual(['adjacent']);
    expect(await search.search('"Oracle MySQL" "Community Server"')).toEqual([]);
  });

  it('does not fuzzy-match inside quotes', async () => {
    // Unquoted, fuzzy rescues the typo …
    expect(ids(await search.search('Orcle MySQL', { fuzzy: 0.3 }))).toContain('adjacent');
    // … quoted, the user asked for those exact words.
    expect(await search.search('"Orcle MySQL"', { fuzzy: 0.3 })).toEqual([]);
  });

  it('does not prefix-match inside quotes', async () => {
    expect(ids(await search.search('Enterp', { prefix: true }))).toContain('adjacent');
    expect(await search.search('"Enterp"', { prefix: true })).toEqual([]);
  });

  it('does not synonym-expand inside quotes', async () => {
    const svc = createSearchService(
      'default',
      { snippet: { enabled: true }, synonyms: [['mysql', 'mariadb']] },
      new EventEmitter()
    );
    await svc.indexDocument('m1', 'We run Oracle MariaDB in production.', { path: 'm1.md' });
    expect(ids(await svc.search('Oracle MySQL'))).toEqual(['m1']);
    expect(await svc.search('"Oracle MySQL"')).toEqual([]);
  });

  it('matches phrases made only of stop words by scanning retained text', async () => {
    // "for the" has no indexable tokens at all, so this exercises the scan path.
    expect(ids(await search.search('"for the"'))).toEqual(['adjacent']);
    expect(await search.search('"beside the"')).toEqual([]);
  });

  it('centres the snippet on the phrase', async () => {
    const [hit] = await search.search('"Enterprise Edition"');
    expect(hit.snippet).toContain('Enterprise');
    expect(hit.snippet).toContain('Edition');
  });

  it('treats quotes as literal characters when quotedPhrases is false', async () => {
    expect(ids(await search.search('"Oracle MySQL"', { quotedPhrases: false })).sort())
      .toEqual(['adjacent', 'scattered', 'spanning']);
  });

  it('does not match a phrase spanning two fields of the synthetic _all field', async () => {
    const svc = createSearchService('default', {}, new EventEmitter());
    await svc.add('split', { vendor: 'Oracle', product: 'MySQL' });
    await svc.add('joined', { note: 'Oracle MySQL is the product name' });
    expect(ids(await svc.search('"Oracle MySQL"'))).toEqual(['joined']);
  });
});
