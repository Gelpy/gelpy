import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

import {buildWiki, convertAdmonitions, listDocs, main, pageName, rewriteLinks, splitFrontMatter, writePages} from '../scripts/build-wiki.mjs';
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
  for (const [name, text] of pages) {
    assert.deepEqual(scanText(text, name), [], name);
    assert.doesNotMatch(text, /^:::/m, name);
    assert.doesNotMatch(text, /\]\(\.{1,2}\//, `${name} keeps no relative doc link`);
  }
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
