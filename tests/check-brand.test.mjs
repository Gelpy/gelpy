import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

import {FORBIDDEN_FILES, main, scanStyle, trackedForbiddenFiles} from '../scripts/check-brand.mjs';

const rulesFor = (text) => scanStyle(text).map((f) => f.rule);

test('token-based styles pass', () => {
  const css = [
    ':root { --ifm-color-primary: var(--gelpy-text-link); }',
    '--ifm-font-family-base: var(--gelpy-font-family-brand);',
    'font-family: var(--gelpy-font-family-brand);',
    'background: color-mix(in srgb, var(--gelpy-text-link) 80%, var(--gelpy-bg-canvas));',
    "selector[href$='#anchor'] { margin: var(--gelpy-space-md); }",
  ].join('\n');
  assert.deepEqual(scanStyle(css), []);
});

test('hard-coded colors are rejected', () => {
  assert.deepEqual(rulesFor('color: #2A35B8;'), ['hex-color']);
  assert.deepEqual(rulesFor('color: #fff;'), ['hex-color']);
  assert.deepEqual(rulesFor('color: rgb(0, 0, 0);'), ['color-function']);
  assert.deepEqual(rulesFor('color: hsl(0 0% 0%);'), ['color-function']);
  assert.deepEqual(rulesFor('color: oklch(0.5 0.1 200);'), ['color-function']);
});

test('hard-coded fonts are rejected', () => {
  assert.deepEqual(rulesFor('font-family: Gilroy, sans-serif;'), ['font-family']);
  assert.deepEqual(rulesFor('font-family:  "Urbanist";'), ['font-family']);
  assert.deepEqual(rulesFor("style={{fontFamily: 'Arial'}}"), ['font-family']);
  assert.deepEqual(rulesFor("@font-face { src: url('x.woff2'); }"), ['font-face']);
});

test('findings report the line', () => {
  const [finding] = scanStyle('a {}\nb { color: #123456; }', 'src/css/x.css');
  assert.deepEqual(finding, {file: 'src/css/x.css', line: 2, rule: 'hex-color', text: '#123456'});
});

test('trackedForbiddenFiles asks git for the forbidden patterns', () => {
  let call;
  const run = (cmd, args, opts) => {
    call = {cmd, args, opts};
    return 'static/brand.pdf\nfonts/Gilroy.woff2\n';
  };
  assert.deepEqual(trackedForbiddenFiles('/repo', run), ['static/brand.pdf', 'fonts/Gilroy.woff2']);
  assert.equal(call.cmd, 'git');
  assert.deepEqual(call.args, ['ls-files', '--', ...FORBIDDEN_FILES]);
  assert.equal(call.opts.cwd, '/repo');
});

function siteTree(css) {
  const root = mkdtempSync(join(tmpdir(), 'check-brand-'));
  mkdirSync(join(root, 'src', 'css'), {recursive: true});
  writeFileSync(join(root, 'src', 'css', 'custom.css'), css);
  writeFileSync(join(root, 'docusaurus.config.js'), 'module.exports = {};\n');
  return root;
}

test('main exits 0 on a clean site and 1 on findings', () => {
  const out = [];
  const err = [];
  const io = {log: (m) => out.push(m), error: (m) => err.push(m)};
  const clean = siteTree(':root { --a: var(--gelpy-text-link); }\n');
  const dirty = siteTree(':root { --a: #F05928; }\n');
  try {
    assert.equal(main({...io, root: clean, run: () => ''}), 0);
    assert.equal(out.at(-1), 'check:brand: 0 findings');

    assert.equal(main({...io, root: dirty, run: () => 'manual.pdf\n'}), 1);
    assert.ok(err.includes('src/css/custom.css:1 brand/hex-color: #F05928'));
    assert.ok(err.includes('manual.pdf:0 brand/forbidden-file: font, manual, or editable source'));
    assert.equal(err.at(-1), 'check:brand: 2 findings');
  } finally {
    rmSync(clean, {recursive: true, force: true});
    rmSync(dirty, {recursive: true, force: true});
  }
});

test('AC-1: this repo tracks no font files, manual, or editables', () => {
  assert.deepEqual(trackedForbiddenFiles(join(import.meta.dirname, '..')), []);
});

test('findings are sorted by line', () => {
  const lines = scanStyle('a { font-family: Arial; }\nb { color: #000; }\nc { color: rgb(0 0 0); }').map((f) => f.line);
  assert.deepEqual(lines, [1, 2, 3]);
});
