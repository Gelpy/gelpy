import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {existsSync, mkdtempSync, mkdirSync, readdirSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const require = createRequire(import.meta.url);
const {ASSETS, PACKAGE, copyAssets, findDesignSystem, loadBrand} = require('../scripts/brand.cjs');

const missing = () => {
  throw Object.assign(new Error('Cannot find module'), {code: 'MODULE_NOT_FOUND'});
};

// A fake package with the same layout as @gelpy/design-system.
function fakePackage() {
  const root = mkdtempSync(join(tmpdir(), 'brand-'));
  const pkg = join(root, 'pkg');
  mkdirSync(join(pkg, 'build'), {recursive: true});
  writeFileSync(join(pkg, 'build', 'tokens.css'), ':root{}\n');
  for (const asset of ASSETS) {
    mkdirSync(join(pkg, asset.from, '..'), {recursive: true});
    writeFileSync(join(pkg, asset.from), `<svg>${asset.from}</svg>`);
  }
  // An asset the site does not need; it must not be copied.
  mkdirSync(join(pkg, 'assets', 'emojis'), {recursive: true});
  writeFileSync(join(pkg, 'assets', 'emojis', 'feliz.svg'), '<svg/>');
  const resolve = (spec) => {
    assert.equal(spec, `${PACKAGE}/tokens.css`);
    return join(pkg, 'build', 'tokens.css');
  };
  return {root, pkg, resolve};
}

test('findDesignSystem returns null when the package is missing', () => {
  assert.equal(findDesignSystem(missing), null);
});

test('loadBrand falls back to the default theme when not required', () => {
  assert.deepEqual(loadBrand({siteDir: '/nowhere', resolve: missing}), {enabled: false});
});

test('loadBrand fails when the brand is required and missing', () => {
  assert.throws(
    () => loadBrand({siteDir: '/nowhere', required: true, resolve: missing}),
    /GELPY_REQUIRE_BRAND=1 requires it/,
  );
});

test('loadBrand copies only the needed assets outside the repo', () => {
  const {root, pkg, resolve} = fakePackage();
  try {
    const brand = loadBrand({siteDir: root, required: true, resolve});
    assert.equal(brand.enabled, true);
    assert.equal(brand.tokensCss, join(pkg, 'build', 'tokens.css'));
    assert.equal(brand.staticDir, join(root, 'node_modules', '.cache', 'gelpy-brand'));
    assert.equal(brand.favicon, 'img/brand/favicon.svg');
    assert.deepEqual(brand.logo, {
      alt: 'Gelpy',
      src: 'img/brand/logo-primary.svg',
      srcDark: 'img/brand/logo-white.svg',
    });
    for (const asset of ASSETS) assert.ok(existsSync(join(brand.staticDir, asset.to)), asset.to);
    assert.deepEqual(readdirSync(join(brand.staticDir, 'img', 'brand')).sort(), [
      'favicon.png',
      'favicon.svg',
      'logo-primary.svg',
      'logo-white.svg',
    ]);
  } finally {
    rmSync(root, {recursive: true, force: true});
  }
});

test('copyAssets replaces a stale cache', () => {
  const {root, pkg} = fakePackage();
  const cache = join(root, 'cache');
  try {
    mkdirSync(cache, {recursive: true});
    writeFileSync(join(cache, 'stale.txt'), 'old');
    const copied = copyAssets(pkg, cache);
    assert.deepEqual(copied, ASSETS.map((a) => a.to));
    assert.ok(!existsSync(join(cache, 'stale.txt')));
  } finally {
    rmSync(root, {recursive: true, force: true});
  }
});
