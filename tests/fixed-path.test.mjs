// SonarCloud javascript:S4036: children run from fixed directories only, never the inherited PATH.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {delimiter} from 'node:path';

import {SYSTEM_DIRS, childEnv, fixedDirs, fixedPath, resolveCommand} from '../scripts/lib/fixed-path.mjs';

test('the fixed PATH is this Node binary\'s directory, then the system directories, once each', () => {
  assert.deepEqual(fixedDirs('/opt/node/bin/node'), ['/opt/node/bin', ...SYSTEM_DIRS]);
  assert.deepEqual(fixedDirs('/usr/bin/node'), ['/usr/bin', '/usr/local/bin', '/bin']);
  assert.equal(fixedPath('/opt/node/bin/node'), ['/opt/node/bin', '/usr/local/bin', '/usr/bin', '/bin'].join(delimiter));
  assert.ok(fixedDirs().includes('/usr/bin'));
});

test('resolveCommand: node, paths from the working directory, names from the fixed directories only', () => {
  const executable = (file) => file === '/usr/bin/git' || file === '/opt/node/bin/npx';
  const options = {execPath: '/opt/node/bin/node', cwd: '/repo', executable};
  assert.equal(resolveCommand('node', options), '/opt/node/bin/node');
  assert.equal(resolveCommand('npx', options), '/opt/node/bin/npx');
  assert.equal(resolveCommand('git', options), '/usr/bin/git');
  assert.equal(resolveCommand('.tools/bin/gitleaks', options), '/repo/.tools/bin/gitleaks');
  assert.equal(resolveCommand('/abs/tool', options), '/abs/tool');
  assert.throws(() => resolveCommand('evil', options), {message: `evil is not in ${fixedPath('/opt/node/bin/node')}.`});
});

test('resolveCommand finds real executables and ignores the inherited PATH', () => {
  const saved = process.env.PATH;
  process.env.PATH = '/tmp/attacker';
  try {
    assert.match(resolveCommand('git'), /^\/(usr\/(local\/)?)?bin\/git$/);
    assert.equal(resolveCommand('node'), process.execPath);
  } finally {
    process.env.PATH = saved;
  }
  assert.throws(() => resolveCommand('no-such-command-gelpy'), /no-such-command-gelpy is not in/);
});

test('childEnv replaces PATH after any extra variables', () => {
  const env = childEnv({PATH: '/tmp/attacker', HOME: '/home/x'}, {EXTRA: 't', PATH: '/also/not'}, '/opt/node/bin/node');
  assert.deepEqual(env, {HOME: '/home/x', EXTRA: 't', PATH: fixedPath('/opt/node/bin/node')});
  assert.equal(childEnv().PATH, fixedPath());
});
