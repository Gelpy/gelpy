// scripts/install-scanners.sh, run for real with no network: a stub curl serves a fake gitleaks
// tarball whose SHA-256 is the one in a temporary security/tools.sha256. The pilot's first
// Workers Builds build failed because a relative <bin-dir> resolved inside the script's
// temporary directory; this runs it the way cf:build does, with `.tools/bin`.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

import {resolveCommand} from '../scripts/lib/fixed-path.mjs';

const TARBALL = 'gitleaks_8.30.0_linux_x64.tar.gz';

function setup({tamper = false} = {}) {
  const root = mkdtempSync(join(tmpdir(), 'install-scanners-'));
  const repo = join(root, 'repo');
  mkdirSync(join(repo, 'scripts'), {recursive: true});
  mkdirSync(join(repo, 'security'));
  copyFileSync('scripts/install-scanners.sh', join(repo, 'scripts/install-scanners.sh'));
  const payload = join(root, 'payload');
  mkdirSync(payload);
  writeFileSync(join(payload, 'gitleaks'), '#!/bin/sh\necho 8.30.0\n');
  chmodSync(join(payload, 'gitleaks'), 0o755);
  const tarball = join(root, TARBALL);
  assert.equal(spawnSync(resolveCommand('tar'), ['-czf', tarball, '-C', payload, 'gitleaks']).status, 0);
  const hash = createHash('sha256').update(readFileSync(tarball)).digest('hex');
  writeFileSync(join(repo, 'security/tools.sha256'), `${tamper ? '0'.repeat(64) : hash}  ${TARBALL}\n`);
  const stub = join(root, 'stub');
  mkdirSync(stub);
  // The last argument is the URL; -O saves it under its basename in the working directory.
  writeFileSync(join(stub, 'curl'), `#!/bin/sh\nfor last; do :; done\ncp "${tarball}" "./$(basename "$last")"\n`);
  chmodSync(join(stub, 'curl'), 0o755);
  return {root, repo, stub};
}

const run = (repo, stub) => spawnSync(resolveCommand('bash'), ['scripts/install-scanners.sh', '.tools/bin'], {
  cwd: repo,
  encoding: 'utf8',
  env: {PATH: `${stub}:/usr/local/bin:/usr/bin:/bin`},
});

test('installs gitleaks into a relative bin dir, as cf:build passes it', () => {
  const {root, repo, stub} = setup();
  try {
    const result = run(repo, stub);
    assert.equal(result.status, 0, result.stderr);
    assert.ok(result.stdout.includes(`${TARBALL}: OK`));
    assert.equal(result.stdout.trim().split('\n').at(-1), '8.30.0');
    assert.ok(existsSync(join(repo, '.tools/bin/gitleaks')));
  } finally {
    rmSync(root, {recursive: true, force: true});
  }
});

test('extracts nothing when the SHA-256 does not match', () => {
  const {root, repo, stub} = setup({tamper: true});
  try {
    const result = run(repo, stub);
    assert.notEqual(result.status, 0);
    assert.ok(`${result.stdout}${result.stderr}`.includes('FAILED'));
    assert.ok(!existsSync(join(repo, '.tools/bin/gitleaks')));
  } finally {
    rmSync(root, {recursive: true, force: true});
  }
});
