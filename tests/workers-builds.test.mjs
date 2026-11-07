import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
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
  deployScanRange,
  releaseIntent,
  resolveTag,
  timedCommand,
  MAX_TAG_DEPTH,
  TIMED_OUT,
  credentialPresence,
  defaultCapture,
  defaultRun,
  fallbackScope,
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
// A git whose HEAD and HEAD^1 carry the given package.json versions (null: unreadable).
const versionGit = (head, parent, {hasParent = true} = {}) => (args) => {
  const key = args.join(' ');
  if (key === 'rev-parse --verify --quiet HEAD^1') return {ok: hasParent, out: ''};
  if (key === 'show HEAD:package.json') return head === null ? {ok: false, out: ''} : {ok: true, out: JSON.stringify({version: head})};
  if (key === 'show HEAD^1:package.json') return parent === null ? {ok: false, out: ''} : {ok: true, out: JSON.stringify({version: parent})};
  return {ok: false, out: ''};
};
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

test('main build: main scans the pushed commits with gitleaks, then builds production with the brand required', async () => {
  const ran = [];
  const log = [];
  const git = quietGit({'rev-parse --verify --quiet HEAD^1': {ok: true, out: 'abc\n'}});
  assert.equal(await main(['build'], {env: {WORKERS_CI_BRANCH: 'main', WORKERS_CI: '1', WORKERS_CI_COMMIT_SHA: 'c0ffee'}, git, run: (s) => (ran.push(s), 0), log: (line) => log.push(line)}), 0);
  assert.deepEqual(ran.map((s) => s.name), ['Install gitleaks (pinned, SHA-256)', 'gitleaks', 'Build (production, en and es)']);
  assert.ok(ran[1].args.includes('--log-opts=HEAD^1..HEAD'));
  assert.deepEqual(ran[2].env, {GELPY_REQUIRE_BRAND: '1'});
  assert.match(log.join('\n'), /main builds production, commit c0ffee; gitleaks mode: HEAD\^1\.\.HEAD, parent in the clone\./);

  const built = [];
  assert.equal(await main(['build'], {env: {WORKERS_CI_BRANCH: 'main'}, git, run: (s) => (built.push(s.name), s.name === 'gitleaks' ? 1 : 0), log: () => {}}), 1);
  assert.deepEqual(built, ['Install gitleaks (pinned, SHA-256)', 'gitleaks'], 'a finding stops the build before the site build');
});

test('deployScanRange fetches the parent, or falls back to the shallow root', () => {
  const calls = [];
  let fetched = false;
  const fetching = (args) => {
    calls.push(args.join(' '));
    if (args[0] === 'fetch') fetched = true;
    if (args[0] === 'rev-parse' && args[1] === '--verify') return {ok: fetched, out: ''};
    return {ok: false, out: ''};
  };
  assert.deepEqual(deployScanRange(fetching), {range: 'HEAD^1..HEAD', mode: 'HEAD^1..HEAD, parent fetched with git fetch --deepen=1'});
  assert.ok(calls.includes('fetch --no-tags --quiet --deepen=1 origin'));
  const none = quietGit({'rev-parse --is-shallow-repository': {ok: true, out: 'true\n'}, 'rev-list --count': {ok: true, out: '1\n'}});
  const fallback = deployScanRange(none);
  assert.equal(fallback.range, `--max-count=${FALLBACK_COMMITS}`);
  assert.match(fallback.mode, /no parent even after git fetch --deepen=1; the clone's 1 commit\(s\)/);
});

test('main deploy: main deploys, checks live, releases, and syncs the wiki', async () => {
  const ran = [];
  const order = [];
  const env = {WORKERS_CI_BRANCH: 'main', WORKERS_CI_COMMIT_SHA: 'c0ffee'};
  const request = async () => assert.fail('the release gets the request');
  const release = async (options) => (order.push(['release', options.env === env, options.request === request, options.intent.kind]), 0);
  const wiki = (options) => (order.push(['wiki', options.env === env]), 0);
  assert.equal(await main(['deploy'], {env, git: versionGit('0.1.0', '0.1.0'), run: (s) => (ran.push(s), order.push(s.name), 0), log: () => {}, request, release, wiki}), 0);
  assert.deepEqual(ran.map((s) => [s.cmd, ...s.args].join(' ')), [
    'npx wrangler deploy --config wrangler.jsonc',
    'node scripts/check-public.mjs --live https://docs.gelpy.app',
  ]);
  assert.deepEqual(order.slice(2), [['release', true, true, 'same'], ['wiki', true]], 'release, then wiki, after the live check');

  const both = [];
  assert.equal(await main(['deploy'], {env, git: versionGit('0.1.0', '0.1.0'), run: () => 0, log: () => {}, release: async () => (both.push('release'), 1), wiki: () => (both.push('wiki'), 0)}), 1);
  assert.deepEqual(both, ['release', 'wiki'], 'a failed release still syncs the wiki, and the build is red');
  assert.equal(await main(['deploy'], {env, git: versionGit('0.1.0', '0.1.0'), run: () => 0, log: () => {}, release: async () => 0, wiki: () => 1}), 1);

  let after = 0;
  assert.equal(await main(['deploy'], {env, git: () => assert.fail('no git after a failed deploy'), run: () => 7, log: () => {}, release: async () => after++, wiki: () => after++}), 7);
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


// --- Release step (Work Items 003-032 and 003-037) ---------------------------------------------

const DEPLOYED = 'c0ffee0000000000000000000000000000000000';
const OLDER = 'beef000000000000000000000000000000000000';
const RELEASE_ENV = {GELPY_RELEASE_TOKEN: RELEASE, WORKERS_CI_COMMIT_SHA: DEPLOYED};
const BUMP = {kind: 'bump', from: '0.1.0', version: '0.2.0'};
const SAME = {kind: 'same', version: '0.2.0'};

// A fake GitHub API: tag resolves to `tag` (a commit sha, 'missing', an annotated chain, or an
// HTTP status), the release lookup answers `release`, and creation answers `created`.
function github({tag = 'missing', release = 404, created = 201, annotated = []} = {}) {
  const calls = [];
  const request = async (url, options = {}) => {
    calls.push({url, options});
    const path = url.replace(`https://api.github.com/repos/${RELEASE_REPO}/`, '');
    if (path.startsWith('git/ref/tags/')) {
      if (tag === 'missing') return response(404);
      if (typeof tag === 'number') return response(tag, {message: 'Server Error'});
      return response(200, {object: annotated.length ? {type: 'tag', sha: annotated[0]} : {type: 'commit', sha: tag}});
    }
    if (path.startsWith('git/tags/')) {
      const index = annotated.indexOf(path.slice('git/tags/'.length));
      const next = annotated[index + 1];
      return response(200, {object: next ? {type: 'tag', sha: next} : {type: 'commit', sha: tag}});
    }
    if (path.startsWith('releases/tags/')) return response(release, release === 200 ? {} : {message: 'Not Found'});
    if (path === 'releases') return response(created, created === 201 ? {} : {message: 'Validation Failed'});
    return assert.fail(`unexpected ${path}`);
  };
  return {request, calls};
}

async function release(intent, api, {env = RELEASE_ENV, changelog = () => CHANGELOG} = {}) {
  const log = [];
  const status = await createRelease({env, intent, changelog, request: api.request, log: (line) => log.push(line)});
  return {status, log: log.join('\n')};
}

test('releaseIntent reads the version change from HEAD^1, fetching the parent, and never guesses', () => {
  assert.deepEqual(releaseIntent(versionGit('0.2.0', '0.1.0')), BUMP);
  assert.deepEqual(releaseIntent(versionGit('0.2.0', '0.2.0')), SAME);
  const fetches = [];
  let fetched = false;
  const shallow = (args) => {
    if (args[0] === 'fetch') {
      fetches.push(args.join(' '));
      fetched = true;
    }
    if (args.join(' ') === 'rev-parse --verify --quiet HEAD^1') return {ok: fetched, out: ''};
    return versionGit('0.2.0', '0.1.0')(args);
  };
  assert.deepEqual(releaseIntent(shallow), BUMP);
  assert.deepEqual(fetches, ['fetch --no-tags --quiet --deepen=1 origin']);
  assert.match(releaseIntent(versionGit('0.2.0', '0.1.0', {hasParent: false})).reason, /HEAD\^1 is not in the clone even after git fetch --deepen=1/);
  assert.match(releaseIntent(versionGit(null, '0.1.0')).reason, /no readable version at HEAD$/);
  assert.match(releaseIntent(versionGit('0.2.0', null)).reason, /no readable version at HEAD\^1$/);
  const broken = (args) => (args[0] === 'show' ? {ok: true, out: '{not json'} : versionGit('1', '1')(args));
  assert.equal(releaseIntent(broken).kind, 'error');
  const numeric = (args) => (args[0] === 'show' ? {ok: true, out: '{"version": 1}'} : versionGit('1', '1')(args));
  assert.equal(releaseIntent(numeric).kind, 'error');
});

test('every main deploy needs the release token and the commit, and an unreadable intent is red', async () => {
  const api = github();
  for (const intent of [BUMP, SAME]) {
    const missing = await release(intent, api, {env: {WORKERS_CI_COMMIT_SHA: DEPLOYED}});
    assert.equal(missing.status, 1);
    assert.equal(missing.log, 'workers-builds: deployed, but the release failed: GELPY_RELEASE_TOKEN is not set; every main deploy needs it (Work Item 003-037)');
  }
  assert.match((await release(BUMP, api, {env: {GELPY_RELEASE_TOKEN: RELEASE}})).log, /WORKERS_CI_COMMIT_SHA is not set/);
  const unknown = await release({kind: 'error', reason: 'HEAD^1 is not in the clone'}, api);
  assert.deepEqual(unknown, {status: 1, log: 'workers-builds: deployed, but the release failed: HEAD^1 is not in the clone'});
  assert.equal(api.calls.length, 0, 'no API call without a token, a commit, or an intent');
});

test('bump: creates the release at the deployed commit from the CHANGELOG section', async () => {
  const api = github();
  const result = await release(BUMP, api);
  assert.deepEqual(result, {status: 0, log: `workers-builds: released v0.2.0 (from 0.1.0) at ${DEPLOYED}.`});
  const post = api.calls.at(-1);
  assert.equal(post.options.method, 'POST');
  assert.deepEqual(JSON.parse(post.options.body), {tag_name: 'v0.2.0', target_commitish: DEPLOYED, name: 'gelpy-docs v0.2.0', body: '### Added\n\n- Docs on Workers.\n'});
  assert.equal(post.options.headers.Authorization, `Bearer ${RELEASE}`);
  assert.ok(api.calls.every((call) => call.options.signal instanceof AbortSignal), 'every request has a timeout');
  assert.ok(!result.log.includes(RELEASE));
});

test('bump: a tag at the deployed commit passes a rebuild; a tag on another commit is red', async () => {
  assert.deepEqual(await release(BUMP, github({tag: DEPLOYED, release: 200})), {status: 0, log: `workers-builds: v0.2.0 already released at ${DEPLOYED}.`});
  assert.deepEqual(await release(BUMP, github({tag: DEPLOYED.toUpperCase(), release: 404})), {status: 0, log: `workers-builds: released v0.2.0 (from 0.1.0) at ${DEPLOYED}.`});
  for (const existing of [200, 404]) {
    const moved = await release(BUMP, github({tag: OLDER, release: existing}));
    assert.deepEqual(moved, {status: 1, log: `workers-builds: deployed, but the release failed: main deployed ${DEPLOYED} but v0.2.0 points at ${OLDER}; bump the version`});
  }
});

test('bump: annotated tags are dereferenced, up to MAX_TAG_DEPTH', async () => {
  assert.equal(MAX_TAG_DEPTH, 5);
  assert.equal((await release(BUMP, github({tag: DEPLOYED, release: 200, annotated: ['t1', 't2']}))).status, 0);
  assert.match((await release(BUMP, github({tag: OLDER, annotated: ['t1']}))).log, new RegExp(`v0\\.2\\.0 points at ${OLDER}`));
  const deep = await release(BUMP, github({tag: DEPLOYED, annotated: ['a', 'b', 'c', 'd', 'e', 'f']}));
  assert.deepEqual(deep, {status: 1, log: 'workers-builds: deployed, but the release failed: tag v0.2.0 does not resolve to a commit'});
});

test('bump: a release PR with no or an empty CHANGELOG section is red', async () => {
  assert.match((await release(BUMP, github(), {changelog: () => '## [Unreleased]\n'})).log, /release failed: CHANGELOG\.md has no section for 0\.2\.0\./);
  assert.match((await release(BUMP, github(), {changelog: () => '## [0.2.0]\n\n## [0.1.0]\n'})).log, /release failed: CHANGELOG\.md section for 0\.2\.0 is empty/);
  assert.match((await release(BUMP, github(), {changelog: () => assert.fail('io')})).log, /release failed: io/);
});

test('same: a feature merge creates no release; a tag on an older commit is expected and logged', async () => {
  const api = github({tag: OLDER, release: 200});
  assert.deepEqual(await release(SAME, api), {status: 0, log: `workers-builds: no release: this merge keeps version 0.2.0 (v0.2.0 points at ${OLDER}); a release PR from release/vX.Y.Z changes it.`});
  assert.ok(!api.calls.some((call) => call.options.method === 'POST'), 'nothing is created');
  assert.deepEqual(await release(SAME, github()), {status: 0, log: 'workers-builds: no release: this merge keeps version 0.2.0 (v0.2.0 is not tagged yet); a release PR from release/vX.Y.Z changes it.'});
});

test('a release whose tag is missing is red, whether or not the merge bumps the version', async () => {
  for (const intent of [BUMP, SAME]) {
    const orphan = await release(intent, github({tag: 'missing', release: 200}));
    assert.deepEqual(orphan, {status: 1, log: `workers-builds: deployed, but the release failed: v0.2.0 has a release but no tag, so it cannot be checked against ${DEPLOYED}; restore the tag or delete the release`});
  }
});

test('API errors on the tag, the annotated tag, the release lookup, or the creation are red', async () => {
  assert.match((await release(BUMP, github({tag: 500}))).log, /release failed: reading tag v0\.2\.0: 500 Server Error$/);
  const annotatedError = {request: async (url) => (url.includes('git/ref/') ? response(200, {object: {type: 'tag', sha: 'x'}}) : response(502, {message: 'Bad Gateway'}))};
  assert.match((await release(BUMP, annotatedError)).log, /reading annotated tag v0\.2\.0: 502 Bad Gateway$/);
  assert.match((await release(SAME, github({release: 500}))).log, /release failed: 500 Not Found$/);
  assert.match((await release(BUMP, github({created: 422}))).log, /release failed: 422 Validation Failed$/);
  const noJson = {request: async () => ({status: 503, json: async () => assert.fail('no json')})};
  assert.match((await release(BUMP, noJson)).log, /release failed: reading tag v0\.2\.0: 503$/);
  assert.match((await release(BUMP, {request: async () => assert.fail('offline')})).log, /release failed: network error: offline$/);
  assert.match((await release(BUMP, {request: async () => Promise.reject('down')})).log, /network error: down$/);
});

test('resolveTag reports a ref whose object is not a commit as an error', async () => {
  const request = async () => response(200, {object: {type: 'tree', sha: 'x'}});
  assert.deepEqual(await resolveTag({request, headers: {}, tag: 'v1.0.0', timeoutMs: 1000}), {kind: 'error', reason: 'tag v1.0.0 does not resolve to a commit'});
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
  const request = (url, options) => globalThis.fetch(local, options);
  const log = [];
  const start = Date.now();
  try {
    const status = await createRelease({env: RELEASE_ENV, intent: BUMP, changelog: () => CHANGELOG, request, log: (line) => log.push(line), timeoutMs: 200});
    assert.equal(status, 1);
  } finally {
    server.closeAllConnections();
    server.close();
  }
  assert.ok(Date.now() - start < 5000, 'a 200 ms timeout, not a hang');
  assert.equal(RELEASE_TIMEOUT_MS, 15_000);
  assert.match(log.at(-1), /release failed: /);
});

test('main deploy: the release step gets the version-change intent from git', async () => {
  const intents = [];
  const env = {WORKERS_CI_BRANCH: 'main', WORKERS_CI_COMMIT_SHA: DEPLOYED};
  const log = [];
  for (const [head, parent] of [['0.2.0', '0.1.0'], ['0.1.0', '0.1.0'], [null, '0.1.0']]) {
    await main(['deploy'], {env, git: versionGit(head, parent), run: () => 0, log: (line) => log.push(line), release: async ({intent}) => (intents.push(intent.kind), 0), wiki: () => 0});
  }
  assert.deepEqual(intents, ['bump', 'same', 'error']);
  const text = log.join('\n');
  assert.match(text, /release intent: version 0\.1\.0 -> 0\.2\.0\./);
  assert.match(text, /release intent: version 0\.1\.0 unchanged\./);
  assert.match(text, /release intent: unknown\./);
});

// --- Step timeouts (Gelpy/gelpy#22) -------------------------------------------------------------

test('wrangler and live-check steps carry a time limit, run under coreutils timeout', async () => {
  const {deploySteps, PREVIEW, WRANGLER_TIMEOUT_MS, LIVE_CHECK_TIMEOUT_MS} = await import('../scripts/workers-builds.mjs');
  assert.equal(WRANGLER_TIMEOUT_MS, 300_000);
  assert.equal(LIVE_CHECK_TIMEOUT_MS, 720_000);
  assert.deepEqual(deploySteps().map((s) => s.timeoutMs), [WRANGLER_TIMEOUT_MS, LIVE_CHECK_TIMEOUT_MS]);
  assert.equal(PREVIEW.timeoutMs, WRANGLER_TIMEOUT_MS);
  assert.deepEqual(timedCommand('/bin/x', ['a'], undefined), {file: '/bin/x', args: ['a'], backstop: undefined});
  assert.deepEqual(timedCommand('/bin/x', ['a'], 300_000, () => '/usr/bin/timeout'), {file: '/usr/bin/timeout', args: ['--kill-after=10s', '300s', '/bin/x', 'a'], backstop: 340_000});
  assert.deepEqual([...TIMED_OUT], [124, 137]);
});

test('a timed-out step kills its whole process tree and fails red (real processes)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'workers-builds-tree-'));
  const marker = join(dir, 'grandchild-survived');
  // A parent that spawns a child which would write the marker after 2 s, then idles for 30 s.
  const script = `require('child_process').spawn(process.execPath, ['-e', 'setTimeout(() => require("fs").writeFileSync(${JSON.stringify(marker)}, "x"), 2000)'], {stdio: 'ignore'}); setTimeout(() => {}, 30000);`;
  const stall = {cmd: 'node', args: ['-e', script], timeoutMs: 500};
  const errors = [];
  const original = console.error;
  console.error = (line) => errors.push(line);
  const start = Date.now();
  try {
    assert.equal(defaultRun(stall), 124);
  } finally {
    console.error = original;
  }
  assert.ok(Date.now() - start < 5000, 'stopped at the time limit, not after 30 s');
  assert.deepEqual(errors, ['workers-builds: node and its child processes were killed after 0.5 s.']);

  const err = [];
  const captured = defaultCapture(stall, {stdout: {write: () => {}}, stderr: {write: (text) => err.push(text)}});
  assert.equal(captured.status, 124);
  assert.deepEqual(err.filter(Boolean), ['workers-builds: node and its child processes were killed after 0.5 s.\n']);

  // Give an orphaned grandchild time to write its marker (a 3 s sleep that does not spin the CPU).
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 3000);
  assert.equal(existsSync(marker), false, 'the grandchild died with the group');
  rmSync(dir, {recursive: true, force: true});
});
