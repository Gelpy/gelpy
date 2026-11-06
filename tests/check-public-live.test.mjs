import {test} from 'node:test';
import assert from 'node:assert/strict';

import {LIVE_PATHS, checkLive, cli, liveProblem} from '../scripts/check-public.mjs';

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
