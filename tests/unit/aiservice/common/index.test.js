import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as common from '../../../../src/aiservice/common/index.js';
import { costOf } from '../../../../src/aiservice/common/cost.js';
import pkg from '../../../../src/aiservice/common/package.json' with { type: 'json' };

// The tests live outside the package folder, so they can't import it by name. Each export
// target is resolved from the package.json that declares it instead.
const packageUrl = new URL('../../../../src/aiservice/common/package.json', import.meta.url);

test('the package entry and every subpath export resolve', async () => {
  assert.equal(common.costOf, costOf);
  for (const [subpath, target] of Object.entries(pkg.exports)) {
    if (subpath === '.' || subpath.endsWith('.json')) continue;
    const mod = await import(new URL(target, packageUrl).href);
    assert.ok(Object.keys(mod).length, `${subpath} exports something`);
    // One adapter's internals (buildRequest…) stay under its own subpath; everything else is in the main entry too.
    if (subpath.startsWith('./providers/')) continue;
    for (const [name, value] of Object.entries(mod)) assert.equal(common[name], value, `${subpath} ${name} is in the main entry`);
  }
});
