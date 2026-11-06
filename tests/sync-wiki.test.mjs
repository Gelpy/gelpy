import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

import {resolveCommand} from '../scripts/lib/fixed-path.mjs';
import {AUTHOR, WIKI_REMOTE, authEnv, changesOf, defaultGit, syncWiki} from '../scripts/sync-wiki.mjs';

// A fake value, assembled at runtime so no token-shaped literal is committed.
const TOKEN = ['fake', 'wiki', 'value'].join('-');
const git = (args, cwd) => spawnSync(resolveCommand('git'), args, {cwd, encoding: 'utf8', env: {PATH: '/usr/bin:/bin', HOME: cwd, GIT_CONFIG_NOSYSTEM: '1'}});

// A bare repo standing in for the wiki, with one hand-made page.
function fakeWiki() {
  const root = mkdtempSync(join(tmpdir(), 'sync-wiki-'));
  const bare = join(root, 'wiki.git');
  const seed = join(root, 'seed');
  assert.equal(git(['init', '--quiet', '--bare', '--initial-branch=master', bare], root).status, 0);
  assert.equal(git(['clone', '--quiet', bare, seed], root).status, 0);
  writeFileSync(join(seed, 'Home.md'), 'Initial Home page\n');
  writeFileSync(join(seed, 'Old-Page.md'), 'Removed by the mirror\n');
  assert.equal(git(['add', '--all'], seed).status, 0);
  assert.equal(git(['-c', 'user.name=t', '-c', 'user.email=t@example.org', 'commit', '--quiet', '-m', 'seed'], seed).status, 0);
  assert.equal(git(['push', '--quiet', 'origin', 'HEAD'], seed).status, 0);
  return {root, remote: `file://${bare}`, bare};
}

test('authEnv sends the token only as a github.com header, through config variables', () => {
  const env = authEnv(TOKEN);
  assert.equal(env.GIT_CONFIG_COUNT, '1');
  assert.equal(env.GIT_CONFIG_KEY_0, 'http.https://github.com/.extraheader');
  assert.equal(env.GIT_CONFIG_VALUE_0, `AUTHORIZATION: basic ${Buffer.from(`x-access-token:${TOKEN}`).toString('base64')}`);
  assert.equal(env.GIT_TERMINAL_PROMPT, '0');
  assert.equal(WIKI_REMOTE, 'https://github.com/Gelpy/gelpy.wiki.git');
  assert.doesNotMatch(WIKI_REMOTE, /@/);
});

test('changesOf reads porcelain status into page names', () => {
  assert.deepEqual(changesOf('A  New.md\nM  Home.md\nD  Old.md\n?? Untracked.md\nR  X.md\n'), {
    added: ['New', 'Untracked'],
    updated: ['Home', 'X'],
    removed: ['Old'],
  });
});

test('syncWiki skips without a token and touches nothing', () => {
  const log = [];
  const calls = [];
  const status = syncWiki({token: '', pages: new Map(), git: (...args) => calls.push(args), log: (line) => log.push(line), makeDir: () => assert.fail('no dir')});
  assert.equal(status, 0);
  assert.deepEqual(calls, []);
  assert.deepEqual(log, ['wiki: sync skipped: no token.']);
});

test('syncWiki mirrors the pages, pushes once, and is idempotent (real git, local remote)', () => {
  const {root, remote, bare} = fakeWiki();
  try {
    const pages = new Map([['Home', '# Home\n'], ['Security-Overview', '# Security\n']]);
    const log = [];
    const env = {PATH: '/usr/bin:/bin', HOME: root, GIT_CONFIG_NOSYSTEM: '1'};
    assert.equal(syncWiki({token: TOKEN, pages, commit: 'abcdef1234', remote, env, log: (line) => log.push(line)}), 0);
    assert.deepEqual(log, ['wiki: added Security-Overview.', 'wiki: updated Home.', 'wiki: removed Old-Page.', 'wiki: pushed, 2 pages.']);
    const files = git(['ls-tree', '--name-only', 'HEAD'], bare).stdout.trim().split('\n');
    assert.deepEqual(files, ['Home.md', 'Security-Overview.md']);
    const head = git(['log', '-1', '--format=%an <%ae> %s'], bare).stdout.trim();
    assert.equal(head, `${AUTHOR.name} <${AUTHOR.email}> docs: sync wiki from Gelpy/gelpy@abcdef1`);

    const again = [];
    assert.equal(syncWiki({token: TOKEN, pages, remote, env, log: (line) => again.push(line)}), 0);
    assert.deepEqual(again, ['wiki: up to date, 2 pages; nothing to push.']);
    assert.equal(git(['rev-list', '--count', 'HEAD'], bare).stdout.trim(), '2');
    for (const line of [...log, ...again]) {
      assert.doesNotMatch(line, new RegExp(TOKEN));
      assert.doesNotMatch(line, /https?:\/\//);
    }
  } finally {
    rmSync(root, {recursive: true, force: true});
  }
});

test('syncWiki never puts the token on a command line, and names only the failed step', () => {
  for (const failAt of ['clone', 'ls-files', 'add', 'status', 'commit', 'push']) {
    const log = [];
    const seen = [];
    const removed = [];
    const fake = (args, {env}) => {
      seen.push({args, env});
      const verb = args.find((arg) => ['clone', 'ls-files', 'add', 'status', 'commit', 'push'].includes(arg));
      if (verb === failAt) return {status: 128, out: ''};
      if (verb === 'ls-files') return {status: 0, out: 'Home.md\0Stale.md\0'};
      if (verb === 'status') return {status: 0, out: 'M  Home.md\n'};
      return {status: 0, out: ''};
    };
    const status = syncWiki({
      token: TOKEN,
      pages: new Map([['Home', 'x\n']]),
      git: fake,
      log: (line) => log.push(line),
      makeDir: () => '/wiki',
      removeDir: (dir) => removed.push(dir),
      write: () => {},
      remove: () => {},
    });
    assert.equal(status, 1, failAt);
    const label = {'ls-files': 'list', add: 'stage'}[failAt] ?? failAt;
    assert.deepEqual(log, [`wiki: ${label} failed (exit 128).`]);
    assert.deepEqual(removed, ['/wiki'], 'the clone is always removed');
    for (const call of seen) {
      assert.ok(!call.args.join(' ').includes(TOKEN), 'no token in argv');
      assert.ok(call.env.GIT_CONFIG_VALUE_0.startsWith('AUTHORIZATION: basic '));
    }
  }
});

test('defaultGit captures output and runs git with a fixed PATH', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sync-wiki-git-'));
  try {
    const result = defaultGit(['--version'], {cwd: dir, env: {}});
    assert.equal(result.status, 0);
    assert.match(result.out, /^git version/);
    assert.equal(defaultGit(['not-a-command'], {cwd: dir, env: {}}).status, 1);
  } finally {
    rmSync(dir, {recursive: true, force: true});
  }
});

test('sync-wiki.mjs never reads a token name from the environment', () => {
  const source = readFileSync('scripts/sync-wiki.mjs', 'utf8');
  assert.doesNotMatch(source, /GELPY_[A-Z_]*TOKEN/);
  assert.doesNotMatch(source, /process\.env/);
});
