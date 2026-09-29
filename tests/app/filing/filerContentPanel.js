/**
 * @fileoverview Renders the filing UI's content panel in a real DOM (jsdom) and
 * checks its layout and styling contract.
 *
 * A standalone runner rather than a jest suite: jsdom is present in this repo
 * but `jest-environment-jsdom` is not, and requiring jsdom from inside jest
 * fails on an ESM-only transitive dependency. Run it directly:
 *
 *     node tests/app/filing/filerContentPanel.js
 *
 * WHAT IT GUARDS. The panel is built by script, so nothing here is checked by a
 * compiler and every failure is visual rather than thrown:
 *
 *   - LAYOUT COLLISION. The component appends its listing as a single child of
 *     whatever element the host nominated, and hosts style that element — the
 *     datasources shell sets `display:grid; grid-template-columns:
 *     repeat(auto-fill, minmax(200px,1fr))` on it. The listing then becomes ONE
 *     200px cell of the host's grid and the tiles inside collapse to ~80px,
 *     bunched against the left edge. Nothing errors; the panel just looks wrong.
 *   - INLINE STYLES. Styling via `style.cssText` cannot express hover, cannot
 *     respond to container width, and — being last in the cascade — cannot be
 *     corrected by a host. It is why the folder glyphs rendered solid black
 *     while the navigation tree beside them (which uses CLASSES, and therefore
 *     picks up the host palette) rendered them teal.
 *   - BOOTSTRAP UTILITIES. `display-4`/`text-muted`/`mt-3` only do anything
 *     where the host loads Bootstrap's CSS, which this component does not
 *     require (it depends on Bootstrap Icons for glyphs only).
 *
 * @author NooblyJS Core Team
 * @version 1.0.0
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const LIB = path.resolve(__dirname, '../../../src/filing/scripts/js/index.js');
const source = fs.readFileSync(LIB, 'utf8');

const failures = [];
let checks = 0;
function check(condition, message) {
    checks++;
    if (!condition) failures.push(message);
}

/** Boots a DOM with the filer mounted; `hostStyle` mimics what a host applies. */
function mountFiler(hostStyle = '') {
    const dom = new JSDOM(
        `<!doctype html><html><head></head><body>
            <div id="nav"></div>
            <div id="content" style="${hostStyle}"></div>
        </body></html>`,
        { runScripts: 'outside-only', pretendToBeVisual: true }
    );
    dom.window.eval(source);
    const manager = new dom.window.FilingUIManager({
        navigationContainerId: 'nav',
        contentContainerId: 'content',
    });
    return { window: dom.window, doc: dom.window.document, manager };
}

const ITEMS = [
    { name: 'L2 Administer Employee Benefits', type: 'folder', path: 'a/L2 Administer Employee Benefits' },
    { name: 'L2 Manage Employment', type: 'folder', path: 'a/L2 Manage Employment' },
    { name: 'L2 Plan and Attract', type: 'folder', path: 'a/L2 Plan and Attract' },
    { name: '.home.md', type: 'file', path: 'a/.home.md' },
    { name: 'Report.pdf', type: 'file', path: 'a/Report.pdf', modified: '2026-08-01T00:00:00Z' },
];

// ─── Stylesheet ──────────────────────────────────────────────────────────────
{
    const { window, doc } = mountFiler();
    check(doc.getElementById('kr-filer-content-styles') !== null,
        'stylesheet is injected on construction');

    // A second filer on the same page must not duplicate the sheet.
    // eslint-disable-next-line no-new
    new window.FilingUIManager({ navigationContainerId: 'nav', contentContainerId: 'content' });
    check(doc.querySelectorAll('#kr-filer-content-styles').length === 1,
        'stylesheet is injected exactly once per page');

    const css = doc.getElementById('kr-filer-content-styles').textContent;
    for (const prop of ['--kr-filer-folder', '--kr-filer-file', '--kr-filer-text',
        '--kr-filer-muted', '--kr-filer-hover-bg']) {
        check(css.includes(prop), `palette is themeable: ${prop}`);
    }
    // Every var() supplies a fallback, so an unthemed host still renders.
    const noFallback = css.match(/var\(--kr-filer-[a-z-]+\)/g) || [];
    check(noFallback.length === 0,
        `every var() has a fallback (missing on: ${noFallback.join(', ')})`);

    for (const cls of ['kr-filer-items', 'kr-filer-grid', 'kr-filer-tile', 'kr-filer-tile-icon',
        'kr-filer-tile-name', 'kr-filer-list', 'kr-filer-row', 'kr-filer-row-icon',
        'kr-filer-row-name', 'kr-filer-row-date', 'kr-filer-empty']) {
        check(css.includes(`.${cls}`), `stylesheet declares .${cls}`);
    }

    check(/grid-template-columns:\s*repeat\(auto-fill,\s*minmax\(/.test(css),
        'grid tracks size themselves rather than a fixed column count');
    check(!css.includes('repeat(6, 1fr)'), 'the fixed six-column grid is gone');
}

// ─── The layout collision ────────────────────────────────────────────────────
{
    // Exactly what the datasources shell does to #dsFilingContent.
    const { window, doc, manager } = mountFiler(
        'display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));');

    const container = doc.createElement('div');
    manager.renderGridView(container, ITEMS, '');
    doc.getElementById('content').appendChild(container);

    const styles = window.getComputedStyle(container);
    // Read the SHORTHAND: jsdom applies `grid-column` but does not expand it
    // into gridColumnStart/gridColumnEnd, which report "auto" regardless.
    check(styles.gridColumn === '1 / -1',
        `listing spans every column of a host grid (got "${styles.gridColumn}")`);
    check(styles.width === '100%', `listing fills the container (got ${styles.width})`);
    check(styles.flex === '1 1 100%',
        `listing also fills a host that uses flex (got "${styles.flex}")`);
}

// ─── Grid view ───────────────────────────────────────────────────────────────
{
    const { window, doc, manager } = mountFiler();
    const container = doc.createElement('div');
    manager.renderGridView(container, ITEMS, '');

    const tiles = container.querySelectorAll('.kr-filer-tile');
    check(tiles.length === ITEMS.length, `one tile per item (got ${tiles.length}/${ITEMS.length})`);

    let named = 0;
    let titled = 0;
    tiles.forEach((tile, i) => {
        if (tile.querySelector('.kr-filer-tile-name').textContent === ITEMS[i].name) named++;
        if (tile.title === ITEMS[i].name) titled++;
    });
    check(named === ITEMS.length, 'every tile shows its name');
    check(titled === ITEMS.length, 'the full name stays recoverable via title, however the label clamps');

    const icons = [...container.querySelectorAll('.kr-filer-tile-icon')];
    check(icons.filter((i) => i.classList.contains('kr-is-folder')).length === 3,
        'folders carry the folder modifier');
    check(icons.filter((i) => i.classList.contains('kr-is-file')).length === 2,
        'files carry the file modifier');

    // No hardcoded colour anywhere — that is what made folders black.
    const inlineColoured = [...container.querySelectorAll('*')]
        .filter((el) => /color\s*:/.test(el.getAttribute('style') || ''));
    check(inlineColoured.length === 0,
        `no element hardcodes a colour (${inlineColoured.length} do)`);

    const pdf = [...tiles].find((t) => t.title === 'Report.pdf');
    check(pdf.querySelector('i').className.includes('bi-file-earmark-pdf'),
        'the file glyph follows the extension');

    // Keyboard reachable and activatable.
    const tile = container.querySelector('.kr-filer-tile');
    check(tile.tabIndex === 0 && tile.getAttribute('role') === 'button',
        'tiles are focusable and announced as buttons');

    let opened = null;
    manager.handleFolderItemClick = (item) => { opened = item.name; };
    tile.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    check(opened === 'L2 Administer Employee Benefits', 'Enter opens a tile');

    const seen = [];
    manager.handleFolderItemClick = (i) => seen.push(['folder', i.name]);
    manager.handleFileItemClick = (i) => seen.push(['file', i.name]);
    const all = [...container.querySelectorAll('.kr-filer-tile')];
    all[0].dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    all[3].dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    check(JSON.stringify(seen) === JSON.stringify([
        ['folder', 'L2 Administer Employee Benefits'], ['file', '.home.md'],
    ]), `clicks still route folders and files apart (got ${JSON.stringify(seen)})`);
}

// ─── File viewer ─────────────────────────────────────────────────────────────
{
    // Same host grid that squashed the listing.
    const { window, doc, manager } = mountFiler(
        'display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));');

    manager.parseMarkdown = (md) => `<h1>Application Design</h1><p>${md}</p>`;
    manager.displayMarkdownDocument('Application Design/.home.md', 'Overview: this folder catalogs…');

    const preview = doc.querySelector('.core-file-preview');
    check(preview !== null, 'markdown viewer renders a preview');

    const styles = window.getComputedStyle(preview);
    check(styles.gridColumn === '1 / -1',
        `viewer spans every column of a host grid (got "${styles.gridColumn}")`);
    check(styles.width === '100%', `viewer fills the container (got ${styles.width})`);
    check(styles.display === 'flex' && styles.flexDirection === 'column',
        'viewer is a column so its header pins and its body scrolls');

    const header = preview.querySelector('.core-file-preview-header');
    const body = preview.querySelector('.core-file-preview-content');
    check(header !== null && body !== null, 'viewer has a header and a content region');
    check(window.getComputedStyle(body).overflow === 'auto',
        'the BODY scrolls, not the whole card');
    check(window.getComputedStyle(preview.querySelector('.core-markdown-content')).maxWidth === '78ch',
        'rendered markdown is capped to a readable measure');

    // The header's own classes must not be the only thing styling it: the
    // viewer must look right without Bootstrap's CSS.
    const css = doc.getElementById('kr-filer-content-styles').textContent;
    for (const rule of ['.core-file-preview', '.core-file-preview-header',
        '.core-file-preview-content', '.core-markdown-content', '.binary-file-notice']) {
        check(css.includes(rule), `stylesheet defines ${rule}`);
    }

    // Plain-text and binary paths reuse the same shell.
    manager.displayPlainTextPreview('a/notes.txt', 'hello');
    check(doc.querySelector('.core-file-preview') !== null, 'text viewer reuses the preview shell');
    manager.displayBinaryFileNotice('a/thing.bin');
    check(doc.querySelector('.binary-file-notice') !== null, 'binary notice renders');
}

// ─── Source-level regressions ────────────────────────────────────────────────
check(!/bi-folder display-4 text-muted/.test(source),
    'the empty state no longer relies on Bootstrap utility classes');
check(source.includes('kr-filer-empty'), 'the empty state uses the component\'s own class');
check(!source.includes("color: '#000000'") && !source.includes('color: #000000;'),
    'no solid-black folder glyph remains');

// ─── Report ──────────────────────────────────────────────────────────────────
console.log(`checks run : ${checks}`);
if (failures.length > 0) {
    console.error(`\nFAILED (${failures.length}):`);
    failures.forEach((f) => console.error(`  - ${f}`));
    process.exit(1);
}
console.log('\nPASS — the content panel lays out and themes correctly.');
