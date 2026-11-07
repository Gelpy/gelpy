import {test} from 'node:test';
import assert from 'node:assert/strict';

import {createServer} from 'node:http';

import {LIVE_ATTEMPTS, LIVE_DELAY_MS, LIVE_PATHS, LIVE_TIMEOUT_MS, LIVE_WINDOW_MS, checkLive, cli, describeAttempt, liveProblem} from '../scripts/check-public.mjs';

const page = (lang, headers = {}, status = 200) => ({
  status,
  headers: new Headers({'server': 'cloudflare', 'content-type': 'text/html; charset=utf-8', ...headers}),
  text: async () => `<!doctype html><html lang="${lang}" dir="ltr">`,
});

test('liveProblem accepts the Worker and rejects GitHub Pages or a wrong page', () => {
  const ok = (lang, extra) => ({status: 200, headers: new Headers({server: 'cloudflare', 'content-type': 'text/html', ...extra}), body: `<html lang="${lang}">`});
  assert.equal(liveProblem(ok('en'), 'en'), null);
  assert.equal(liveProblem({...ok('en'), status: 404}, 'en'), 'status 404');
  assert.equal(liveProblem(ok('en', {'x-github-request-id': 'x'}), 'en'), 'served by GitHub Pages');
  assert.equal(liveProblem(ok('en', {server: 'GitHub.com'}), 'en'), 'not served by Cloudflare');
  assert.equal(liveProblem({status: 200, headers: new Headers({'content-type': 'text/html'}), body: ''}, 'en'), 'not served by Cloudflare');
  assert.equal(liveProblem({status: 200, headers: new Headers({server: 'cloudflare'}), body: ''}, 'en'), 'not HTML');
  assert.equal(liveProblem(ok('en'), 'es'), 'no <html lang="es">');
});

test('checkLive passes when / and /es/ come from the Worker', async () => {
  const urls = [];
  const log = [];
  const request = async (url) => (urls.push(url), page(url.endsWith('/es/') ? 'es' : 'en'));
  assert.equal(await checkLive('https://docs.gelpy.app', {request, log: (line) => log.push(line)}), 0);
  assert.deepEqual(urls, LIVE_PATHS.map(({path}) => `https://docs.gelpy.app${path}`));
  assert.deepEqual(log, ['check:public --live: https://docs.gelpy.app/: 200 from Cloudflare (en)', 'check:public --live: https://docs.gelpy.app/es/: 200 from Cloudflare (es)']);
});

test('checkLive retries, then fails with the reason', async () => {
  let calls = 0;
  const waits = [];
  const errors = [];
  const request = async (url) => {
    calls += 1;
    if (calls === 1) throw new Error('certificate pending');
    return url.endsWith('/es/') ? page('es', {'x-github-request-id': '1'}) : page('en');
  };
  const status = await checkLive('https://docs.gelpy.app', {request, wait: async (ms) => waits.push(ms), attempts: 3, delayMs: 5, log: () => {}, error: (line) => errors.push(line)});
  assert.equal(status, 1);
  assert.equal(calls, 5, '2 for / (one retry), 3 for /es/');
  assert.deepEqual(waits, [5, 5, 5]);
  assert.deepEqual(errors, ['check:public --live: https://docs.gelpy.app/es/: served by GitHub Pages']);
});

test('cli runs the live check, needs an origin, and falls back to the content scan', async () => {
  const errors = [];
  assert.equal(await cli(['--live'], {error: (line) => errors.push(line)}), 2);
  assert.match(errors[0], /^Usage/);
  assert.equal(await cli(['--live', 'https://docs.gelpy.app'], {request: async (url) => page(url.endsWith('/es/') ? 'es' : 'en'), log: () => {}}), 0);
  assert.equal(await cli(['docs'], {log: () => {}}), 0);
  const saved = console.error;
  console.error = (line) => errors.push(line);
  try {
    assert.equal(await cli(['--live']), 2);
  } finally {
    console.error = saved;
  }
});

test('the live window is 5 minutes per path: 30 attempts, 10 s apart', async () => {
  assert.equal(LIVE_ATTEMPTS, 30);
  assert.equal(LIVE_DELAY_MS, 10_000);
  let calls = 0;
  const waits = [];
  const status = await checkLive('https://docs.gelpy.app', {request: async () => (calls++, page('en', {}, 503)), wait: async (ms) => waits.push(ms), log: () => {}, error: () => {}});
  assert.equal(status, 1);
  assert.equal(calls, 2 * LIVE_ATTEMPTS);
  assert.equal(waits.length, 2 * (LIVE_ATTEMPTS - 1));
  assert.ok(waits.every((ms) => ms === LIVE_DELAY_MS));
});

test('describeAttempt names the status and server, or a TLS or network error', () => {
  assert.equal(describeAttempt({response: page('en', {server: 'GitHub.com'}, 404)}), 'status 404, server GitHub.com');
  assert.equal(describeAttempt({response: {status: 200, headers: new Headers()}}), 'status 200, server none');
  const tls = Object.assign(new Error('fetch failed'), {cause: {code: 'ERR_TLS_CERT_ALTNAME_INVALID'}});
  assert.equal(describeAttempt({failure: tls}), 'TLS error: fetch failed (ERR_TLS_CERT_ALTNAME_INVALID)');
  const handshake = Object.assign(new Error('fetch failed'), {cause: {message: 'SSL alert handshake failure'}});
  assert.equal(describeAttempt({failure: handshake}), 'TLS error: fetch failed');
  assert.equal(describeAttempt({failure: Object.assign(new Error('getaddrinfo'), {code: 'ENOTFOUND'})}), 'network error: getaddrinfo (ENOTFOUND)');
  assert.equal(describeAttempt({failure: new Error('reset')}), 'network error: reset');
  assert.equal(describeAttempt({failure: Object.assign(new Error('x'), {cause: {code: 'DEPTH_ZERO_SELF_SIGNED_CERT'}})}), 'TLS error: x (DEPTH_ZERO_SELF_SIGNED_CERT)');
});

test('every failed attempt is logged with what it saw', async () => {
  const log = [];
  let calls = 0;
  const tls = Object.assign(new Error('fetch failed'), {cause: {code: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE'}});
  const request = async (url) => {
    calls += 1;
    if (calls === 1) throw tls;
    if (calls === 2) return page('en', {'server': 'GitHub.com', 'x-github-request-id': '1'});
    return page(url.endsWith('/es/') ? 'es' : 'en');
  };
  assert.equal(await checkLive('https://docs.gelpy.app', {request, wait: async () => {}, attempts: 5, log: (line) => log.push(line), error: () => {}}), 0);
  assert.deepEqual(log, [
    'check:public --live: https://docs.gelpy.app/: attempt 1/5: TLS error: fetch failed (UNABLE_TO_VERIFY_LEAF_SIGNATURE)',
    'check:public --live: https://docs.gelpy.app/: attempt 2/5: status 200, server GitHub.com; served by GitHub Pages',
    'check:public --live: https://docs.gelpy.app/: 200 from Cloudflare (en)',
    'check:public --live: https://docs.gelpy.app/es/: 200 from Cloudflare (es)',
  ]);
});

test('a stalled body is aborted by the per-request timeout (real fetch, local server)', async () => {
  const server = createServer((req, res) => {
    res.writeHead(200, {'content-type': 'text/html', 'server': 'cloudflare'});
    res.write('<html lang="en">');
    // Never ends the body: only the timeout can finish this request.
  });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const log = [];
  const errors = [];
  const start = Date.now();
  try {
    const status = await checkLive(origin, {wait: async () => {}, attempts: 2, timeoutMs: 200, log: (line) => log.push(line), error: (line) => errors.push(line)});
    assert.equal(status, 1);
  } finally {
    server.closeAllConnections();
    server.close();
  }
  assert.ok(Date.now() - start < 5000, 'four 200 ms timeouts, not a hang');
  assert.equal(log.length, 4);
  assert.match(log[0], /attempt 1\/2: network error: .*(abort|timeout)/i);
  assert.equal(errors.length, 2);
});

test('no attempt starts after the per-path window ends', async () => {
  assert.equal(LIVE_TIMEOUT_MS, 10_000);
  assert.equal(LIVE_WINDOW_MS, 300_000);
  let clock = 0;
  let calls = 0;
  const errors = [];
  const request = async () => {
    calls += 1;
    clock += 40_000; // A slow attempt.
    return page('en', {}, 503);
  };
  const status = await checkLive('https://docs.gelpy.app', {request, now: () => clock, wait: async (ms) => { clock += ms; }, log: () => {}, error: (line) => errors.push(line)});
  assert.equal(status, 1);
  assert.equal(calls, 12, '6 attempts per path fit in 300 s at 50 s each');
  assert.match(errors[0], /status 503 \(gave up: the 300 s window ended\)$/);
});

// --- DNS over HTTPS fallback (Gelpy/gelpy#22) ----------------------------------------------------

const dnsMiss = () => Object.assign(new Error('fetch failed'), {cause: {code: 'ENOTFOUND'}});

test('isDnsMiss knows the resolver errors of a missing name', async () => {
  const {isDnsMiss} = await import('../scripts/check-public.mjs');
  assert.equal(isDnsMiss(dnsMiss()), true);
  assert.equal(isDnsMiss(Object.assign(new Error('x'), {code: 'EAI_AGAIN'})), true);
  assert.equal(isDnsMiss(Object.assign(new Error('x'), {cause: {code: 'ECONNRESET'}})), false);
  assert.equal(isDnsMiss(undefined), false);
});

test('resolveViaDoh reads the first A record, and fails on a bad answer', async () => {
  const {DOH_URL, resolveViaDoh} = await import('../scripts/check-public.mjs');
  const seen = [];
  const answer = (status, body) => async (url, options) => (seen.push({url, options}), {status, json: async () => body});
  const ok = answer(200, {Answer: [{type: 5, data: 'alias.example.'}, {type: 1, data: '192.0.2.10'}, {type: 1, data: '192.0.2.11'}]});
  assert.equal(await resolveViaDoh('docs.gelpy.app', {request: ok}), '192.0.2.10');
  assert.equal(seen[0].url, `${DOH_URL}?name=docs.gelpy.app&type=A`);
  assert.equal(seen[0].options.headers.accept, 'application/dns-json');
  assert.ok(seen[0].options.signal instanceof AbortSignal);
  await assert.rejects(resolveViaDoh('docs.gelpy.app', {request: answer(503, {})}), /DNS over HTTPS answered 503/);
  await assert.rejects(resolveViaDoh('docs.gelpy.app', {request: answer(200, {Status: 3})}), /no A record for docs\.gelpy\.app/);
  await assert.rejects(resolveViaDoh('docs.gelpy.app', {request: answer(200, null)}), /no A record/);
});

test('fetchPinned connects to the given address for a name the resolver does not know (real server)', async () => {
  const {fetchPinned} = await import('../scripts/check-public.mjs');
  const {createServer} = await import('node:http');
  const hosts = [];
  const server = createServer((req, res) => {
    hosts.push(req.headers.host);
    res.writeHead(200, {'content-type': 'text/html', 'server': 'cloudflare', 'set-cookie': ['a=1', 'b=2']});
    res.end('<html lang="es">');
  });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  const port = server.address().port;
  try {
    const response = await fetchPinned(`http://docs.example.invalid:${port}/es/`, '127.0.0.1');
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('server'), 'cloudflare');
    assert.equal(response.headers.get('set-cookie'), 'a=1, b=2');
    assert.equal(await response.text(), '<html lang="es">');
    assert.deepEqual(hosts, [`docs.example.invalid:${port}`], 'the request keeps the real Host');
  } finally {
    await new Promise((done) => server.close(done));
  }
  // The same pinned address with nothing listening any more: the connection error surfaces.
  await assert.rejects(fetchPinned(`http://docs.example.invalid:${port}/`, '127.0.0.1', {timeoutMs: 1000}), /ECONNREFUSED/);
});

test('viaDoh resolves, then fetches pinned; the default checkLive uses it on a DNS miss', async () => {
  const {viaDoh} = await import('../scripts/check-public.mjs');
  const {createServer} = await import('node:http');
  const server = createServer((req, res) => {
    res.writeHead(200, {'content-type': 'text/html', 'server': 'cloudflare'});
    res.end(req.url.startsWith('/es/') ? '<html lang="es">' : '<html lang="en">');
  });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  const origin = `http://docs.example.invalid:${server.address().port}`;
  const doh = async (url) => (url.startsWith('https://cloudflare-dns.com/') ? {status: 200, json: async () => ({Answer: [{type: 1, data: '127.0.0.1'}]})} : Promise.reject(dnsMiss()));
  try {
    const {address, response} = await viaDoh(`${origin}/`, {request: doh});
    assert.equal(address, '127.0.0.1');
    assert.equal(response.status, 200);
    const log = [];
    assert.equal(await checkLive(origin, {request: doh, wait: async () => {}, log: (line) => log.push(line), error: () => {}}), 0);
    assert.match(log[0], /attempt 1\/30: network error: fetch failed \(ENOTFOUND\); via DNS over HTTPS \(127\.0\.0\.1\): status 200, server cloudflare$/);
    assert.match(log.at(-1), /\/es\/: 200 from Cloudflare \(es\)$/);
  } finally {
    server.close();
  }
});

test('checkLive on a DNS miss: a good DoH answer passes; a bad one or a DoH failure retries and logs why', async () => {
  const log = [];
  const errors = [];
  const answers = [
    () => Promise.reject(new Error('DNS over HTTPS answered 503')),
    async () => ({address: '192.0.2.10', response: page('en', {'x-github-request-id': '1'})}),
    async () => ({address: '192.0.2.10', response: page('en')}),
  ];
  let call = 0;
  const doh = (url) => (url.endsWith('/es/') ? Promise.resolve({address: '192.0.2.10', response: page('es')}) : answers[call++]());
  const status = await checkLive('https://docs.gelpy.app', {request: async () => Promise.reject(dnsMiss()), doh, wait: async () => {}, log: (line) => log.push(line), error: (line) => errors.push(line)});
  assert.equal(status, 0);
  assert.deepEqual(errors, []);
  assert.match(log[0], /attempt 1\/30: network error: fetch failed \(ENOTFOUND\); DNS over HTTPS failed: DNS over HTTPS answered 503$/);
  assert.match(log[1], /attempt 2\/30: .*via DNS over HTTPS \(192\.0\.2\.10\): status 200, server cloudflare; served by GitHub Pages$/);
  assert.match(log[2], /attempt 3\/30: .*via DNS over HTTPS \(192\.0\.2\.10\): status 200, server cloudflare$/);
  assert.equal(log[3], 'check:public --live: https://docs.gelpy.app/: 200 from Cloudflare (en)');

  let dohCalls = 0;
  const other = [];
  const reset = Object.assign(new Error('fetch failed'), {cause: {code: 'ECONNRESET'}});
  await checkLive('https://docs.gelpy.app', {request: async () => Promise.reject(reset), doh: async () => (dohCalls++, assert.fail('no DoH')), wait: async () => {}, attempts: 2, log: (line) => other.push(line), error: () => {}});
  assert.equal(dohCalls, 0, 'only a DNS miss uses DoH');
});
