// Policy of the docs' CI/CD on Cloudflare Workers Builds (ADR-0018, Work Item 003-025 AC-3),
// with "MVP mode": Cloudflare only builds and deploys, and every test runs in `npm run ci:local`.
// The PR path reads no deploy secret, never deploys for real, and runs only gitleaks and the
// build; only main deploys. The GitHub workflows stay as a dispatch-only failover. The release
// token (003-032) and the wiki token (004-002) are read only by main's deploy.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync, readFileSync} from 'node:fs';
import {join} from 'node:path';

import {CREDENTIALS, PREVIEW, RELEASE_TOKEN, SECRETS, WIKI_TOKEN, deploySteps, main, prSteps, productionSteps} from '../scripts/workers-builds.mjs';

// Secrets that only a deploy may hold (infrastructure/workers-builds.yml, deploy_secret_names).
const DEPLOY_SECRETS = ['EXPO_TOKEN', 'DATABASE_URL', 'TEST_DATABASE_URL', 'GELPY_PACKAGES_PUBLISH_TOKEN', 'SONAR_TOKEN'];
const scripts = JSON.parse(readFileSync('package.json', 'utf8')).scripts;
const source = readFileSync('scripts/workers-builds.mjs', 'utf8');
const installer = readFileSync('scripts/install-scanners.sh', 'utf8');
const commandOf = (step) => [step.cmd, ...step.args].join(' ');
const prCommands = () => [...prSteps({gitleaksRange: 'a..b', env: {}}), PREVIEW].map(commandOf);
const scriptFiles = () => readdirSync('scripts', {recursive: true, withFileTypes: true}).filter((entry) => entry.isFile()).map((entry) => join(entry.parentPath, entry.name));

test('every setting uses the same three commands, plus the local gate and its evidence', () => {
  assert.equal(scripts['cf:build'], 'node scripts/workers-builds.mjs build');
  assert.equal(scripts['cf:deploy'], 'node scripts/workers-builds.mjs deploy');
  assert.equal(scripts['cf:preview'], 'node scripts/workers-builds.mjs preview');
  assert.deepEqual(Object.keys(scripts).filter((name) => name.startsWith('cf:')).sort(), ['cf:build', 'cf:deploy', 'cf:preview']);
  assert.equal(scripts['ci:evidence'], 'node scripts/ci-evidence.mjs');
  assert.ok(readFileSync('.gitignore', 'utf8').split('\n').includes('ci-evidence.md'));
  for (const check of ['npm audit --audit-level=high', 'npm test', 'npm run check:public', 'npm run check:brand', 'node scripts/build-wiki.mjs', 'npm run build', 'npm run deploy:dry-run']) {
    assert.ok(scripts['ci:local'].includes(check), check);
  }
});

test('the PR path reads no deploy secret and names the Cloudflare credentials only to report them', () => {
  const prPath = [...prCommands(), installer, scripts['cf:build'], scripts['cf:preview']].join('\n');
  for (const name of [...DEPLOY_SECRETS, ...CREDENTIALS, ...SECRETS]) assert.ok(!prPath.includes(name), name);
  for (const name of DEPLOY_SECRETS) assert.ok(!source.includes(name), name);
  assert.deepEqual(CREDENTIALS, ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID']);
  const rest = source.replace("export const CREDENTIALS = ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID'];", '');
  for (const name of CREDENTIALS) assert.ok(!rest.includes(name), name);
});

test('a PR build never deploys for real: gitleaks, the build, and the Preview deployment only', () => {
  const commands = prCommands();
  assert.deepEqual(commands.filter((command) => /\bnpm run\b/.test(command)), ['npm run build']);
  assert.ok(commands.some((command) => command.startsWith('.tools/bin/gitleaks git --redact')));
  const wrangler = commands.filter((command) => /\bwrangler\b/.test(command));
  assert.deepEqual(wrangler, ['npx wrangler preview --config wrangler.jsonc']);
  assert.ok(source.includes("includes('X-Robots-Tag: noindex')"));
});

test('only main deploys, and every wrangler call names wrangler.jsonc', () => {
  assert.ok(source.includes("export const DEPLOY_BRANCH = 'main';"));
  const calls = [
    ...Object.values(scripts).flatMap((script) => script.split('&&').map((part) => part.trim())),
    ...[...prSteps({gitleaksRange: 'a..b', env: {}}), PREVIEW, ...productionSteps({}), ...deploySteps()].map(commandOf),
  ].filter((command) => /\bwrangler (deploy|preview|versions)\b/.test(command));
  assert.ok(calls.length >= 3);
  for (const command of calls) assert.ok(command.includes('--config wrangler.jsonc'), command);
});

test('the Worker serves the static build with previews and the docs domain', () => {
  const config = readFileSync('wrangler.jsonc', 'utf8');
  assert.match(config, /"name": "gelpy-docs"/);
  assert.match(config, /"directory": "build"/);
  assert.match(config, /"not_found_handling": "404-page"/);
  assert.match(config, /"preview_urls": true/);
  assert.match(config, /"previews": \{\}/);
  assert.match(config, /"workers_dev": false/);
  assert.match(config, /\{ "pattern": "docs\.gelpy\.app", "custom_domain": true \}/);
  assert.doesNotMatch(config, /"main":/, 'assets only, no Worker script');
  assert.match(JSON.parse(readFileSync('package.json', 'utf8')).devDependencies.wrangler, /^\d+\.\d+\.\d+$/, 'wrangler pinned exactly');
});

test('gitleaks is pinned by version and SHA-256, into an absolute bin dir', () => {
  assert.ok(installer.includes('GITLEAKS_VERSION="8.30.0"'));
  assert.ok(installer.includes('sha256sum --strict -c "$root/security/tools.sha256"'));
  assert.ok(installer.includes('bin="$(cd "$bin" && pwd)"'));
  assert.match(readFileSync('security/tools.sha256', 'utf8'), /^[0-9a-f]{64} {2}gitleaks_8\.30\.0_linux_x64\.tar\.gz\n$/);
});

test('@gelpy/design-system installs with the read-only packages token', () => {
  assert.ok(readFileSync('.npmrc', 'utf8').includes('//npm.pkg.github.com/:_authToken=${GELPY_PACKAGES_TOKEN}'));
});

test('every GitHub workflow is kept, dispatch-only, with its triggers under # FAILOVER', () => {
  const dir = '.github/workflows';
  const files = readdirSync(dir).filter((name) => /\.ya?ml$/.test(name));
  assert.deepEqual(files, ['pages.yml'], 'no workflow deleted');
  for (const name of files) {
    const text = readFileSync(join(dir, name), 'utf8');
    const on = text.slice(text.search(/^on:/m)).split('\n').slice(0, 3);
    assert.deepEqual(on.slice(0, 2), ['on:', '  workflow_dispatch:'], name);
    assert.ok(!/^ {2}[a-z_]+:/.test(on[2]), `${name} has no other trigger`);
    const failover = text.slice(text.indexOf('# FAILOVER'), text.search(/^on:/m));
    assert.match(failover, /^# on:\n# {3}push:\n# {5}branches: \[main\]\n# {3}pull_request:/m, name);
  }
});

test('only main\'s deploy reads the production secrets', async () => {
  assert.equal(RELEASE_TOKEN, 'GELPY_RELEASE_TOKEN');
  assert.equal(WIKI_TOKEN, 'GELPY_WIKI_TOKEN');
  const watched = (values) => {
    const reads = new Set();
    const env = new Proxy(values, {get: (target, name) => (reads.add(String(name)), target[String(name)]), ownKeys: (target) => (reads.add('*'), Reflect.ownKeys(target))});
    return {env, reads};
  };
  const quiet = {git: () => ({ok: false, out: ''}), run: () => 0, log: () => {}, noindex: () => true, headers: () => {}};
  const values = {GELPY_RELEASE_TOKEN: 'r', GELPY_WIKI_TOKEN: 'w'};
  for (const [command, branch] of [['build', 'claude/x'], ['preview', 'claude/x'], ['deploy', 'claude/x'], ['build', 'main'], ['preview', 'main']]) {
    const {env, reads} = watched({...values, WORKERS_CI_BRANCH: branch});
    let called = 0;
    await main([command], {...quiet, env, request: () => called++, release: () => called++, wiki: () => called++});
    for (const name of [...SECRETS, '*']) assert.ok(!reads.has(name), `${command} on ${branch} reads ${name}`);
    assert.equal(called, 0, `${command} on ${branch} releases nothing and syncs nothing`);
  }
});

test('the token names appear in no other script, and no child process gets them', () => {
  for (const name of SECRETS) {
    const mentions = scriptFiles().filter((file) => readFileSync(file, 'utf8').includes(name));
    assert.deepEqual(mentions, ['scripts/workers-builds.mjs'], name);
    assert.ok(!readFileSync('package.json', 'utf8').includes(name));
  }
  assert.equal((source.match(/childEnv\(/g) ?? []).length, (source.match(/childEnv\(withoutSecrets\(process\.env\)/g) ?? []).length);
});
