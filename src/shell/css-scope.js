/**
 * @fileoverview CSS scoping for hosted apps (noobly structure.md §2a): every app shares one page, so every selector in
 * an app's stylesheet must start with [data-module="<name>"]. `scopeCss()` rewrites a stylesheet that way (used once,
 * when an app's old global CSS is ported into the frame), and `unscopedSelectors()` finds the selectors that don't
 * (each hosted app's tests call it, so the rule stays true).
 *
 *   node node_modules/nooblyjs-core/scripts/scope-css.js public/css/old.css --module teammates > public/css/teammates.css
 *
 * Rules: `:root`, `html` and `body` become the scope itself (so custom properties and base type apply inside the
 * app's content only); every other selector gets the scope as an ancestor; selectors inside @media, @supports,
 * @container and @layer are scoped too; @keyframes names are left alone (prefix them yourself); @import and
 * @font-face are dropped with a warning, because fonts and imports belong to the UI kit.
 *
 * @since 1.0.12
 */

'use strict';

const scopeOf = (name) => `[data-module="${name}"]`;
const GROUPING = /^@(media|supports|container|layer|document)\b/i;
const VERBATIM = /^@(-webkit-)?keyframes\b|^@page\b|^@property\b/i;
const DROPPED = /^@(import|font-face|charset|namespace)\b/i;

/** Splits on commas that aren't inside (), [] or strings. */
function splitSelectors(text) {
  const parts = [];
  let depth = 0;
  let quote = null;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = null;
    } else if (c === '"' || c === "'") quote = c;
    else if (c === '(' || c === '[') depth++;
    else if (c === ')' || c === ']') depth--;
    else if (c === ',' && depth === 0) {
      parts.push(text.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(text.slice(start));
  return parts.map((p) => p.trim()).filter(Boolean);
}

/** One selector, scoped. `:root`/`html`/`body` at the start become the scope; `*` and `::x` stay inside it. */
function scopeSelector(selector, scope) {
  if (selector.startsWith(scope)) return selector;
  const m = /^(:root|html|body)(?![\w-])\s*/i.exec(selector);
  if (m) {
    const rest = selector.slice(m[0].length);
    const tail = selector.slice(m[1].length);
    // "body.x .y" or "body:not(.x) .y" keep the condition on the scope; "body .y" means a descendant of it.
    if (!rest) return scope;
    if (/^[.:[]/.test(tail)) return `${scope}${tail}`;
    return `${scope} ${rest}`;
  }
  return `${scope} ${selector}`;
}

/** Finds the matching close brace for the block that opens at `open`. Skips strings and comments. */
function blockEnd(css, open) {
  let depth = 0;
  let quote = null;
  for (let i = open; i < css.length; i++) {
    const c = css[i];
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'") quote = c;
    else if (c === '/' && css[i + 1] === '*') i = css.indexOf('*/', i + 2) + 1 || css.length;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return i;
  }
  return css.length - 1;
}

/** The first `;` or `{` at or after `from` that isn't inside a string, parentheses or a comment (-1 if none). */
function nextStop(css, from) {
  let depth = 0;
  let quote = null;
  for (let i = from; i < css.length; i++) {
    const c = css[i];
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = null;
    } else if (c === '"' || c === "'") quote = c;
    else if (c === '/' && css[i + 1] === '*') i = (css.indexOf('*/', i + 2) + 1) || css.length;
    else if (c === '(') depth++;
    else if (c === ')') depth--;
    else if (depth === 0 && (c === ';' || c === '{')) return i;
  }
  return -1;
}

/** Walks a stylesheet: `onRule(selectorText, body)` returns the replacement for each style rule. */
function walk(css, onRule, onDropped = () => {}) {
  let out = '';
  let i = 0;
  while (i < css.length) {
    // Comments and whitespace pass through as they are.
    const ws = /^(\s+|\/\*[\s\S]*?\*\/)/.exec(css.slice(i));
    if (ws) {
      out += ws[0];
      i += ws[0].length;
      continue;
    }
    const stop = nextStop(css, i);
    if (stop === -1) {
      out += css.slice(i);
      break;
    }
    // A statement at-rule (@import url('…;…');) ends at its own semicolon, not one inside the URL.
    if (css[stop] === ';') {
      const statement = css.slice(i, stop + 1);
      if (DROPPED.test(statement.trim())) onDropped(statement.trim());
      else out += statement;
      i = stop + 1;
      continue;
    }
    const brace = stop;
    const prelude = css.slice(i, brace).trim();
    const end = blockEnd(css, brace);
    const body = css.slice(brace + 1, end);
    if (GROUPING.test(prelude)) out += `${prelude} {${walk(body, onRule, onDropped)}}`;
    else if (VERBATIM.test(prelude)) out += `${prelude} {${body}}`;
    else if (DROPPED.test(prelude)) onDropped(prelude);
    else out += onRule(prelude, body);
    i = end + 1;
  }
  return out;
}

/**
 * @param {string} css   the stylesheet
 * @param {string} name  the app's name, e.g. 'teammates'
 * @param {{ onDropped?: (text: string) => void, drop?: (selector: string) => boolean }} [options]
 *   `drop` leaves out selectors the frame makes obsolete (an old sidebar or header); a rule left with none goes too
 * @returns {string} the stylesheet with every selector under [data-module="<name>"]
 */
function scopeCss(css, name, { onDropped, drop = () => false } = {}) {
  const scope = scopeOf(name);
  return walk(css, (prelude, body) => {
    const kept = splitSelectors(prelude).filter((s) => !drop(s));
    return kept.length ? `${kept.map((s) => scopeSelector(s, scope)).join(',\n')} {${body}}` : '';
  }, onDropped);
}

/** The selectors in `css` that don't start with [data-module="<name>"]. Empty means the stylesheet is safe to share. */
function unscopedSelectors(css, name) {
  const scope = scopeOf(name);
  const bad = [];
  walk(css, (prelude) => {
    for (const s of splitSelectors(prelude)) if (!s.startsWith(scope)) bad.push(s);
    return '';
  }, (text) => bad.push(text));
  return bad;
}

module.exports = { scopeCss, unscopedSelectors, splitSelectors };
