#!/usr/bin/env node
// Scopes a hosted app's stylesheet under [data-module="<name>"] (noobly structure.md §2a). A one-off porting tool:
//   node node_modules/nooblyjs-core/scripts/scope-css.js in.css [more.css …] --module teammates > public/css/teammates.css
// Several inputs are joined in order. Dropped @import/@font-face rules are reported on stderr.
'use strict';

const fs = require('node:fs');
const { scopeCss } = require('../src/shell/css-scope');

const args = process.argv.slice(2);
const at = args.indexOf('--module');
const name = at === -1 ? null : args[at + 1];
const files = args.filter((a, i) => i !== at && i !== at + 1);
if (!name || !/^[a-z][a-z0-9-]*$/.test(name) || !files.length) {
  process.stderr.write('usage: scope-css.js <file.css> [more.css …] --module <name>\n');
  process.exit(2);
}
const css = files.map((f) => `/* ---- ${f} ---- */\n${fs.readFileSync(f, 'utf8')}`).join('\n\n');
process.stdout.write(scopeCss(css, name, { onDropped: (text) => process.stderr.write(`dropped: ${text.slice(0, 80)}\n`) }));
