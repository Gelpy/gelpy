import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

import {admonitionStart, buildWiki, convertAdmonitions, listDocs, main, pageName, rewriteLinks, splitFrontMatter, writePages} from '../scripts/build-wiki.mjs';
import {scanText} from '../scripts/check-public.mjs';

function site(files) {
  const root = mkdtempSync(join(tmpdir(), 'build-wiki-'));
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(join(root, path, '..'), {recursive: true});
    writeFileSync(join(root, path), text);
  }
  return root;
}

const ES = 'i18n/es/docusaurus-plugin-content-docs/current';

test('pageName maps doc paths to wiki page names', () => {
  assert.equal(pageName('index.md'), 'Home');
  assert.equal(pageName('index.md', 'es-'), 'es-Home');
  assert.equal(pageName('security/overview.md'), 'Security-Overview');
  assert.equal(pageName('architecture/data-flow.md'), 'Architecture-Data-Flow');
  assert.equal(pageName('contributing/documentation_rules.mdx', 'es-'), 'es-Contributing-Documentation-Rules');
  assert.equal(pageName('security/index.md'), 'Security');
});

test('splitFrontMatter strips YAML and reads the title', () => {
  assert.deepEqual(splitFrontMatter('---\nslug: /\ntitle: "Intro"\n---\n\n# Body\n'), {title: 'Intro', body: '# Body\n'});
  assert.deepEqual(splitFrontMatter('---\r\nsidebar_position: 2\r\n---\r\nText\r\n'), {title: null, body: 'Text\n'});
  assert.deepEqual(splitFrontMatter('# No front matter\n'), {title: null, body: '# No front matter\n'});
  assert.deepEqual(splitFrontMatter('---\nunclosed\n'), {title: null, body: '---\nunclosed\n'});
});

test('convertAdmonitions turns notes into block quotes', () => {
  assert.equal(convertAdmonitions('a\n:::note Status\n\nIn progress.\n\n:::\nb'), 'a\n> **Status**\n>\n> In progress.\nb');
  assert.equal(convertAdmonitions(':::warning\nCareful.\n:::'), '> **Warning**\n> Careful.');
  assert.throws(() => convertAdmonitions(':::tip\nOpen'), /not closed/);
  assert.deepEqual(admonitionStart(':::note  Status '), {kind: 'note', title: 'Status'});
  assert.equal(admonitionStart(':::details Title'), null);
  assert.equal(admonitionStart('text'), null);
  assert.equal(convertAdmonitions(':::details\nkept'), ':::details\nkept');
});

test('rewriteLinks maps relative doc links to page names and fails on a missing doc', () => {
  const known = new Set(['index.md', 'security/overview.md', 'architecture/data-flow.md']);
  assert.equal(rewriteLinks('[a](./security/overview.md)', {docPath: 'index.md', prefix: '', known}), '[a](Security-Overview)');
  assert.equal(
    rewriteLinks('[b](../architecture/data-flow.md#flow) [c](https://github.com/Gelpy/gelpy)', {docPath: 'security/overview.md', prefix: 'es-', known}),
    '[b](es-Architecture-Data-Flow#flow) [c](https://github.com/Gelpy/gelpy)',
  );
  assert.throws(() => rewriteLinks('[x](./missing.md)', {docPath: 'index.md', prefix: '', known}), /index\.md links to \.\/missing\.md/);
});

test('buildWiki builds both locales, a sidebar, and a footer', () => {
  const root = site({
    'docs/index.md': '---\ntitle: Introduction\n---\n\n# Gelpy\n\n[Security](./security/overview.md)\n',
    'docs/security/overview.md': '---\ntitle: Security overview\n---\n\n:::note Status\nPlanned.\n:::\n',
    [`${ES}/index.md`]: '---\ntitle: Introducción\n---\n\n[Seguridad](./security/overview.md)\n',
    [`${ES}/security/overview.md`]: '# Seguridad\n',
  });
  try {
    const pages = buildWiki({root});
    assert.deepEqual([...pages.keys()], ['Home', 'Security-Overview', 'es-Home', 'es-Security-Overview', '_Sidebar', '_Footer']);
    assert.equal(pages.get('Home'), '# Gelpy\n\n[Security](Security-Overview)\n');
    assert.equal(pages.get('Security-Overview'), '> **Status**\n> Planned.\n');
    assert.equal(pages.get('es-Home'), '[Seguridad](es-Security-Overview)\n');
    assert.match(pages.get('_Sidebar'), /\*\*English\*\*\n\n- \[Introduction\]\(Home\)\n- \[Security overview\]\(Security-Overview\)/);
    assert.match(pages.get('_Sidebar'), /- \[es-Security-Overview\]\(es-Security-Overview\)/);
    assert.match(pages.get('_Footer'), /change `docs\/` instead/);
  } finally {
    rmSync(root, {recursive: true, force: true});
  }
});

test('buildWiki fails without a Home page or on two docs with one name', () => {
  const noHome = site({'docs/a.md': 'A\n', [`${ES}/a.md`]: 'A\n'});
  const clash = site({'docs/index.md': 'x', 'docs/a-b.md': 'x', 'docs/a/b.md': 'x', [`${ES}/index.md`]: 'x'});
  try {
    assert.throws(() => buildWiki({root: noHome}), /no Home page/);
    assert.throws(() => buildWiki({root: clash}), /Two docs map to the wiki page A-B/);
  } finally {
    rmSync(noHome, {recursive: true, force: true});
    rmSync(clash, {recursive: true, force: true});
  }
});

test('the real docs build into a public-safe wiki', () => {
  const pages = buildWiki();
  assert.ok(pages.has('Home') && pages.has('es-Home'));
  assert.equal(listDocs('docs').length * 2 + 2, pages.size, 'every English page has a Spanish page');
  // Each wiki page is scanned as the doc it mirrors, so a path-scoped check:public exception
  // (Work Item 001-021: the framework's origin page) covers that page's mirror and no other page.
  const sources = new Map([
    ...listDocs('docs').map((doc) => [pageName(doc), `docs/${doc}`]),
    ...listDocs(ES).map((doc) => [pageName(doc, 'es-'), `${ES}/${doc}`]),
  ]);
  for (const [name, text] of pages) {
    assert.deepEqual(scanText(text, sources.get(name) ?? name), [], name);
    assert.doesNotMatch(text, /^:::/m, name);
    assert.doesNotMatch(text, /\]\(\.{1,2}\//, `${name} keeps no relative doc link`);
  }
  assert.equal(sources.get('Framework-Evolution'), 'docs/framework/evolution.md');
  assert.equal(sources.get('es-Framework-Evolution'), `${ES}/framework/evolution.md`);
  assert.notDeepEqual(scanText(pages.get('Framework-Evolution'), 'Framework-Evolution'), [], 'outside its source path the origin page still fails');
});

test('main lists the pages, writes them, and fails on a broken doc', () => {
  const out = mkdtempSync(join(tmpdir(), 'build-wiki-out-'));
  const broken = site({'docs/index.md': '[x](./gone.md)', [`${ES}/index.md`]: 'x'});
  try {
    const log = [];
    assert.equal(main([], {log: (line) => log.push(line)}), 0);
    assert.match(log[0], /^build-wiki: \d+ pages: .*\bHome\b/);
    assert.equal(main([out], {log: () => {}}), 0);
    assert.ok(readdirSync(out).includes('Home.md'));
    const errors = [];
    assert.equal(main([], {root: broken, error: (line) => errors.push(line)}), 1);
    assert.match(errors[0], /^build-wiki: index\.md links to \.\/gone\.md/);
    writePages(new Map([['X', 'y\n']]), join(out, 'nested'));
    assert.equal(readFileSync(join(out, 'nested', 'X.md'), 'utf8'), 'y\n');
  } finally {
    rmSync(out, {recursive: true, force: true});
    rmSync(broken, {recursive: true, force: true});
  }
});

test('admonitionStart stays linear on long adversarial lines (SonarCloud S8786)', () => {
  const start = performance.now();
  const spaces = ' '.repeat(200_000);
  assert.deepEqual(admonitionStart(`:::note${spaces}Title${spaces}`), {kind: 'note', title: 'Title'});
  assert.equal(admonitionStart(`:::${'n'.repeat(200_000)}`), null);
  assert.equal(admonitionStart(`:::note${spaces}`)?.title, '');
  assert.ok(performance.now() - start < 1000, 'well under a second');
});

test('writePages rejects path traversal attacks via page names', () => {
  const out = mkdtempSync(join(tmpdir(), 'build-wiki-security-'));
  try {
    // Test various path traversal patterns that attempt to escape the target directory.
    // The security fix uses relative() to detect when a resolved path escapes baseFull.
    const attacks = [
      ['../etc/passwd', 'simple parent escape'],
      ['../../etc/passwd', 'double parent escape'],
      ['../../../root', 'triple parent escape'],
      ['a/../../b', 'nested traversal'],
      ['valid/../../../etc/passwd', 'deep traversal after valid path'],
      ['./../../sensitive', 'dot-slash traversal'],
      ['a/b/c/../../../../etc/hosts', 'very deep nested escape'],
      ['./../sensitive', 'dot parent traversal'],
      ['subdir/../../../escape', 'subdirectory escape'],
    ];
    
    for (const [name, text] of attacks) {
      assert.throws(
        () => writePages(new Map([[name, text]]), out),
        /Invalid file path/,
        `Should reject path traversal: ${name}`
      );
    }
    
    // Verify no files were written outside the directory
    const files = readdirSync(out);
    assert.equal(files.length, 0, 'No files should be written for rejected paths');
  } finally {
    rmSync(out, {recursive: true, force: true});
  }
});

test('writePages security prevents file inclusion via malicious page names', () => {
  const out = mkdtempSync(join(tmpdir(), 'build-wiki-inclusion-'));
  try {
    // The core security property: the validation prevents writing files outside
    // the target directory by checking if relative(baseFull, target) escapes.
    // This protects against file inclusion attacks where an attacker controls
    // page names to write to arbitrary filesystem locations.
    
    // Verify that attempting to escape the directory is blocked
    assert.throws(
      () => writePages(new Map([['../../../../../../etc/passwd', 'malicious']]), out),
      /Invalid file path/,
      'Should block attempts to write to system files'
    );
    
    // Verify that the directory remains empty - no files escaped
    const files = readdirSync(out);
    assert.equal(files.length, 0, 'No files should be written outside target directory');
  } finally {
    rmSync(out, {recursive: true, force: true});
  }
});

test('writePages allows valid page names and rejects directory escape', () => {
  const out = mkdtempSync(join(tmpdir(), 'build-wiki-valid-'));
  try {
    // Valid page names should work
    writePages(new Map([
      ['Home', 'content'],
      ['Security-Overview', 'content'],
      ['es-Home', 'content'],
    ]), out);
    
    const files = readdirSync(out);
    assert.equal(files.length, 3, 'Valid page names should create files');
    assert.ok(files.includes('Home.md'));
    assert.ok(files.includes('Security-Overview.md'));
    assert.ok(files.includes('es-Home.md'));
    
    // Verify content is correct
    assert.equal(readFileSync(join(out, 'Home.md'), 'utf8'), 'content');
  } finally {
    rmSync(out, {recursive: true, force: true});
  }
});
