#!/usr/bin/env node
// Builds the GitHub wiki of Gelpy/gelpy from the docs (Work Item 004-002).
//
// `docs/` is the source and the wiki is a generated mirror (AGENTS.md). Each
// English page becomes a wiki page named after its path (docs/index.md is
// Home, docs/security/overview.md is Security-Overview), and each Spanish page
// gets the same name with an `es-` prefix. The builder strips front matter,
// turns Docusaurus admonitions into block quotes, and rewrites relative doc
// links to wiki page names. A link to a doc that does not exist fails the
// build, as the Docusaurus build does. `_Sidebar` lists every page and
// `_Footer` says where to edit.
//
// Usage: node scripts/build-wiki.mjs [out-dir]
// Without out-dir it only lists the page names it would write.

import {mkdirSync, readdirSync, readFileSync, statSync, writeFileSync} from 'node:fs';
import {join, posix, relative, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

export const LOCALES = [
  {id: 'en', dir: 'docs', prefix: '', label: 'English'},
  {id: 'es', dir: 'i18n/es/docusaurus-plugin-content-docs/current', prefix: 'es-', label: 'Español'},
];

export const SOURCE_REPO = 'https://github.com/Gelpy/gelpy';

const capitalize = (word) => word.charAt(0).toUpperCase() + word.slice(1);

/** The wiki page name of a doc path relative to its locale root, e.g. security/overview.md. */
export function pageName(docPath, prefix = '') {
  const parts = docPath.replace(/\.mdx?$/, '').split('/');
  if (parts.at(-1) === 'index') parts.pop();
  const name = parts.length === 0 ? 'Home' : parts.flatMap((part) => part.split(/[-_ ]+/)).map(capitalize).join('-');
  return `${prefix}${name}`;
}

/** Splits YAML front matter from the body and reads its title. */
export function splitFrontMatter(text) {
  const normalized = text.replace(/\r\n/g, '\n');
  if (!normalized.startsWith('---\n')) return {title: null, body: normalized};
  const end = normalized.indexOf('\n---\n', 4);
  if (end === -1) return {title: null, body: normalized};
  const header = normalized.slice(4, end);
  const title = header.split('\n').find((line) => line.startsWith('title:'));
  return {
    title: title ? title.slice('title:'.length).trim().replace(/^(['"])(.*)\1$/, '$2') : null,
    body: normalized.slice(end + 5).replace(/^\n+/, ''),
  };
}

const ADMONITIONS = new Set(['note', 'tip', 'info', 'warning', 'danger', 'caution']);

/**
 * Reads an admonition's opening line, `:::note` or `:::note Title`, or returns
 * null. Plain string scanning, so it runs in linear time (SonarCloud S8786).
 */
export function admonitionStart(line) {
  if (!line.startsWith(':::')) return null;
  const rest = line.slice(3);
  const cut = rest.indexOf(' ');
  const kind = cut === -1 ? rest : rest.slice(0, cut);
  if (!ADMONITIONS.has(kind)) return null;
  return {kind, title: cut === -1 ? '' : rest.slice(cut + 1).trim()};
}

/** Turns `:::note Title` ... `:::` blocks into block quotes with a bold title. */
export function convertAdmonitions(body) {
  const out = [];
  let open = false;
  for (const line of body.split('\n')) {
    const start = admonitionStart(line);
    if (!open && start) {
      open = true;
      out.push(`> **${start.title || capitalize(start.kind)}**`);
    } else if (open && line === ':::') {
      open = false;
      while (out.at(-1) === '>') out.pop();
    } else if (open) {
      out.push(line ? `> ${line}` : '>');
    } else {
      out.push(line);
    }
  }
  if (open) throw new Error('An admonition is not closed with :::.');
  return out.join('\n');
}

/**
 * Rewrites relative links to other docs, like ](../security/overview.md#x),
 * to wiki page names. `known` holds every doc path of the locale.
 */
export function rewriteLinks(body, {docPath, prefix, known}) {
  return body.replace(/\]\((\.{1,2}\/[^)\s#]+\.mdx?)(#[^)\s]*)?\)/g, (match, target, anchor = '') => {
    const resolved = posix.normalize(posix.join(posix.dirname(docPath), target));
    if (!known.has(resolved)) {
      throw new Error(`${docPath} links to ${target}, which is not a doc.`);
    }
    return `](${pageName(resolved, prefix)}${anchor})`;
  });
}

/** Lists the Markdown files under dir, relative to it, in a stable order. */
export function listDocs(dir) {
  const files = [];
  const walk = (current) => {
    for (const entry of readdirSync(current).sort()) {
      const path = join(current, entry);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.mdx?$/.test(entry)) files.push(relative(dir, path).split('\\').join('/'));
    }
  };
  walk(dir);
  return files;
}

function sidebar(groups) {
  const lines = [];
  for (const {label, pages} of groups) {
    lines.push(`**${label}**`, '');
    const ordered = [...pages].sort((a, b) => Number(b.name.endsWith('Home')) - Number(a.name.endsWith('Home')));
    for (const page of ordered) lines.push(`- [${page.title}](${page.name})`);
    lines.push('');
  }
  return lines.join('\n');
}

/** Builds every wiki page. Returns a Map of page name to Markdown, in a stable order. */
export function buildWiki({root = process.cwd(), read = (path) => readFileSync(path, 'utf8'), list = listDocs} = {}) {
  const pages = new Map();
  const groups = [];
  for (const locale of LOCALES) {
    const base = resolve(root, locale.dir);
    const docs = list(base);
    const known = new Set(docs);
    const group = {label: locale.label, pages: []};
    for (const docPath of docs) {
      const name = pageName(docPath, locale.prefix);
      if (pages.has(name)) throw new Error(`Two docs map to the wiki page ${name}.`);
      const {title, body} = splitFrontMatter(read(join(base, docPath)));
      pages.set(name, `${rewriteLinks(convertAdmonitions(body), {docPath, prefix: locale.prefix, known}).trimEnd()}\n`);
      group.pages.push({name, title: title ?? name});
    }
    groups.push(group);
  }
  if (!pages.has('Home')) throw new Error('docs/index.md is missing, so the wiki would have no Home page.');
  pages.set('_Sidebar', sidebar(groups));
  pages.set('_Footer', `Generated from \`docs/\` in [Gelpy/gelpy](${SOURCE_REPO}). Edits made here are overwritten on the next deploy; change \`docs/\` instead.\n`);
  return pages;
}

/** Writes the pages as <name>.md files into dir. */
export function writePages(pages, dir) {
  mkdirSync(dir, {recursive: true});
  for (const [name, text] of pages) writeFileSync(join(dir, `${name}.md`), text);
}

export function main(args = process.argv.slice(2), {root = process.cwd(), log = console.log, error = console.error} = {}) {
  let pages;
  try {
    pages = buildWiki({root});
  } catch (failure) {
    error(`build-wiki: ${failure.message}`);
    return 1;
  }
  const [outDir] = args;
  if (outDir) writePages(pages, resolve(root, outDir));
  log(`build-wiki: ${pages.size} pages${outDir ? ` written to ${outDir}` : ''}: ${[...pages.keys()].join(', ')}`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = main();
}
