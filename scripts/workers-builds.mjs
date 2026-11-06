// The docs' CI/CD on Cloudflare Workers Builds (ADR-0018, Work Item 003-025), ported from the
// gelpy-web pilot (003-019). One Worker, gelpy-docs (production branch main, previews on), with
// the default Workers Builds setup the owner chose on 2026-11-05 and the same three commands:
//   Build command:   npm run cf:build
//   Deploy command:  npm run cf:deploy
//   Preview command: npm run cf:preview
// The branch (WORKERS_CI_BRANCH, or --branch <name> locally) picks what each one does:
//   main  -> production build, deploy to gelpy-docs (docs.gelpy.app), live check, then the
//            GitHub Release v<version> (003-032) and the wiki sync (004-002)
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

export function buildStep(env, label) {
  return step(`Build (${label}, en and es)`, 'npm', ['run', 'build'], {env: brandEnv(env)});
}

// A PR branch's build: gitleaks over the PR's commits, then the site the Preview deployment
// serves. The tests ran in `npm run ci:local` before the push.
export function prSteps({gitleaksRange, env}) {
  return [
    GITLEAKS_INSTALL,
    step('gitleaks', join(TOOLS_DIR, 'gitleaks'), ['git', '--redact', '--no-banner', '--exit-code', '1', `--log-opts=${gitleaksRange}`, '.']),
    buildStep(env, 'preview'),
  ];
}

export function productionSteps(env) {
  return [buildStep(env, 'production')];
}

export function deploySteps() {
  return [
    step('Deploy (gelpy-docs)', 'npx', ['wrangler', 'deploy', '--config', WRANGLER_CONFIG]),
    step(`Verify the live site (${ORIGIN})`, 'node', ['scripts/check-public.mjs', '--live', ORIGIN]),
  ];
}

// A PR branch's Preview deployment. It refuses a build whose _headers lack noindex.
export const PREVIEW = step('Preview deployment', 'npx', ['wrangler', 'preview', '--config', WRANGLER_CONFIG]);

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

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Whether CHANGELOG.md has a section for the version. Feature PRs merge to main here (there is
// no staging), so until a release PR from release/v<version> adds that section, the version is
// not released yet and main's deploy creates no release.
export function hasSection(changelog, version) {
  return new RegExp(`^## \\[${escapeRegExp(version)}\\](?:\\s|$)`, 'm').test(changelog);
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

// Creates the release v<version> at the deployed commit, which creates the tag. A release that
// already exists passes (a rebuild of the same version). This repo merges features straight to
// main, so a CHANGELOG.md with no `## [<version>]` section means the version is not released yet:
// the step logs that and passes (Master decision of 2026-11-06, Work Items 003-025 and 003-032).
// Everything else fails the step, so a good deploy whose release failed shows as a red build: an
// API error, an empty section, or a missing WORKERS_CI_COMMIT_SHA. The token is sent only in the Authorization
// header and never logged, in whole or in part.
export async function createRelease({env, version = readVersion(), changelog = () => readFileSync('CHANGELOG.md', 'utf8'), request = globalThis.fetch, log = console.log}) {
  const token = env[RELEASE_TOKEN];
  if (!token) {
    log('workers-builds: release skipped: no token.');
    return 0;
  }
  const tag = `v${version}`;
  const fail = (reason) => {
    log(`workers-builds: deployed, but the release failed: ${reason}`);
    return 1;
  };
  let notes;
  try {
    const text = changelog();
    if (!hasSection(text, version)) {
      log(`workers-builds: no release: CHANGELOG.md has no section for ${version} yet; the release PR from release/${tag} adds it.`);
      return 0;
    }
    notes = extractReleaseNotes(text, version);
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
  const headers = {'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28'};
  try {
    const existing = await request(`${GITHUB_API}/repos/${RELEASE_REPO}/releases/tags/${tag}`, {headers});
    if (existing.status === 200) {
      log(`workers-builds: ${tag} already released.`);
      return 0;
    }
    if (existing.status !== 404) return fail(await apiError(existing));
    const commit = env.WORKERS_CI_COMMIT_SHA;
    if (!commit) return fail('WORKERS_CI_COMMIT_SHA is not set, so the tag would have no commit');
    const created = await request(`${GITHUB_API}/repos/${RELEASE_REPO}/releases`, {
      method: 'POST',
      headers: {...headers, 'Content-Type': 'application/json'},
      body: JSON.stringify({tag_name: tag, target_commitish: commit, name: `gelpy-docs ${tag}`, body: notes}),
    });
    if (created.status !== 201) return fail(await apiError(created));
    log(`workers-builds: released ${tag} at ${commit}.`);
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

export function defaultRun({cmd, args, env}) {
  let file;
  try {
    file = resolveCommand(cmd);
  } catch (error) {
    console.error(`workers-builds: ${error instanceof Error ? error.message : String(error)}`);
    return 127;
  }
  const result = spawnSync(file, args, {stdio: 'inherit', env: childEnv(withoutSecrets(process.env), env)});
  return result.status ?? 1;
}

// Like defaultRun, but also returns what the command printed, after echoing it to the log.
export function defaultCapture({cmd, args, env}, {stdout = process.stdout, stderr = process.stderr} = {}) {
  let file;
  try {
    file = resolveCommand(cmd);
  } catch (error) {
    const message = `workers-builds: ${error instanceof Error ? error.message : String(error)}`;
    stderr.write(`${message}\n`);
    return {status: 127, output: message};
  }
  const result = spawnSync(file, args, {encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, env: childEnv(withoutSecrets(process.env), env)});
  stdout.write(result.stdout ?? '');
  stderr.write(result.stderr ?? '');
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
    log(`workers-builds: ${branch} builds production.`);
    return runSteps(productionSteps(env), {run, log});
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
async function deploy(branch, {env, run, log, request, release, wiki}) {
  if (branch !== DEPLOY_BRANCH) {
    log(`workers-builds: only ${DEPLOY_BRANCH} deploys; ${branch} does not.`);
    return 1;
  }
  log(`workers-builds: ${branch} deploys gelpy-docs.`);
  const status = runSteps(deploySteps(), {run, log});
  if (status !== 0) return status;
  log('\n▶ GitHub Release');
  const released = await release({env, request, log});
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
