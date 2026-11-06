import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

import {
  FALLBACK_COMMITS,
  NOINDEX_HEADERS,
  RELEASE_REPO,
  RELEASE_TIMEOUT_MS,
  brandEnv,
  branchOf,
  changedSinceBase,
  createRelease,
  credentialPresence,
  defaultCapture,
  defaultRun,
  fallbackScope,
  hasSection,
  main,
  previewIsNoindex,
  readVersion,
  runSteps,
  updateWiki,
  withoutSecrets,
  writeNoindexHeaders,
} from '../scripts/workers-builds.mjs';

// Fake values, assembled at runtime so no token-shaped literal is committed.
const RELEASE = ['fake', 'release'].join('-');
const WIKI = ['fake', 'wiki'].join('-');
const CHANGELOG = '# Changelog\n\n## [Unreleased]\n\n## [0.2.0] - 2026-11-06\n\n### Added\n\n- Docs on Workers.\n\n## [0.1.0]\n\n- First.\n';

const response = (status, body = {}) => ({status, json: async () => body});
const quietGit = (outputs = {}) => (args) => {
  const key = args.join(' ');
  for (const [prefix, value] of Object.entries(outputs)) if (key.startsWith(prefix)) return value;
  return {ok: false, out: ''};
};

test('branchOf reads WORKERS_CI_BRANCH or --branch', () => {
  assert.equal(branchOf(['build'], {WORKERS_CI_BRANCH: 'main'}), 'main');
  assert.equal(branchOf(['build', '--branch', 'feature'], {WORKERS_CI_BRANCH: 'main'}), 'feature');
  assert.throws(() => branchOf(['build'], {}), /No branch/);
});

test('credentialPresence prints presence only', () => {
  assert.equal(
    credentialPresence({CLOUDFLARE_API_TOKEN: 'value-not-printed'}),
    'workers-builds: credentials seen by this build: CLOUDFLARE_API_TOKEN present, CLOUDFLARE_ACCOUNT_ID absent.',
  );
});

test('withoutSecrets drops the production secrets only', () => {
  assert.deepEqual(withoutSecrets({GELPY_RELEASE_TOKEN: RELEASE, GELPY_WIKI_TOKEN: WIKI, PATH: '/bin'}), {PATH: '/bin'});
});

test('brandEnv requires the brand in Workers Builds unless overridden', () => {
  assert.deepEqual(brandEnv({WORKERS_CI: '1'}), {GELPY_REQUIRE_BRAND: '1'});
  assert.deepEqual(brandEnv({}), {GELPY_REQUIRE_BRAND: '0'});
  assert.deepEqual(brandEnv({WORKERS_CI: '1', GELPY_REQUIRE_BRAND: '0'}), {GELPY_REQUIRE_BRAND: '0'});
});

test('changedSinceBase finds the merge base, or says why it cannot', () => {
  const full = quietGit({
    'rev-parse --verify': {ok: true, out: ''},
    'merge-base': {ok: true, out: 'abc1234\n'},
    'diff --name-only': {ok: true, out: 'docs/a.md\nREADME.md\n'},
  });
  assert.deepEqual(changedSinceBase(full), {base: 'abc1234', paths: ['docs/a.md', 'README.md'], reason: null});
  const fetches = [];
  const missing = (args) => {
    fetches.push(args[0]);
    return {ok: false, out: ''};
  };
  assert.deepEqual(changedSinceBase(missing), {base: null, paths: null, reason: 'no-base'});
  assert.ok(fetches.includes('fetch'));
  assert.equal(changedSinceBase(quietGit({'rev-parse --verify': {ok: true, out: ''}})).reason, 'no-merge-base');
  assert.equal(changedSinceBase(quietGit({'rev-parse --verify': {ok: true, out: ''}, 'merge-base': {ok: true, out: 'abc\n'}})).reason, 'no-diff');
});

test('fallbackScope says what gitleaks covers without a base', () => {
  assert.match(fallbackScope({shallow: 'true', commits: '1'}), /1 commit\(s\), down to its shallow root/);
  assert.match(fallbackScope({shallow: 'false', commits: '200'}), new RegExp(`last ${FALLBACK_COMMITS} commits only`));
});

test('hasSection finds a released version only', () => {
  assert.equal(hasSection(CHANGELOG, '0.2.0'), true);
  assert.equal(hasSection(CHANGELOG, '0.1.0'), true);
  assert.equal(hasSection(CHANGELOG, '0.3.0'), false);
  assert.equal(hasSection('## [0.10.0]', '0.1.0'), false);
});

test('createRelease creates v<version> at the deployed commit, once', async () => {
  const calls = [];
  const request = async (url, options = {}) => {
    calls.push({url, options});
    return calls.length === 1 ? response(404) : response(201);
  };
  const log = [];
  const status = await createRelease({env: {GELPY_RELEASE_TOKEN: RELEASE, WORKERS_CI_COMMIT_SHA: 'c0ffee'}, version: '0.2.0', changelog: () => CHANGELOG, request, log: (line) => log.push(line)});
  assert.equal(status, 0);
  assert.equal(calls[0].url, `https://api.github.com/repos/${RELEASE_REPO}/releases/tags/v0.2.0`);
  assert.equal(calls[1].options.method, 'POST');
  assert.deepEqual(JSON.parse(calls[1].options.body), {tag_name: 'v0.2.0', target_commitish: 'c0ffee', name: 'gelpy-docs v0.2.0', body: '### Added\n\n- Docs on Workers.\n'});
  assert.equal(calls[1].options.headers.Authorization, `Bearer ${RELEASE}`);
  assert.deepEqual(log, ['workers-builds: released v0.2.0 at c0ffee.']);
  for (const line of log) assert.ok(!line.includes(RELEASE));
});

test('createRelease passes when released, skips without a token or a section, and fails on API errors', async () => {
  const env = {GELPY_RELEASE_TOKEN: RELEASE, WORKERS_CI_COMMIT_SHA: 'c0ffee'};
  const run = async (overrides) => {
    const log = [];
    const status = await createRelease({env, version: '0.2.0', changelog: () => CHANGELOG, log: (line) => log.push(line), ...overrides});
    return {status, log: log.join('\n')};
  };
  assert.deepEqual(await run({request: async () => response(200)}), {status: 0, log: 'workers-builds: v0.2.0 already released.'});
  assert.deepEqual(await run({env: {}, request: () => assert.fail('no call')}), {status: 0, log: 'workers-builds: release skipped: no token.'});
  const unreleased = await run({version: '0.3.0', request: () => assert.fail('no call')});
  assert.equal(unreleased.status, 0);
  assert.match(unreleased.log, /no section for 0\.3\.0 yet; the release PR from release\/v0\.3\.0 adds it/);
  assert.match((await run({changelog: () => '## [0.2.0]\n\n## [0.1.0]\n'})).log, /release failed: CHANGELOG\.md section for 0\.2\.0 is empty/);
  assert.match((await run({changelog: () => assert.fail('io')})).log, /release failed: io/);
  assert.match((await run({request: async () => response(401, {message: 'Bad credentials'})})).log, /release failed: 401 Bad credentials$/);
  assert.match((await run({request: async () => ({status: 500, json: async () => assert.fail('no json')})})).log, /release failed: 500$/);
  let calls = 0;
  const createFails = async () => (++calls === 1 ? response(404) : response(422, {message: 'Validation Failed'}));
  const failed = await run({request: createFails});
  assert.equal(failed.status, 1);
  assert.match(failed.log, /422 Validation Failed/);
  assert.match((await run({env: {GELPY_RELEASE_TOKEN: RELEASE}, request: async () => response(404)})).log, /WORKERS_CI_COMMIT_SHA is not set/);
  assert.match((await run({request: async () => assert.fail('offline')})).log, /release failed: network error: offline/);
  assert.match((await run({request: async () => Promise.reject('down')})).log, /network error: down/);
});

test('updateWiki passes the token as a value and git an environment without secrets', () => {
  const seen = [];
  const sync = (options) => {
    seen.push(options);
    return 0;
  };
  const env = {GELPY_WIKI_TOKEN: WIKI, GELPY_RELEASE_TOKEN: RELEASE, WORKERS_CI_COMMIT_SHA: 'c0ffee', PATH: '/bin'};
  assert.equal(updateWiki({env, build: () => new Map([['Home', 'x']]), sync, log: () => {}}), 0);
  assert.equal(seen[0].token, WIKI);
  assert.equal(seen[0].commit, 'c0ffee');
  assert.deepEqual(seen[0].env, {WORKERS_CI_COMMIT_SHA: 'c0ffee', PATH: '/bin'});
  const log = [];
  assert.equal(updateWiki({env, build: () => assert.fail('broken link'), sync, log: (line) => log.push(line)}), 1);
  assert.deepEqual(log, ['wiki: the pages do not build: broken link']);
  assert.equal(updateWiki({env, build: () => {
    throw 'plain';
  }, sync, log: () => {}}), 1);
});

test('runSteps stops at the first failure and names it', () => {
  const log = [];
  const ran = [];
  const steps = [{name: 'one', cmd: 'a', args: []}, {name: 'two', cmd: 'b', args: ['x']}, {name: 'three', cmd: 'c', args: []}];
  const status = runSteps(steps, {run: (current) => (ran.push(current.name), current.name === 'two' ? 3 : 0), log: (line) => log.push(line), now: () => 0});
  assert.equal(status, 3);
  assert.deepEqual(ran, ['one', 'two']);
  assert.equal(log.at(-1), 'workers-builds: "two" failed with exit code 3.');
  assert.equal(runSteps([], {log: () => {}}), 0);
});

test('defaultRun runs a fixed-path command and reports an unknown one', () => {
  assert.equal(defaultRun({cmd: 'true', args: []}), 0);
  assert.equal(defaultRun({cmd: 'false', args: []}), 1);
  const original = console.error;
  console.error = () => {};
  try {
    assert.equal(defaultRun({cmd: 'no-such-command-gelpy', args: []}), 127);
  } finally {
    console.error = original;
  }
});

test('noindex headers are written and detected', () => {
  const dir = mkdtempSync(join(tmpdir(), 'workers-builds-'));
  try {
    assert.equal(previewIsNoindex(dir), false);
    writeNoindexHeaders(dir);
    assert.equal(previewIsNoindex(dir), true);
    assert.equal(NOINDEX_HEADERS, '/*\n  X-Robots-Tag: noindex\n');
    writeFileSync(join(dir, 'package.json'), '{"version":"1.2.3"}');
    assert.equal(readVersion(join(dir, 'package.json')), '1.2.3');
    assert.equal(readVersion(), JSON.parse(readFileSync('package.json', 'utf8')).version);
  } finally {
    rmSync(dir, {recursive: true, force: true});
  }
});

test('main: usage and missing branch', async () => {
  const log = [];
  assert.equal(await main(['nope'], {log: (line) => log.push(line)}), 2);
  assert.match(log[0], /^Usage/);
  assert.equal(await main(['build'], {env: {}, log: (line) => log.push(line)}), 2);
  assert.match(log[1], /No branch/);
});

test('main build: a PR branch scans, builds, and writes noindex headers', async () => {
  const log = [];
  const ran = [];
  let headers = 0;
  const git = quietGit({
    'rev-parse --is-shallow-repository': {ok: true, out: 'true\n'},
    'rev-list --count': {ok: true, out: '1\n'},
  });
  const env = {WORKERS_CI_BRANCH: 'claude/x', WORKERS_CI: '1', WORKERS_CI_COMMIT_SHA: 'c0ffee'};
  assert.equal(await main(['build'], {env, git, run: (s) => (ran.push(s), 0), log: (line) => log.push(line), headers: () => headers++}), 0);
  assert.deepEqual(ran.map((s) => s.name), ['Install gitleaks (pinned, SHA-256)', 'gitleaks', 'Build (preview, en and es)']);
  assert.ok(ran[1].args.includes(`--log-opts=--max-count=${FALLBACK_COMMITS}`));
  assert.deepEqual(ran[2].env, {GELPY_REQUIRE_BRAND: '1'});
  assert.equal(headers, 1);
  const text = log.join('\n');
  assert.match(text, /PR branch claude\/x, commit c0ffee, shallow clone true, 1 commit\(s\)/);
  assert.match(text, /gitleaks mode: the clone's 1 commit\(s\)/);

  const withBase = quietGit({
    'rev-parse --verify': {ok: true, out: ''},
    'merge-base': {ok: true, out: 'abc1234def\n'},
    'diff --name-only': {ok: true, out: 'docs/a.md\n'},
  });
  const ran2 = [];
  const log2 = [];
  assert.equal(await main(['build', '--branch', 'feature'], {env: {}, git: withBase, run: (s) => (ran2.push(s), 0), log: (line) => log2.push(line), headers: () => {}}), 0);
  assert.ok(ran2[1].args.includes('--log-opts=abc1234def..HEAD'));
  assert.match(log2.join('\n'), /1 path\(s\) changed since origin\/main \(abc1234\); gitleaks mode: abc1234\.\.HEAD/);
  assert.match(log2.join('\n'), /commit unknown, shallow clone unknown, \? commit/);

  let wrote = 0;
  assert.equal(await main(['build', '--branch', 'feature'], {env: {}, git: withBase, run: (s) => (s.name === 'gitleaks' ? 1 : 0), log: () => {}, headers: () => wrote++}), 1);
  assert.equal(wrote, 0, 'no headers after a failure');
});

test('main build: main builds production with the brand required', async () => {
  const ran = [];
  assert.equal(await main(['build'], {env: {WORKERS_CI_BRANCH: 'main', WORKERS_CI: '1'}, git: () => assert.fail('no git'), run: (s) => (ran.push(s), 0), log: () => {}}), 0);
  assert.deepEqual(ran.map((s) => [s.name, s.cmd, ...s.args]), [['Build (production, en and es)', 'npm', 'run', 'build']]);
  assert.deepEqual(ran[0].env, {GELPY_REQUIRE_BRAND: '1'});
});

test('main deploy: main deploys, checks live, releases, and syncs the wiki', async () => {
  const ran = [];
  const order = [];
  const env = {WORKERS_CI_BRANCH: 'main', WORKERS_CI_COMMIT_SHA: 'c0ffee'};
  const request = async () => assert.fail('the release gets the request');
  const release = async (options) => (order.push(['release', options.env === env, options.request === request]), 0);
  const wiki = (options) => (order.push(['wiki', options.env === env]), 0);
  assert.equal(await main(['deploy'], {env, run: (s) => (ran.push(s), order.push(s.name), 0), log: () => {}, request, release, wiki}), 0);
  assert.deepEqual(ran.map((s) => [s.cmd, ...s.args].join(' ')), [
    'npx wrangler deploy --config wrangler.jsonc',
    'node scripts/check-public.mjs --live https://docs.gelpy.app',
  ]);
  assert.deepEqual(order.slice(2), [['release', true, true], ['wiki', true]], 'release, then wiki, after the live check');

  const both = [];
  assert.equal(await main(['deploy'], {env, run: () => 0, log: () => {}, release: async () => (both.push('release'), 1), wiki: () => (both.push('wiki'), 0)}), 1);
  assert.deepEqual(both, ['release', 'wiki'], 'a failed release still syncs the wiki, and the build is red');
  assert.equal(await main(['deploy'], {env, run: () => 0, log: () => {}, release: async () => 0, wiki: () => 1}), 1);

  let after = 0;
  assert.equal(await main(['deploy'], {env, run: () => 7, log: () => {}, release: async () => after++, wiki: () => after++}), 7);
  assert.equal(after, 0, 'a failed deploy or live check releases nothing and syncs nothing');
});

test('main deploy: other branches never deploy', async () => {
  const log = [];
  assert.equal(await main(['deploy', '--branch', 'feature'], {env: {}, run: () => assert.fail('no run'), log: (line) => log.push(line)}), 1);
  assert.deepEqual(log, ['workers-builds: only main deploys; feature does not.']);
});

test('main preview: PR branches preview only with noindex; main never previews', async () => {
  const ran = [];
  const withUrl = 'Preview: feature (updated)\nhttps://feature-gelpy-docs.example.workers.dev\n';
  assert.equal(await main(['preview', '--branch', 'feature'], {env: {}, capture: (s) => (ran.push(s), {status: 0, output: withUrl}), log: () => {}, noindex: () => true}), 0);
  assert.deepEqual(ran.map((s) => [s.cmd, ...s.args].join(' ')), ['npx wrangler preview --config wrangler.jsonc']);
  const log = [];
  assert.equal(await main(['preview', '--branch', 'feature'], {env: {}, capture: () => assert.fail('no run'), log: (line) => log.push(line), noindex: () => false}), 1);
  assert.match(log[0], /no X-Robots-Tag: noindex/);
  assert.equal(await main(['preview', '--branch', 'main'], {env: {}, capture: () => assert.fail('no run'), log: () => {}}), 0);
});

test('main preview: red when wrangler uploads a preview with no URL, or fails', async () => {
  const log = [];
  const noUrl = 'Preview: feature (updated)\nNote: This Preview deployment has no active URLs.\n';
  assert.equal(await main(['preview', '--branch', 'feature'], {env: {}, capture: () => ({status: 0, output: noUrl}), log: (line) => log.push(line), noindex: () => true}), 1);
  assert.match(log.at(-1), /reports no active URLs; turn on the Worker's Preview URLs setting/);
  assert.equal(await main(['preview', '--branch', 'feature'], {env: {}, capture: () => ({status: 3, output: 'boom'}), log: () => {}, noindex: () => true}), 3);
});

test('defaultCapture echoes and returns the output, and reports an unknown command', () => {
  const out = [];
  const err = [];
  const sink = {stdout: {write: (text) => out.push(text)}, stderr: {write: (text) => err.push(text)}};
  assert.deepEqual(defaultCapture({cmd: 'node', args: ['-e', 'console.log("hi"); console.error("warn")']}, sink), {status: 0, output: 'hi\nwarn\n'});
  assert.deepEqual([out.join(''), err.join('')], ['hi\n', 'warn\n']);
  const missing = defaultCapture({cmd: 'no-such-command-gelpy', args: []}, sink);
  assert.equal(missing.status, 127);
  assert.match(missing.output, /no-such-command-gelpy is not in/);
  assert.equal(defaultCapture({cmd: 'false', args: []}, sink).status, 1);
});

test('createRelease times out a stalled GitHub API and fails red (real fetch, local server)', async () => {
  const {createServer} = await import('node:http');
  const server = createServer((req, res) => {
    res.writeHead(404, {'content-type': 'application/json'});
    res.write('{"mess');
    // Never ends the body: only the timeout can finish this request.
  });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  const local = `http://127.0.0.1:${server.address().port}`;
  const signals = [];
  const request = (url, options) => (signals.push(options.signal), globalThis.fetch(local, options));
  const log = [];
  const start = Date.now();
  try {
    const status = await createRelease({env: {GELPY_RELEASE_TOKEN: RELEASE, WORKERS_CI_COMMIT_SHA: 'c0ffee'}, version: '0.2.0', changelog: () => CHANGELOG, request, log: (line) => log.push(line), timeoutMs: 200});
    assert.equal(status, 1);
  } finally {
    server.closeAllConnections();
    server.close();
  }
  assert.ok(Date.now() - start < 5000, 'a 200 ms timeout, not a hang');
  assert.ok(signals.length >= 1 && signals.every((signal) => signal instanceof AbortSignal));
  // The stalled error body is aborted inside apiError, which then reports the status alone.
  assert.equal(log.at(-1), 'workers-builds: deployed, but the release failed: 404');
});

test('createRelease sends an abort signal on both the lookup and the creation', async () => {
  const signals = [];
  let calls = 0;
  const request = async (url, options) => (signals.push(options.signal), ++calls === 1 ? response(404) : response(201));
  assert.equal(await createRelease({env: {GELPY_RELEASE_TOKEN: RELEASE, WORKERS_CI_COMMIT_SHA: 'c0ffee'}, version: '0.2.0', changelog: () => CHANGELOG, request, log: () => {}}), 0);
  assert.equal(signals.length, 2);
  assert.ok(signals.every((signal) => signal instanceof AbortSignal && !signal.aborted));
  assert.equal(RELEASE_TIMEOUT_MS, 15_000);
});

test('wrangler and live-check steps carry a kill timeout, and a stalled step is killed red', async () => {
  const {deploySteps, PREVIEW, WRANGLER_TIMEOUT_MS, LIVE_CHECK_TIMEOUT_MS} = await import('../scripts/workers-builds.mjs');
  assert.equal(WRANGLER_TIMEOUT_MS, 300_000);
  assert.equal(LIVE_CHECK_TIMEOUT_MS, 720_000);
  assert.deepEqual(deploySteps().map((s) => s.timeoutMs), [WRANGLER_TIMEOUT_MS, LIVE_CHECK_TIMEOUT_MS]);
  assert.equal(PREVIEW.timeoutMs, WRANGLER_TIMEOUT_MS);

  const stall = {cmd: 'node', args: ['-e', 'setTimeout(() => {}, 30000)'], timeoutMs: 300};
  const errors = [];
  const original = console.error;
  console.error = (line) => errors.push(line);
  let start = Date.now();
  try {
    assert.equal(defaultRun(stall), 1);
  } finally {
    console.error = original;
  }
  assert.ok(Date.now() - start < 5000, 'killed at the timeout, not after 30 s');
  assert.deepEqual(errors, ['workers-builds: node was killed after 0.3 s.']);

  const err = [];
  start = Date.now();
  const captured = defaultCapture(stall, {stdout: {write: () => {}}, stderr: {write: (text) => err.push(text)}});
  assert.equal(captured.status, 1);
  assert.ok(Date.now() - start < 5000);
  assert.deepEqual(err.filter(Boolean), ['workers-builds: node was killed after 0.3 s.\n']);
});
