/**
 * @fileoverview Demo app for the Apache SOLR search provider.
 *
 * Exercises the full provider surface against a live SOLR instance:
 * collection bootstrap, add / addAll / replace / remove / removeAll,
 * search (plain, field-scoped, prefix, AND), autoSuggest, suggest,
 * listIndexes, getStats / getIndexStats, clearIndex and deleteIndex.
 *
 * Prerequisites:
 *   - SOLR running at SOLR_URL (default http://localhost:8983/solr).
 *     Tested against SOLR 10.x in SolrCloud mode with the `_default` configset.
 *   - The provider creates the collection automatically (via its own
 *     `ensureCollection()` method) if it does not exist.
 *
 * Run:   node tests/app/searching/app-searching-solr.js
 * Then:  visit http://localhost:3101/services/searching/
 *
 * @author NooblyJS Team
 * @version 1.0.0
 * @since 1.0.16
 */

'use strict';

const path = require('node:path');
const express = require('express');
const helmet = require('helmet');
const { EventEmitter } = require('events');

// ─── Configuration ──────────────────────────────────────────────────
const SOLR_URL = process.env.SOLR_URL || 'http://localhost:8983/solr';
// Omit SOLR_COLLECTION to let the provider default to its "default" collection.
const SOLR_COLLECTION = process.env.SOLR_COLLECTION || undefined;
const PORT = Number(process.env.PORT) || 3101;

const app = express();

// Security headers: applied before other middleware so every response is
// covered. CSP is disabled here to match the main apps (app.js / app-noauth.js)
// because the service dashboards use inline styles/scripts; enable a tuned CSP
// per deployment.
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json());

const options = {
  logDir: path.join(__dirname, './.application/', 'logs'),
  dataDir: path.join(__dirname, './.application/', 'data'),
  cacheDir: path.join(__dirname, './.application/', 'caching'),
  'express-app': app,
  brandingConfig: { appName: 'Search SOLR Demo', primaryColor: '#000' },
  security: {
    apiKeyAuth: { requireApiKey: false, apiKeys: [] },
    servicesAuth: { requireLogin: false }
  }
};

const eventEmitter = new EventEmitter();
const serviceRegistry = require('../../../index');
serviceRegistry.initialize(app, eventEmitter, options);

serviceRegistry.authservice();
const logger = serviceRegistry.logger('file');

// SOLR-backed search provider. `commit: true` makes writes immediately
// visible — convenient for a demo (production should prefer commitWithin).
const searching = serviceRegistry.searching('solr', {
  SOLR_URL,
  SOLR_COLLECTION,
  commit: true,
  dependencies: { logging: logger }
});

app.get('/', (req, res) => res.redirect('/services'));

// Collection bootstrap now lives in the provider: `searching.ensureCollection()`
// creates the configured collection (default "default") if missing and waits
// for it to become queryable. See src/searching/providers/searchingSOLR.js.

// ─── Sample data ─────────────────────────────────────────────────────

const books = [
  { id: 1, title: 'Moby Dick', author: 'Herman Melville', text: 'Call me Ishmael. Some years ago...', category: 'fiction', year: 1851 },
  { id: 2, title: 'Zen and the Art of Motorcycle Maintenance', author: 'Robert Pirsig', text: 'I can see by my watch...', category: 'fiction', year: 1974 },
  { id: 3, title: 'Neuromancer', author: 'William Gibson', text: 'The sky above the port was the color of television.', category: 'fiction', year: 1984 },
  { id: 4, title: 'Zen in the Art of Archery', author: 'Eugen Herrigel', text: 'At first sight it must seem...', category: 'non-fiction', year: 1948 },
  { id: 5, title: 'The Pragmatic Programmer', author: 'Andy Hunt', text: 'Pragmatic principles for software craft.', category: 'technical', year: 1999 },
  { id: 6, title: 'Designing Data-Intensive Applications', author: 'Martin Kleppmann', text: 'The big ideas behind reliable, scalable systems.', category: 'technical', year: 2017 },
  { id: 7, title: 'The Mythical Man-Month', author: 'Fred Brooks', text: 'Adding manpower to a late project makes it later.', category: 'technical', year: 1975 }
];

const people = [
  { id: 'p1', firstname: 'Ada', lastname: 'Lovelace', country: 'England' },
  { id: 'p2', firstname: 'Alan', lastname: 'Turing', country: 'England' },
  { id: 'p3', firstname: 'Grace', lastname: 'Hopper', country: 'USA' }
];

// ─── Demo run ────────────────────────────────────────────────────────

app.listen(PORT, async () => {
  logger.info(`Search SOLR demo running on http://localhost:${PORT}/services/searching/`);

  const demo = async (label, fn) => {
    try {
      const out = await fn();
      logger.info(`[${label}] ${JSON.stringify(out)}`);
    } catch (err) {
      logger.error(`[${label}] ${err.message}`);
    }
  };

  try {
    // Provider-owned bootstrap: create the collection if absent and wait until
    // it is queryable. Resolves the effective name from the provider settings.
    await searching.ensureCollection();
    logger.info(`SOLR collection "${(await searching.getSettings()).SOLR_COLLECTION}" ready`);

    // Start clean so re-runs are deterministic.
    await searching.clearIndex('books');
    await searching.clearIndex('people');

    // ── Bulk add ──
    const bulk = await searching.addAll(books, 'books');
    logger.info(`addAll books -> added ${bulk.added}, skipped ${bulk.skipped}`);

    // ── Single add + duplicate detection ──
    const firstAdd = await searching.add('p1', people[0], 'people');
    const dupAdd = await searching.add('p1', people[0], 'people'); // should be false
    logger.info(`add p1 -> ${firstAdd}; duplicate add p1 -> ${dupAdd}`);
    await searching.add('p2', people[1], 'people');
    await searching.add('p3', people[2], 'people');

    // ── Search (default text field) ──
    await demo('search "zen motorcycle" in books', async () =>
      (await searching.search('zen motorcycle', 'books'))
        .map(r => ({ id: r.id, title: r.obj.title, score: r.score }))
    );

    // ── Prefix search ──
    await demo('search "moto" prefix:true in books', async () =>
      (await searching.search('moto', { containerName: 'books', prefix: true }))
        .map(r => ({ id: r.id, title: r.obj.title }))
    );

    // ── combineWith AND ──
    await demo('search "zen archery" combineWith:AND in books', async () =>
      (await searching.search('zen archery', { containerName: 'books', combineWith: 'AND' }))
        .map(r => ({ id: r.id, title: r.obj.title }))
    );

    // ── Client-side filter ──
    await demo('search "zen" filter:fiction in books', async () =>
      (await searching.search('zen', { containerName: 'books', filter: r => r.obj.category === 'fiction' }))
        .map(r => ({ id: r.id, title: r.obj.title, category: r.obj.category }))
    );

    // ── Container isolation ──
    await demo('search "england" in people', async () =>
      (await searching.search('england', 'people'))
        .map(r => ({ id: r.id, name: `${r.obj.firstname} ${r.obj.lastname}` }))
    );

    // ── autoSuggest / suggest ──
    await demo('autoSuggest "neuro" in books', async () =>
      await searching.autoSuggest('neuro', { containerName: 'books' })
    );
    await demo('suggest "mob" in books', async () =>
      await searching.suggest('mob', { containerName: 'books' })
    );

    // ── Replace (upsert) ──
    await searching.replace(
      { id: 1, title: 'Moby Dick: or, The Whale', author: 'Herman Melville', text: 'Updated edition.', category: 'fiction', year: 1851 },
      'books'
    );
    await demo('search "whale" after replace', async () =>
      (await searching.search('whale', 'books')).map(r => ({ id: r.id, title: r.obj.title }))
    );

    // ── Remove / removeAll ──
    const removed = await searching.remove('p3', 'people');
    logger.info(`remove p3 -> ${removed}`);
    const removedBulk = await searching.removeAll(['p1', 'p2'], 'people');
    logger.info(`removeAll [p1,p2] -> removed ${removedBulk.removed}, missing ${removedBulk.missing}`);

    // ── Index management & stats ──
    await demo('listIndexes', async () => await searching.listIndexes());
    await demo('getStats (all)', async () => await searching.getStats());
    await demo('getStats books', async () => await searching.getStats('books'));
    await demo('getIndexStats books', async () => {
      const s = await searching.getIndexStats('books');
      return { searchContainer: s.searchContainer, size: s.size };
    });

    logger.info('SOLR provider demo complete. Browse the dashboard or re-run to repeat.');
  } catch (error) {
    logger.error(`SOLR demo failed: ${error.message}`);
    logger.error('Ensure SOLR is running and reachable at ' + SOLR_URL);
  }
});
