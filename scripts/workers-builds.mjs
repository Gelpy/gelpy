// The docs' CI/CD on Cloudflare Workers Builds (ADR-0018, Work Item 003-025), ported from the
// gelpy-web pilot (003-019). One Worker, gelpy-docs (production branch main, previews on), with
// the default Workers Builds setup the owner chose on 2026-11-05 and the same three commands:
//   Build command:   npm run cf:build
//   Deploy command:  npm run cf:deploy
//   Preview command: npm run cf:preview
// The branch (WORKERS_CI_BRANCH, or --branch <name> locally) picks what each one does:
//   main  -> gitleaks over HEAD^1..HEAD and the production build (003-037), deploy to gelpy-docs
//            (docs.gelpy.app), live check, then the release step (003-032, 003-037: a release
//            only when the merge changes the version) and the wiki sync (004-002)
//   other -> gitleaks and the build, with X-Robots-Tag: noindex, then a Preview deployment
// Cloudflare only builds and deploys (ADR-0018, third amendment, "MVP mode"): every test runs in
// `npm run ci:local` before a push, and `npm run ci:evidence` records it for the PR.
// Workers Builds installs the dependencies itself; .npmrc reads GELPY_PACKAGES_TOKEN.
// GELPY_RELEASE_TOKEN and GELPY_WIKI_TOKEN are build secrets of the production settings only.
// Only main's deploy reads them, and no child process receives them, apart from the wiki's git,
// which gets its token as an HTTP header (scripts/sync-wiki.mjs).
import {spawnSync} from 'node:child_process';
import {existsSync, readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

import {buildWiki} from './build-wiki.mjs';
import {childEnv, resolveCommand} from './lib/fixed-path.mjs';
import {extractReleaseNotes} from './release-notes.mjs';
import {syncWiki} from './sync-wiki.mjs';

export const BASE_BRANCH = 'main';
export const TOOLS_DIR = '.tools/bin';
export const OUTPUT_DIR = 'build';
export const ORIGIN = 'https://docs.gelpy.app';

// The only branch that deploys.
export const DEPLOY_BRANCH = 'main';

// Every wrangler call names this file, so a .wrangler/deploy/config.json redirect left by a
// build can never take its place.
export const WRANGLER_CONFIG = 'wrangler.jsonc';

// Credentials the build command may see. Only their presence is printed, never a value, a
// length, or a prefix, so the logs tell which token each build runs with.
export const CREDENTIALS = ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID'];

// Production-only build secrets, read only by main's deploy.
export const RELEASE_TOKEN = 'GELPY_RELEASE_TOKEN';
export const WIKI_TOKEN = 'GELPY_WIKI_TOKEN';
export const SECRETS = [RELEASE_TOKEN, WIKI_TOKEN];

// The headers of a Preview deployment: public on workers.dev, never indexed.
export const NOINDEX_HEADERS = '/*\n  X-Robots-Tag: noindex\n';

export function credentialPresence(env) {
  return `workers-builds: credentials seen by this build: ${CREDENTIALS.map((name) => `${name} ${env[name] ? 'present' : 'absent'}`).join(', ')}.`;
}

// The branch of this build: Workers Builds sets WORKERS_CI_BRANCH; locally, --branch <name>.
export function branchOf(argv, env) {
  const flag = argv.indexOf('--branch');
  const branch = flag === -1 ? env.WORKERS_CI_BRANCH : argv[flag + 1];
  if (!branch) throw new Error('No branch: Workers Builds sets WORKERS_CI_BRANCH; locally, pass --branch <name>.');
  return branch;
}

// The parent environment for a child process, without the production secrets.
export function withoutSecrets(env) {
  const copy = {...env};
  for (const name of SECRETS) delete copy[name];
  return copy;
}

// In Workers Builds (WORKERS_CI=1) the brand package must be there, so a missing
// GELPY_PACKAGES_TOKEN fails the build instead of shipping the default theme. GELPY_REQUIRE_BRAND
// set to anything overrides it, for a local simulation without the token.
export function brandEnv(env) {
  return {GELPY_REQUIRE_BRAND: env.GELPY_REQUIRE_BRAND ?? (env.WORKERS_CI === '1' ? '1' : '0')};
}

const step = (name, cmd, args, extra = {}) => ({name, cmd, args, ...extra});

export const GITLEAKS_INSTALL = step('Install gitleaks (pinned, SHA-256)', 'bash', ['scripts/install-scanners.sh', TOOLS_DIR]);

// The pinned gitleaks install (SHA-256 checked) and its scan of a git log range. Every build, PR
// or main, runs it before the site build, so a finding stops the build before any deploy.
export function scanSteps(gitleaksRange) {
  return [
    GITLEAKS_INSTALL,
    step('gitleaks', join(TOOLS_DIR, 'gitleaks'), ['git', '--redact', '--no-banner', '--exit-code', '1', `--log-opts=${gitleaksRange}`, '.']),
  ];
}

export function buildStep(env, label) {
  return step(`Build (${label}, en and es)`, 'npm', ['run', 'build'], {env: brandEnv(env)});
}

// A PR branch's build: gitleaks over the PR's commits, then the site the Preview deployment
// serves. The tests ran in `npm run ci:local` before the push.
export function prSteps({gitleaksRange, env}) {
  return [...scanSteps(gitleaksRange), buildStep(env, 'preview')];
}

// The build of main: gitleaks over the pushed commits first (Work Item 003-037), then the site.
export function productionSteps(env, {gitleaksRange}) {
  return [...scanSteps(gitleaksRange), buildStep(env, 'production')];
}

// Wrangler talks to the Cloudflare API, so its steps are killed after this long and fail red
// instead of holding the build until Workers Builds stops it.
export const WRANGLER_TIMEOUT_MS = 300_000;

// The live check bounds itself (scripts/check-public.mjs): 5 minutes per path plus one request,
// for 2 paths. This kill limit only backs that up.
export const LIVE_CHECK_TIMEOUT_MS = 720_000;

export function deploySteps() {
  return [
    step('Deploy (gelpy-docs)', 'npx', ['wrangler', 'deploy', '--config', WRANGLER_CONFIG], {timeoutMs: WRANGLER_TIMEOUT_MS}),
    step(`Verify the live site (${ORIGIN})`, 'node', ['scripts/check-public.mjs', '--live', ORIGIN], {timeoutMs: LIVE_CHECK_TIMEOUT_MS}),
  ];
}

// A PR branch's Preview deployment. It refuses a build whose _headers lack noindex.
export const PREVIEW = step('Preview deployment', 'npx', ['wrangler', 'preview', '--config', WRANGLER_CONFIG], {timeoutMs: WRANGLER_TIMEOUT_MS});

export function writeNoindexHeaders(root = OUTPUT_DIR) {
  writeFileSync(join(root, '_headers'), NOINDEX_HEADERS);
}

export function previewIsNoindex(root = OUTPUT_DIR) {
  const file = join(root, '_headers');
  return existsSync(file) && readFileSync(file, 'utf8').includes('X-Robots-Tag: noindex');
}

// What the PR changed against main, from the merge base, for the range gitleaks scans. Workers
// Builds clones one commit deep, so main may be missing or have no common ancestor; then base is
// null, `reason` says which, and gitleaks scans the last commits.
export function changedSinceBase(git) {
  const ref = `origin/${BASE_BRANCH}`;
  const has = () => git(['rev-parse', '--verify', '--quiet', ref]).ok;
  if (!has()) git(['fetch', '--no-tags', '--quiet', 'origin', `${BASE_BRANCH}:refs/remotes/${ref}`]);
  if (!has()) return {base: null, paths: null, reason: 'no-base'};
  const base = git(['merge-base', 'HEAD', ref]);
  if (!base.ok || !base.out.trim()) return {base: null, paths: null, reason: 'no-merge-base'};
  const diff = git(['diff', '--name-only', base.out.trim(), 'HEAD']);
  return diff.ok
    ? {base: base.out.trim(), paths: diff.out.split('\n').filter(Boolean), reason: null}
    : {base: null, paths: null, reason: 'no-diff'};
}

export const FALLBACK_COMMITS = 50;

// What gitleaks covers when it has no base. `git log -p` shows a shallow clone's oldest commit
// as a root commit, whose diff adds every file at that commit: within FALLBACK_COMMITS of it,
// the scan holds the whole tree (every text file; gitleaks skips binary files).
export function fallbackScope({shallow, commits}) {
  return shallow === 'true' && Number(commits) > 0 && Number(commits) <= FALLBACK_COMMITS
    ? `the clone's ${commits} commit(s), down to its shallow root, whose diff holds every text file`
    : `the last ${FALLBACK_COMMITS} commits only; older history is not scanned`;
}

// The parent of HEAD, fetched with `git fetch --deepen=1` when the clone (one commit deep in
// Workers Builds) lacks it. Returns whether HEAD^1 is now in the clone.
export function ensureParent(git) {
  const hasParent = () => git(['rev-parse', '--verify', '--quiet', 'HEAD^1']).ok;
  if (hasParent()) return {ok: true, fetched: false};
  git(['fetch', '--no-tags', '--quiet', '--deepen=1', 'origin']);
  return {ok: hasParent(), fetched: true};
}

// What gitleaks scans on a main build: the pushed commits, HEAD^1..HEAD (the squash merge), as in
// gelpy-app. With still no parent, it falls back to the clone's history down to its shallow root,
// whose diff holds every text file at HEAD.
export function deployScanRange(git) {
  const parent = ensureParent(git);
  if (parent.ok) return {range: 'HEAD^1..HEAD', mode: `HEAD^1..HEAD, ${parent.fetched ? 'parent fetched with git fetch --deepen=1' : 'parent in the clone'}`};
  const shallow = git(['rev-parse', '--is-shallow-repository']).out.trim();
  const commits = git(['rev-list', '--count', 'HEAD']).out.trim();
  return {range: `--max-count=${FALLBACK_COMMITS}`, mode: `no parent even after git fetch --deepen=1; ${fallbackScope({shallow, commits})}`};
}

const WHY_NO_BASE = {
  'no-base': `origin/${BASE_BRANCH} could not be fetched into this clone`,
  'no-merge-base': `origin/${BASE_BRANCH} has no merge base with HEAD in this clone`,
  'no-diff': `the diff against origin/${BASE_BRANCH} failed`,
};

export function readVersion(file = 'package.json') {
  return JSON.parse(readFileSync(file, 'utf8')).version;
}

// The GitHub Release that `cf:deploy` creates on main after a good deploy (Work Item 003-032).
export const RELEASE_REPO = 'Gelpy/gelpy';
const GITHUB_API = 'https://api.github.com';
// Each GitHub API request, error body included, aborts after this long, so a stalled API fails
// the release step instead of holding the deploy (and the wiki sync after it).
export const RELEASE_TIMEOUT_MS = 15_000;

// Whether this main deploy is a release: the version in package.json at HEAD against HEAD^1
// (Work Item 003-037, Master decision of 2026-11-07). Feature PRs merge straight to main here and
// keep the version; only a release PR from release/v<version> changes it. The parent is fetched
// with `git fetch --deepen=1` when the clone lacks it; an unreadable parent or version is an error,
// so the release step never guesses.
export function releaseIntent(git) {
  if (!ensureParent(git).ok) return {kind: 'error', reason: 'HEAD^1 is not in the clone even after git fetch --deepen=1, so the release step cannot tell whether this merge changes the version'};
  const versionAt = (rev) => {
    const shown = git(['show', `${rev}:package.json`]);
    if (!shown.ok) return null;
    try {
      const version = JSON.parse(shown.out).version;
      return typeof version === 'string' ? version : null;
    } catch {
      return null;
    }
  };
  const head = versionAt('HEAD');
  const parent = versionAt('HEAD^1');
  if (!head || !parent) return {kind: 'error', reason: `package.json has no readable version at ${head ? 'HEAD^1' : 'HEAD'}`};
  return head === parent ? {kind: 'same', version: head} : {kind: 'bump', from: parent, version: head};
}

async function apiError(response) {
  let message = '';
  try {
    message = (await response.json())?.message ?? '';
  } catch {
    // No JSON body; the status says enough.
  }
  return `${response.status} ${message}`.trim();
}

// How many annotated tags (a tag of a tag) the resolver follows before it gives up.
export const MAX_TAG_DEPTH = 5;

// The commit a tag points at, ported from gelpy-console (#40, #41): GET git/ref/tags/<tag>, then,
// while the ref names an annotated tag, GET git/tags/<sha> to dereference it. A missing tag is
// "missing"; anything unexpected is an error, so the caller fails rather than guess.
export async function resolveTag({request, headers, tag, timeoutMs}) {
  const get = (path) => request(`${GITHUB_API}/repos/${RELEASE_REPO}/${path}`, {headers, signal: AbortSignal.timeout(timeoutMs)});
  const ref = await get(`git/ref/tags/${tag}`);
  if (ref.status === 404) return {kind: 'missing'};
  if (ref.status !== 200) return {kind: 'error', reason: `reading tag ${tag}: ${await apiError(ref)}`};
  let target = (await ref.json())?.object;
  for (let depth = 0; depth < MAX_TAG_DEPTH && target?.type === 'tag' && typeof target.sha === 'string'; depth += 1) {
    const annotated = await get(`git/tags/${target.sha}`);
    if (annotated.status !== 200) return {kind: 'error', reason: `reading annotated tag ${tag}: ${await apiError(annotated)}`};
    target = (await annotated.json())?.object;
  }
  if (target?.type !== 'commit' || typeof target.sha !== 'string') return {kind: 'error', reason: `tag ${tag} does not resolve to a commit`};
  return {kind: 'commit', sha: target.sha};
}

// The release step of every main deploy (Work Items 003-032 and 003-037). Feature PRs merge straight
// to main here, so `intent` (releaseIntent) decides whether this merge is a release:
// - Every main deploy needs GELPY_RELEASE_TOKEN and WORKERS_CI_COMMIT_SHA, and a release of
//   v<version> whose tag is missing fails, because nothing then ties it to a commit.
// - "bump" (a release PR changed the version): v<version> must be missing or at the deployed
//   commit, or the build fails, because GitHub would reuse a tag on another commit and ignore
//   target_commitish. A release at the right tag passes (a rebuild); otherwise the release is
//   created from the CHANGELOG.md section of the version, which must exist and not be empty.
// - "same" (a feature merge): no release. A tag on an older commit is expected and only logged.
// - "error" (unreadable parent or version): fails.
// Every failure is red, after a good deploy. The token is sent only in the Authorization header
// and never logged, in whole or in part.
export async function createRelease({env, intent, changelog = () => readFileSync('CHANGELOG.md', 'utf8'), request = globalThis.fetch, log = console.log, timeoutMs = RELEASE_TIMEOUT_MS}) {
  const fail = (reason) => {
    log(`workers-builds: deployed, but the release failed: ${reason}`);
    return 1;
  };
  const token = env[RELEASE_TOKEN];
  if (!token) return fail(`${RELEASE_TOKEN} is not set; every main deploy needs it (Work Item 003-037)`);
  const commit = env.WORKERS_CI_COMMIT_SHA;
  if (!commit) return fail('WORKERS_CI_COMMIT_SHA is not set, so the release cannot be checked against a commit');
  if (intent.kind === 'error') return fail(intent.reason);
  const tag = `v${intent.version}`;
  const headers = {'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28'};
  try {
    const target = await resolveTag({request, headers, tag, timeoutMs});
    if (target.kind === 'error') return fail(target.reason);
    const existing = await request(`${GITHUB_API}/repos/${RELEASE_REPO}/releases/tags/${tag}`, {headers, signal: AbortSignal.timeout(timeoutMs)});
    if (existing.status !== 200 && existing.status !== 404) return fail(await apiError(existing));
    if (existing.status === 200 && target.kind === 'missing') {
      return fail(`${tag} has a release but no tag, so it cannot be checked against ${commit}; restore the tag or delete the release`);
    }
    if (intent.kind === 'same') {
      const where = target.kind === 'commit' ? `${tag} points at ${target.sha}` : `${tag} is not tagged yet`;
      log(`workers-builds: no release: this merge keeps version ${intent.version} (${where}); a release PR from release/vX.Y.Z changes it.`);
      return 0;
    }
    if (target.kind === 'commit' && target.sha.toLowerCase() !== commit.toLowerCase()) {
      return fail(`main deployed ${commit} but ${tag} points at ${target.sha}; bump the version`);
    }
    if (existing.status === 200) {
      log(`workers-builds: ${tag} already released at ${commit}.`);
      return 0;
    }
    let notes;
    try {
      notes = extractReleaseNotes(changelog(), intent.version);
    } catch (error) {
      return fail(error instanceof Error ? error.message : String(error));
    }
    const created = await request(`${GITHUB_API}/repos/${RELEASE_REPO}/releases`, {
      method: 'POST',
      signal: AbortSignal.timeout(timeoutMs),
      headers: {...headers, 'Content-Type': 'application/json'},
      body: JSON.stringify({tag_name: tag, target_commitish: commit, name: `gelpy-docs ${tag}`, body: notes}),
    });
    if (created.status !== 201) return fail(await apiError(created));
    log(`workers-builds: released ${tag} (from ${intent.from}) at ${commit}.`);
    return 0;
  } catch (error) {
    return fail(`network error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// The wiki sync after a good deploy (Work Item 004-002). A docs/ that does not build into a wiki
// fails the step; git runs without the production secrets, with the wiki token as a header only.
export function updateWiki({env, log = console.log, build = buildWiki, sync = syncWiki}) {
  let pages;
  try {
    pages = build();
  } catch (error) {
    log(`wiki: the pages do not build: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
  return sync({token: env[WIKI_TOKEN], pages, commit: env.WORKERS_CI_COMMIT_SHA, env: withoutSecrets(env), log});
}

// Children run by absolute path with a fixed PATH (scripts/lib/fixed-path.mjs).
function defaultGit(args) {
  const result = spawnSync(resolveCommand('git'), args, {encoding: 'utf8', env: childEnv(withoutSecrets(process.env))});
  return {ok: result.status === 0, out: result.stdout ?? ''};
}

// A step with a time limit runs under coreutils `timeout`, which starts it in its own process
// group and signals the whole group: npx, wrangler, and the node process wrangler spawns all stop
// together, so nothing keeps deploying after the step is reported red (Gelpy/gelpy#22). TERM
// first, KILL after KILL_GRACE. spawnSync's own timeout stays as a backstop.
export const KILL_GRACE_S = 10;
const BACKSTOP_MS = 30_000;
// Exit codes of `timeout` when it stopped the command: 124 after TERM, 137 after KILL.
export const TIMED_OUT = new Set([124, 137]);

export function timedCommand(file, args, timeoutMs, resolve = resolveCommand) {
  if (!timeoutMs) return {file, args, backstop: undefined};
  return {file: resolve('timeout'), args: [`--kill-after=${KILL_GRACE_S}s`, `${timeoutMs / 1000}s`, file, ...args], backstop: timeoutMs + KILL_GRACE_S * 1000 + BACKSTOP_MS};
}

const killedMessage = (cmd, timeoutMs) => `workers-builds: ${cmd} and its child processes were killed after ${timeoutMs / 1000} s.`;
const timedOut = (result, timeoutMs) => Boolean(timeoutMs) && (TIMED_OUT.has(result.status) || result.error?.code === 'ETIMEDOUT');

export function defaultRun({cmd, args, env, timeoutMs}) {
  let timed;
  try {
    timed = timedCommand(resolveCommand(cmd), args, timeoutMs);
  } catch (error) {
    console.error(`workers-builds: ${error instanceof Error ? error.message : String(error)}`);
    return 127;
  }
  const result = spawnSync(timed.file, timed.args, {stdio: 'inherit', env: childEnv(withoutSecrets(process.env), env), timeout: timed.backstop, killSignal: 'SIGKILL'});
  if (timedOut(result, timeoutMs)) console.error(killedMessage(cmd, timeoutMs));
  return result.status ?? 1;
}

// Like defaultRun, but also returns what the command printed, after echoing it to the log.
export function defaultCapture({cmd, args, env, timeoutMs}, {stdout = process.stdout, stderr = process.stderr} = {}) {
  let timed;
  try {
    timed = timedCommand(resolveCommand(cmd), args, timeoutMs);
  } catch (error) {
    const message = `workers-builds: ${error instanceof Error ? error.message : String(error)}`;
    stderr.write(`${message}\n`);
    return {status: 127, output: message};
  }
  const result = spawnSync(timed.file, timed.args, {encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, env: childEnv(withoutSecrets(process.env), env), timeout: timed.backstop, killSignal: 'SIGKILL'});
  stdout.write(result.stdout ?? '');
  stderr.write(result.stderr ?? '');
  if (timedOut(result, timeoutMs)) stderr.write(`${killedMessage(cmd, timeoutMs)}\n`);
  return {status: result.status ?? 1, output: `${result.stdout ?? ''}${result.stderr ?? ''}`};
}

// Runs the steps in order and stops at the first failure, naming it.
export function runSteps(steps, {run = defaultRun, log = console.log, now = Date.now} = {}) {
  for (const current of steps) {
    log(`\n▶ ${current.name}: ${[current.cmd, ...current.args].join(' ')}`);
    const start = now();
    const status = run(current);
    log(`  ${status === 0 ? '✓' : '✗'} ${current.name} (${((now() - start) / 1000).toFixed(1)} s)`);
    if (status !== 0) {
      log(`workers-builds: "${current.name}" failed with exit code ${status}.`);
      return status;
    }
  }
  return 0;
}

function build(branch, {env, git, run, log, headers}) {
  log(credentialPresence(env));
  if (branch === DEPLOY_BRANCH) {
    const scan = deployScanRange(git);
    log(`workers-builds: ${branch} builds production, commit ${env.WORKERS_CI_COMMIT_SHA ?? 'unknown'}; gitleaks mode: ${scan.mode}.`);
    return runSteps(productionSteps(env, {gitleaksRange: scan.range}), {run, log});
  }
  const shallow = git(['rev-parse', '--is-shallow-repository']).out.trim();
  const commits = git(['rev-list', '--count', 'HEAD']).out.trim();
  const {base, paths, reason} = changedSinceBase(git);
  log(`workers-builds: PR branch ${branch}, commit ${env.WORKERS_CI_COMMIT_SHA ?? 'unknown'}, shallow clone ${shallow || 'unknown'}, ${commits || '?'} commit(s) in the clone.`);
  log(base
    ? `workers-builds: ${paths.length} path(s) changed since origin/${BASE_BRANCH} (${base.slice(0, 7)}); gitleaks mode: ${base.slice(0, 7)}..HEAD, the PR's commits.`
    : `workers-builds: ${WHY_NO_BASE[reason]}; gitleaks mode: ${fallbackScope({shallow, commits})}.`);
  const status = runSteps(prSteps({gitleaksRange: base ? `${base}..HEAD` : `--max-count=${FALLBACK_COMMITS}`, env}), {run, log});
  if (status !== 0) return status;
  headers();
  log(`workers-builds: wrote ${OUTPUT_DIR}/_headers with X-Robots-Tag: noindex for the Preview deployment.`);
  return 0;
}

// The release and the wiki run on main only, after the deploy and its live check pass. Both run
// even if the other fails, and the build is red if either does.
async function deploy(branch, {env, git, run, log, request, release, wiki}) {
  if (branch !== DEPLOY_BRANCH) {
    log(`workers-builds: only ${DEPLOY_BRANCH} deploys; ${branch} does not.`);
    return 1;
  }
  log(`workers-builds: ${branch} deploys gelpy-docs.`);
  const status = runSteps(deploySteps(), {run, log});
  if (status !== 0) return status;
  log('\n▶ GitHub Release');
  const intent = releaseIntent(git);
  log(`workers-builds: release intent: ${intent.kind === 'bump' ? `version ${intent.from} -> ${intent.version}` : intent.kind === 'same' ? `version ${intent.version} unchanged` : 'unknown'}.`);
  const released = await release({env, intent, request, log});
  log('\n▶ Wiki sync');
  const synced = wiki({env, log});
  return released || synced;
}

// What `wrangler preview` prints when the Preview deployment got no URL, for example while the
// Worker's Preview URLs setting is off. The PR check must not be green without a URL to review.
export const NO_PREVIEW_URL = 'no active URLs';

function preview(branch, {capture, log, noindex}) {
  if (branch === DEPLOY_BRANCH) {
    log(`workers-builds: ${branch} deploys; it creates no preview.`);
    return 0;
  }
  if (!noindex()) {
    log(`workers-builds: ${OUTPUT_DIR}/_headers has no X-Robots-Tag: noindex, so no preview is created.`);
    return 1;
  }
  let output = '';
  const status = runSteps([PREVIEW], {run: (current) => {
    const result = capture(current);
    output = result.output;
    return result.status;
  }, log});
  if (status !== 0) return status;
  if (output.includes(NO_PREVIEW_URL)) {
    log(`workers-builds: wrangler uploaded the preview but reports ${NO_PREVIEW_URL}; turn on the Worker's Preview URLs setting (Settings > Domains & Routes), then rebuild.`);
    return 1;
  }
  return 0;
}

export async function main(argv, {
  env = process.env,
  git = defaultGit,
  run = defaultRun,
  capture = defaultCapture,
  log = console.log,
  noindex = previewIsNoindex,
  headers = writeNoindexHeaders,
  request = globalThis.fetch,
  release = createRelease,
  wiki = updateWiki,
} = {}) {
  const [command] = argv;
  const commands = {build, deploy, preview};
  if (!Object.hasOwn(commands, command)) {
    log('Usage: node scripts/workers-builds.mjs build | deploy | preview [--branch <name>]');
    return 2;
  }
  let branch;
  try {
    branch = branchOf(argv, env);
  } catch (error) {
    log(`workers-builds: ${error.message}`);
    return 2;
  }
  return commands[command](branch, {env, git, run, capture, log, noindex, headers, request, release, wiki});
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2));
}
