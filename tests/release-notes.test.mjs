import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

import {extractReleaseNotes, main} from '../scripts/release-notes.mjs';

const CHANGELOG = `# Changelog

## [Unreleased]

- Pending change.

## [0.2.0] - 2026-12-01

### Added

- Second release.

## [0.1.0] - 2026-11-02

### Added

- First release.
`;

test('extractReleaseNotes returns only the requested section', () => {
  assert.equal(extractReleaseNotes(CHANGELOG, '0.2.0'), '### Added\n\n- Second release.\n');
  assert.equal(extractReleaseNotes(CHANGELOG.replace(/\n/g, '\r\n'), '0.1.0'), '### Added\n\n- First release.\n');
});

test('extractReleaseNotes rejects a bad version, a missing section, or an empty one', () => {
  assert.throws(() => extractReleaseNotes(CHANGELOG, 'v1'), /Invalid version "v1"/);
  assert.throws(() => extractReleaseNotes(CHANGELOG, '9.9.9'), /no section for 9\.9\.9/);
  assert.throws(() => extractReleaseNotes('## [1.0.0]\n\n## [0.9.0]\n', '1.0.0'), /section for 1\.0\.0 is empty/);
});

test('main prints the notes or writes them to a file', () => {
  const dir = mkdtempSync(join(tmpdir(), 'release-notes-'));
  try {
    const changelog = join(dir, 'CHANGELOG.md');
    writeFileSync(changelog, CHANGELOG);
    const log = [];
    assert.equal(main(['0.2.0', changelog], (line) => log.push(line)), '### Added\n\n- Second release.\n');
    assert.deepEqual(log, ['### Added\n\n- Second release.\n']);
    const out = join(dir, 'notes.md');
    main(['0.1.0', changelog, out], (line) => log.push(line));
    assert.equal(readFileSync(out, 'utf8'), '### Added\n\n- First release.\n');
    assert.match(log.at(-1), /Wrote release notes for 0\.1\.0/);
  } finally {
    rmSync(dir, {recursive: true, force: true});
  }
});
