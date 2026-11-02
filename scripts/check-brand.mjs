#!/usr/bin/env node
// Brand lint for the docs site.
//
// Fails when site code hard-codes a color or a font family instead of using
// @gelpy/design-system tokens, or when the repo tracks a font file, a brand
// manual, or an editable design source.
//
// Usage: node scripts/check-brand.mjs

import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';

import {collectFiles} from './check-public.mjs';

// Site code that styles or configures the theme.
export const STYLE_TARGETS = ['src', 'docusaurus.config.js'];

// AC-1 of Work Item 005-007: none of these may be tracked in this public repo.
export const FORBIDDEN_FILES = ['*.ttf', '*.otf', '*.woff', '*.woff2', '*.ai', '*.pdf', '*.eot'];

export const STYLE_RULES = [
  {id: 'hex-color', re: /#[0-9a-f]{3,8}\b(?![-\w])/gi},
  {id: 'color-function', re: /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(/gi},
  {id: 'font-family', re: /font-family\s*:(?!\s*var\(--gelpy-)[^;]+/gi},
  {id: 'font-family', re: /\bfontFamily\b/g},
  {id: 'font-face', re: /@font-face/gi},
];

function lineOf(text, index) {
  return text.slice(0, index).split('\n').length;
}

/** Scans one text for hard-coded colors or fonts. */
export function scanStyle(text, file = '<text>') {
  const findings = [];
  for (const rule of STYLE_RULES) {
    rule.re.lastIndex = 0;
    for (const match of text.matchAll(rule.re)) {
      findings.push({file, line: lineOf(text, match.index), rule: rule.id, text: match[0].trim()});
    }
  }
  return findings.sort((a, b) => a.line - b.line);
}

/** Lists tracked files that match FORBIDDEN_FILES. */
export function trackedForbiddenFiles(root = process.cwd(), run = execFileSync) {
  const output = run('git', ['ls-files', '--', ...FORBIDDEN_FILES], {cwd: root, encoding: 'utf8'});
  return output.split('\n').filter(Boolean);
}

export function main({root = process.cwd(), log = console.log, error = console.error, run} = {}) {
  const findings = [];
  for (const file of collectFiles(STYLE_TARGETS, root)) {
    const relative = file.slice(resolve(root).length + 1);
    findings.push(...scanStyle(readFileSync(file, 'utf8'), relative));
  }
  for (const file of trackedForbiddenFiles(root, run)) {
    findings.push({file, line: 0, rule: 'forbidden-file', text: 'font, manual, or editable source'});
  }
  for (const f of findings) error(`${f.file}:${f.line} brand/${f.rule}: ${f.text}`);
  const summary = `check:brand: ${findings.length} findings`;
  if (findings.length > 0) {
    error(summary);
    return 1;
  }
  log(summary);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = main();
}
