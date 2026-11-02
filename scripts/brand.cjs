// Loads the Gelpy brand from the private @gelpy/design-system package.
//
// The package is an optional dependency: CI installs it with a read-only
// token on pushes and same-repo pull requests. Fork pull requests and local
// checkouts without the token build with the default theme, unless
// GELPY_REQUIRE_BRAND=1 makes a missing package fail the build.
//
// Brand assets are copied into a cache folder under node_modules and served
// as a static directory, so they reach the build output but never the repo.

const fs = require('node:fs');
const path = require('node:path');

const PACKAGE = '@gelpy/design-system';

// Only the files the site needs. Source paths are relative to the package.
const ASSETS = [
  {from: 'assets/logos/logo-primary.svg', to: 'img/brand/logo-primary.svg'},
  {from: 'assets/logos/logo-white.svg', to: 'img/brand/logo-white.svg'},
  {from: 'assets/app-icon/favicon.svg', to: 'img/brand/favicon.svg'},
  {from: 'assets/app-icon/favicon.png', to: 'img/brand/favicon.png'},
];

/** Returns the package root, or null when the package is not installed. */
function findDesignSystem(resolve = require.resolve) {
  try {
    const tokensCss = resolve(`${PACKAGE}/tokens.css`);
    return path.dirname(path.dirname(tokensCss));
  } catch {
    return null;
  }
}

/** Copies the brand assets into cacheDir and returns their site paths. */
function copyAssets(packageDir, cacheDir) {
  fs.rmSync(cacheDir, {recursive: true, force: true});
  for (const asset of ASSETS) {
    const target = path.join(cacheDir, asset.to);
    fs.mkdirSync(path.dirname(target), {recursive: true});
    fs.copyFileSync(path.join(packageDir, asset.from), target);
  }
  return ASSETS.map((asset) => asset.to);
}

/**
 * Prepares the brand for docusaurus.config.js.
 * Returns {enabled: false} when the package is missing and not required.
 */
function loadBrand({siteDir, required = false, resolve} = {}) {
  const packageDir = findDesignSystem(resolve);
  if (!packageDir) {
    if (required) {
      throw new Error(
        `${PACKAGE} is not installed, but GELPY_REQUIRE_BRAND=1 requires it. ` +
          'Install it with a token that can read GitHub Packages.',
      );
    }
    return {enabled: false};
  }
  const staticDir = path.join(siteDir, 'node_modules', '.cache', 'gelpy-brand');
  copyAssets(packageDir, staticDir);
  return {
    enabled: true,
    tokensCss: path.join(packageDir, 'build', 'tokens.css'),
    staticDir,
    favicon: 'img/brand/favicon.svg',
    logo: {
      alt: 'Gelpy',
      src: 'img/brand/logo-primary.svg',
      srcDark: 'img/brand/logo-white.svg',
    },
  };
}

module.exports = {ASSETS, PACKAGE, copyAssets, findDesignSystem, loadBrand};
