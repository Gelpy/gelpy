import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

import {
  DEFAULT_TARGETS,
  collectFiles,
  formatFinding,
  main,
  redact,
  scanFiles,
  scanText,
  urlProblem,
} from '../scripts/check-public.mjs';

// Fake values are assembled at runtime so no secret-shaped literal is
// committed to this public repository.
const j = (...parts) => parts.join('');
const FAKE = {
  privateKey: j('-----BEGIN ', 'RSA PRIVATE', ' KEY-----'),
  githubToken: j('gh', 'p_', 'a'.repeat(36)),
  githubPat: j('github', '_pat_', 'B'.repeat(30)),
  awsKey: j('AK', 'IA', 'ABCDEFGHIJKLMNOP'),
  googleKey: j('AI', 'za', 'c'.repeat(35)),
  slackToken: j('xo', 'xb-', '1234567890-abc'),
  stripeKey: j('sk', '_live_', 'd'.repeat(24)),
  jwt: j('ey', 'J', 'e'.repeat(12), '.ey', 'J', 'f'.repeat(12), '.', 'g'.repeat(12)),
  credentialUrl: j('postgres', '://user:', 'hunter22', '@db.example.org/app'),
  assignment: j('api_key', ' = "', 'h'.repeat(16), '"'),
  testHost: j('api', '-test', '.gelpy.app'),
  testWorker: j('gelpy-api', '-test'),
  internalHost: j('db.', 'internal'),
  localhost: j('local', 'host'),
  platformHost: j('my-app.', 'workers', '.dev'),
  ipv4: j('10.', '0.', '0.', '12'),
  ipv6: j('fd12', ':3456', '::1'),
  email: j('someone', '@', 'example.com'),
  phone: j('+51 ', '987 ', '654 ', '321'),
  referenceTerm: j('Port', 'folio'),
};

const rulesFor = (text) => scanText(text).map((f) => f.rule);

test('clean text has no findings', () => {
  const text = [
    'Gelpy connects people with help.',
    'See https://docs.gelpy.app and https://gelpy.app/en/.',
    'Source: https://github.com/Gelpy/gelpy/tree/main/docs',
    'Docusaurus 3.10.2 with Node 22 and version 1.2.3.',
    "themes: ['@docusaurus/theme-mermaid']",
  ].join('\n');
  assert.deepEqual(scanText(text), []);
});

test('detects each secret pattern', () => {
  const cases = {
    'private-key': FAKE.privateKey,
    'github-token': `${FAKE.githubToken} ${FAKE.githubPat}`,
    'aws-access-key': FAKE.awsKey,
    'google-api-key': FAKE.googleKey,
    'slack-token': FAKE.slackToken,
    'stripe-key': FAKE.stripeKey,
    jwt: FAKE.jwt,
    'credential-in-url': FAKE.credentialUrl,
    'secret-assignment': FAKE.assignment,
  };
  for (const [rule, text] of Object.entries(cases)) {
    assert.ok(rulesFor(text).includes(rule), `${rule} not detected`);
  }
});

test('detects internal hosts and addresses', () => {
  const cases = {
    'test-host': FAKE.testHost,
    'test-worker': FAKE.testWorker,
    'internal-host': `${FAKE.internalHost} ${FAKE.localhost}`,
    'platform-host': FAKE.platformHost,
    ipv4: `Server at ${FAKE.ipv4}.`,
    'ipv6-private': FAKE.ipv6,
  };
  for (const [rule, text] of Object.entries(cases)) {
    assert.ok(rulesFor(text).includes(rule), `${rule} not detected`);
  }
});

test('version strings are not IP addresses', () => {
  assert.ok(!rulesFor('version 1.2.3.4.5').includes('ipv4'));
  assert.ok(!rulesFor('Node 22.23.4').includes('ipv4'));
});

test('detects personal data and reference project terms', () => {
  assert.ok(rulesFor(FAKE.email).includes('email'));
  assert.ok(rulesFor(`Call ${FAKE.phone}`).includes('phone'));
  assert.ok(rulesFor(FAKE.referenceTerm).includes('reference-project-term'));
});

test('URL allowlist', () => {
  assert.equal(urlProblem('https://docs.gelpy.app/es/'), null);
  assert.equal(urlProblem('https://www.unicode.org/cldr/'), null);
  assert.equal(urlProblem('https://edgardo-gutierrez.com'), null);
  assert.equal(urlProblem('https://other.edgardo-gutierrez.com'), 'host is not on the public allowlist');
  assert.equal(urlProblem('https://github.com/Gelpy/gelpy'), null);
  assert.equal(urlProblem('https://github.com/Gelpy/gelpy/edit/main/docs'), null);
  assert.match(urlProblem('https://github.com/Gelpy/gelpy-api'), /outside Gelpy\/gelpy/);
  assert.match(urlProblem('https://example.com/x'), /not on the public allowlist/);
  assert.equal(urlProblem('https://'), 'unparseable URL');
  assert.ok(rulesFor('see https://example.com/page').includes('url-not-allowed'));
});

test('findings carry position and a redacted excerpt', () => {
  const [finding] = scanText(`line one\n  ${FAKE.githubToken}`, 'docs/x.md');
  assert.equal(finding.file, 'docs/x.md');
  assert.equal(finding.line, 2);
  assert.equal(finding.column, 3);
  assert.ok(!finding.excerpt.includes(FAKE.githubToken));
  assert.match(formatFinding(finding), /^docs\/x\.md:2:3 secret\/github-token: ghp/);
  assert.match(formatFinding({...finding, detail: 'why'}), /\(why\)/);
});

test('redact masks short and long values', () => {
  assert.equal(redact('abc'), '•••');
  assert.equal(redact('abcdefghijklmnop'), 'abc••••••••');
});

function fixtureTree() {
  const root = mkdtempSync(join(tmpdir(), 'check-public-'));
  mkdirSync(join(root, 'docs', 'node_modules'), {recursive: true});
  mkdirSync(join(root, 'static'), {recursive: true});
  writeFileSync(join(root, 'docs', 'clean.md'), '# Clean\n');
  writeFileSync(join(root, 'docs', 'node_modules', 'skip.md'), FAKE.email);
  writeFileSync(join(root, 'static', 'logo.bin'), Buffer.from([0, 1, 2, 3]));
  writeFileSync(join(root, 'sidebars.js'), 'module.exports = {};\n');
  return root;
}

test('collectFiles walks targets and skips build folders', () => {
  const root = fixtureTree();
  try {
    const files = collectFiles(DEFAULT_TARGETS, root).map((f) => f.slice(root.length + 1));
    assert.deepEqual(files.sort(), ['docs/clean.md', 'sidebars.js', 'static/logo.bin']);
    const {scanned, findings} = scanFiles(collectFiles(DEFAULT_TARGETS, root), root);
    assert.equal(scanned, 2);
    assert.deepEqual(findings, []);
  } finally {
    rmSync(root, {recursive: true, force: true});
  }
});

test('main exits 0 on clean content and 1 on findings', () => {
  const root = fixtureTree();
  const out = [];
  const err = [];
  const io = {root, log: (m) => out.push(m), error: (m) => err.push(m)};
  try {
    assert.equal(main([], io), 0);
    assert.match(out.at(-1), /0 findings$/);

    writeFileSync(join(root, 'docs', 'leak.md'), `Contact ${FAKE.email}\n`);
    assert.equal(main([], io), 1);
    assert.ok(err.some((m) => m.startsWith('docs/leak.md:1:9 personal-data/email')));
    assert.match(err.at(-1), /1 findings$/);

    assert.equal(main(['docs/clean.md'], io), 0);
  } finally {
    rmSync(root, {recursive: true, force: true});
  }
});
