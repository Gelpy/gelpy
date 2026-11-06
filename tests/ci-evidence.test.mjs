import {test} from 'node:test';
import assert from 'node:assert/strict';

import {OUT, main, metrics, parseAudit, parseCoverage, parseTests, parseWiki, render, stepsOf} from '../scripts/ci-evidence.mjs';

const TEST_OUTPUT = '# tests 61\n# suites 0\n# pass 61\n# fail 0\n# all files         |  97.10 |    93.20 |  100.00 | \n';

test('stepsOf splits ci:local on &&', () => {
  assert.deepEqual(stepsOf('npm test && npm run build -- --x &&'), [
    {command: 'npm test', argv: ['npm', 'test']},
    {command: 'npm run build -- --x', argv: ['npm', 'run', 'build', '--', '--x']},
  ]);
});

test('the parsers read node --test, npm audit, and build-wiki output', () => {
  assert.deepEqual(parseTests(TEST_OUTPUT), {tests: 61, pass: 61});
  assert.equal(parseTests('nothing'), null);
  assert.deepEqual(parseCoverage(TEST_OUTPUT), {lines: '97.10', branches: '93.20', functions: '100.00'});
  assert.equal(parseCoverage('# all files | 1 |'), null);
  assert.equal(parseCoverage(''), null);
  assert.equal(parseAudit('x\n5 low severity vulnerabilities\n'), '5 low severity vulnerabilities');
  assert.equal(parseAudit('found 0 vulnerabilities'), 'found 0 vulnerabilities');
  assert.equal(parseAudit('clean'), null);
  assert.equal(parseWiki('build-wiki: 16 pages: Home'), 16);
  assert.equal(parseWiki(''), null);
});

test('metrics and render report every step and measure', () => {
  const results = [
    {command: 'npm audit --audit-level=high', status: 0, output: 'found 0 vulnerabilities\n'},
    {command: 'npm test', status: 0, output: TEST_OUTPUT},
    {command: 'node scripts/build-wiki.mjs', status: 0, output: 'build-wiki: 16 pages: Home\n'},
  ];
  assert.deepEqual(metrics(results), {
    tests: {tests: 61, pass: 61},
    coverage: {lines: '97.10', branches: '93.20', functions: '100.00'},
    wiki: 16,
    audit: 'no high or critical advisory (found 0 vulnerabilities)',
  });
  const text = render({head: 'abc', node: 'v22', time: 'now', results, skipped: []});
  assert.match(text, /^## Local PR gate \(`npm run ci:local`\): passed/);
  assert.match(text, /\| Unit tests \| 61 of 61 passed \|/);
  assert.match(text, /\| Coverage of scripts\/ \(lines \/ branches \/ functions\) \| 97\.10% \/ 93\.20% \/ 100\.00% \|/);
  assert.match(text, /\| Wiki pages generated \| 16 \|/);
  const failed = render({head: 'abc', node: 'v22', time: 'now', results: [{command: 'npm audit', status: 1, output: '2 high severity vulnerabilities'}], skipped: [{command: 'npm test'}]});
  assert.match(failed, /FAILED/);
  assert.match(failed, /\| `npm audit` \| \*\*fail\*\* \(exit 1\) \|/);
  assert.match(failed, /\| `npm test` \| not run \|/);
  assert.match(failed, /high or critical advisory found \(2 high severity vulnerabilities\)/);
  assert.match(failed, /\| Unit tests \| not reported \|/);
  assert.equal(metrics([{command: 'npm audit', status: 0, output: ''}]).audit, 'no high or critical advisory');
});

test('main runs the steps, stops at the first failure, and writes the evidence', () => {
  const writes = [];
  const options = {head: () => 'abc', now: () => new Date('2026-11-06T00:00:00Z'), write: (file, text) => writes.push({file, text}), log: () => {}};
  assert.equal(main({...options, script: 'npm test && npm run build', run: () => ({status: 0, output: TEST_OUTPUT})}), 0);
  assert.equal(writes[0].file, OUT);
  assert.match(writes[0].text, /passed/);
  const ran = [];
  assert.equal(main({...options, script: 'a && b && c', run: (step) => (ran.push(step.command), {status: step.command === 'b' ? 4 : 0, output: ''})}), 4);
  assert.deepEqual(ran, ['a', 'b']);
  assert.match(writes[1].text, /\| `c` \| not run \|/);
});
