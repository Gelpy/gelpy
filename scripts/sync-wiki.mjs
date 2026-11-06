// Pushes the generated wiki pages (scripts/build-wiki.mjs) to the GitHub wiki of
// Gelpy/gelpy (Work Item 004-002). `cf:deploy` runs it on main, after the docs
// deploy and its live check (scripts/workers-builds.mjs), with a token that the
// caller passes in; this file never reads it from the environment.
//
// - The wiki is a mirror: every page that docs/ no longer produces is removed.
// - Idempotent: when the pages already match, nothing is committed or pushed.
// - The token travels only in an HTTP header set through GIT_CONFIG_* variables,
//   never in a command line or the remote URL, and git's own output is never
//   printed. The log holds page names, step names, and exit codes only.

import {spawnSync} from 'node:child_process';
import {mkdtempSync, rmSync, unlinkSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

import {childEnv, resolveCommand} from './lib/fixed-path.mjs';

export const WIKI_REMOTE = 'https://github.com/Gelpy/gelpy.wiki.git';
export const AUTHOR = {name: 'Gelpy Docs', email: 'noreply@gelpy.app'};

/** Git config, as environment variables, that sends the token as a Basic auth header to github.com only. */
export function authEnv(token) {
  const basic = Buffer.from(`x-access-token:${token}`).toString('base64');
  return {
    GIT_CONFIG_COUNT: '1',
    GIT_CONFIG_KEY_0: 'http.https://github.com/.extraheader',
    GIT_CONFIG_VALUE_0: `AUTHORIZATION: basic ${basic}`,
    GIT_TERMINAL_PROMPT: '0',
  };
}

// Each git call is killed after this long, so a stalled clone or push fails the step instead of
// holding the deploy.
export const GIT_TIMEOUT_MS = 120_000;

/** Runs git with captured output, so nothing it prints reaches the build log. */
export function defaultGit(args, {cwd, env, timeout = GIT_TIMEOUT_MS}) {
  const result = spawnSync(resolveCommand('git'), args, {cwd, encoding: 'utf8', env: childEnv(env), timeout, killSignal: 'SIGKILL'});
  return {status: result.status ?? 1, out: result.stdout ?? ''};
}

/** Reads `git status --porcelain` into the page names added, updated, and removed. */
export function changesOf(porcelain) {
  const changes = {added: [], updated: [], removed: []};
  for (const line of porcelain.split('\n').filter(Boolean)) {
    const code = line.slice(0, 2);
    const name = line.slice(3).replace(/\.md$/, '');
    if (code.includes('D')) changes.removed.push(name);
    else if (code.includes('A') || code === '??') changes.added.push(name);
    else changes.updated.push(name);
  }
  return changes;
}

/**
 * Mirrors `pages` (a Map of page name to Markdown) into the wiki and pushes it.
 * `env` is the parent environment for git, already without any secret.
 * Returns an exit code: 0 when the wiki matches the docs, 1 when a step fails.
 */
export function syncWiki({
  token,
  pages,
  commit = 'unknown',
  remote = WIKI_REMOTE,
  env = {},
  git = defaultGit,
  log = console.log,
  makeDir = () => mkdtempSync(join(tmpdir(), 'gelpy-wiki-')),
  removeDir = (dir) => rmSync(dir, {recursive: true, force: true}),
  write = (file, text) => writeFileSync(file, text),
  remove = (file) => unlinkSync(file),
}) {
  if (!token) {
    log('wiki: sync skipped: no token.');
    return 0;
  }
  const dir = makeDir();
  const gitEnv = {...env, ...authEnv(token)};
  const step = (name, args, cwd = dir) => {
    const result = git(args, {cwd, env: gitEnv});
    if (result.status !== 0) log(`wiki: ${name} failed (exit ${result.status}).`);
    return result;
  };
  try {
    if (step('clone', ['clone', '--quiet', '--depth', '1', remote, dir], undefined).status !== 0) return 1;
    const tracked = step('list', ['ls-files', '-z']);
    if (tracked.status !== 0) return 1;
    const wanted = new Set([...pages.keys()].map((name) => `${name}.md`));
    for (const file of tracked.out.split('\0').filter(Boolean)) {
      if (!wanted.has(file)) remove(join(dir, file));
    }
    for (const [name, text] of pages) write(join(dir, `${name}.md`), text);
    if (step('stage', ['add', '--all']).status !== 0) return 1;
    const status = step('status', ['status', '--porcelain']);
    if (status.status !== 0) return 1;
    const changes = changesOf(status.out);
    if (changes.added.length + changes.updated.length + changes.removed.length === 0) {
      log(`wiki: up to date, ${pages.size} pages; nothing to push.`);
      return 0;
    }
    const identity = ['-c', `user.name=${AUTHOR.name}`, '-c', `user.email=${AUTHOR.email}`];
    if (step('commit', [...identity, 'commit', '--quiet', '-m', `docs: sync wiki from Gelpy/gelpy@${commit.slice(0, 7)}`]).status !== 0) return 1;
    if (step('push', ['push', '--quiet', 'origin', 'HEAD']).status !== 0) return 1;
    for (const [label, names] of Object.entries(changes)) {
      if (names.length > 0) log(`wiki: ${label} ${names.join(', ')}.`);
    }
    log(`wiki: pushed, ${pages.size} pages.`);
    return 0;
  } finally {
    removeDir(dir);
  }
}
