#!/usr/bin/env node
// Evidence of the local PR gate (ADR-0018, third amendment, "MVP mode"), ported from the
// gelpy-web pilot. Cloudflare only builds and deploys, so every test runs in
// `npm run ci:local` before a push. This runs the same steps, in order, stopping at the first
// failure as `&&` does, and writes ci-evidence.md (git-ignored) for the agent to post as a PR
// comment: the head, Node, and the time; pass or fail per step; and the test, coverage, wiki,
// and audit results.
// Usage: npm run ci:evidence

import {spawnSync} from 'node:child_process';
import {readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

import {childEnv, resolveCommand} from './lib/fixed-path.mjs';

export const OUT = 'ci-evidence.md';
const NONE = 'not reported';

/** The steps of ci:local: one command per `&&`, split on spaces (the script uses no quoting). */
export function stepsOf(script) {
  return script
    .split('&&')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((command) => ({command, argv: command.split(/\s+/)}));
}

const lineAfter = (text, prefix) =>
  text
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.startsWith(prefix))
    ?.slice(prefix.length)
    .trim();

/** node --test (TAP): "# tests 45" and "# pass 45". */
export function parseTests(text) {
  const tests = lineAfter(text, '# tests ');
  const pass = lineAfter(text, '# pass ');
  return tests && pass ? {tests: Number(tests), pass: Number(pass)} : null;
}

/** node --test coverage: "# all files | 97.10 | 93.20 | 100.00 |". */
export function parseCoverage(text) {
  const row = lineAfter(text, '# all files');
  if (!row) return null;
  const [lines, branches, functions] = row.split('|').map((cell) => cell.trim()).filter(Boolean);
  return functions ? {lines, branches, functions} : null;
}

const isCount = (word) => Boolean(word) && [...word].every((char) => char >= '0' && char <= '9');

/**
 * npm audit: "5 low severity vulnerabilities", or "found 0 vulnerabilities".
 * Plain string scanning, so it runs in linear time (SonarCloud S8786).
 */
export function parseAudit(text) {
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    const at = line.indexOf(' vulnerabilit');
    if (at === -1) continue;
    const words = line.slice(0, at).split(' ');
    const count = words.at(-1) === 'severity' ? words.at(-3) : words.at(-1);
    if (isCount(count)) return line;
  }
  return null;
}

/** build-wiki: "build-wiki: 16 pages: Home, ...". */
export function parseWiki(text) {
  const match = /build-wiki: (\d+) pages/.exec(text);
  return match ? Number(match[1]) : null;
}

export function metrics(results) {
  const of = (marker) => results.find((result) => result.command.includes(marker));
  const text = (result) => result?.output ?? '';
  const audit = of('npm audit');
  const found = parseAudit(text(audit));
  return {
    tests: parseTests(text(of('npm test'))),
    coverage: parseCoverage(text(of('npm test'))),
    wiki: parseWiki(text(of('build-wiki'))),
    audit: audit ? `${audit.status === 0 ? 'no high or critical advisory' : 'high or critical advisory found'}${found ? ` (${found})` : ''}` : null,
  };
}

export function render({head, node, time, results, skipped}) {
  const m = metrics(results);
  const passed = results.every((result) => result.status === 0) && skipped.length === 0;
  return [
    `## Local PR gate (\`npm run ci:local\`): ${passed ? 'passed' : 'FAILED'}`,
    '',
    `- Head: \`${head}\``,
    `- Node: ${node}`,
    `- Run at: ${time} (UTC)`,
    '',
    '| Step | Result |',
    '|---|---|',
    ...results.map((result) => `| \`${result.command}\` | ${result.status === 0 ? 'pass' : `**fail** (exit ${result.status})`} |`),
    ...skipped.map((entry) => `| \`${entry.command}\` | not run |`),
    '',
    '| Measure | Value |',
    '|---|---|',
    `| Unit tests | ${m.tests ? `${m.tests.pass} of ${m.tests.tests} passed` : NONE} |`,
    `| Coverage of scripts/ (lines / branches / functions) | ${m.coverage ? `${m.coverage.lines}% / ${m.coverage.branches}% / ${m.coverage.functions}%` : NONE} |`,
    `| Wiki pages generated | ${m.wiki ?? NONE} |`,
    `| npm audit | ${m.audit ?? NONE} |`,
    '',
  ].join('\n');
}

function defaultRun({argv}) {
  let file;
  try {
    file = resolveCommand(argv[0]);
  } catch (failure) {
    return {status: 127, output: failure.message};
  }
  const result = spawnSync(file, argv.slice(1), {encoding: 'utf8', env: childEnv(), maxBuffer: 256 * 1024 * 1024});
  return {status: result.status ?? 1, output: `${result.stdout ?? ''}${result.stderr ?? ''}`};
}

function defaultHead() {
  const result = spawnSync(resolveCommand('git'), ['rev-parse', 'HEAD'], {encoding: 'utf8', env: childEnv()});
  return (result.stdout ?? '').trim() || 'unknown';
}

export function main({
  script = JSON.parse(readFileSync('package.json', 'utf8')).scripts['ci:local'],
  run = defaultRun,
  head = defaultHead,
  now = () => new Date(),
  write = writeFileSync,
  log = console.log,
} = {}) {
  const steps = stepsOf(script);
  const results = [];
  const finish = (skipped) => write(OUT, render({head: head(), node: process.version, time: now().toISOString(), results, skipped}));
  for (const [index, entry] of steps.entries()) {
    log(`\n▶ ${entry.command}`);
    const {status, output} = run(entry);
    log(output.trimEnd());
    results.push({...entry, status, output});
    if (status !== 0) {
      finish(steps.slice(index + 1));
      log(`\nci-evidence: "${entry.command}" failed (exit ${status}); wrote ${OUT}.`);
      return status;
    }
  }
  finish([]);
  log(`\nci-evidence: ${steps.length} step(s) passed; wrote ${OUT}.`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = main();
}
