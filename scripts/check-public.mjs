#!/usr/bin/env node
// Public-safety check for the published site content.
//
// Scans what the site publishes and fails when it finds secrets, internal
// hosts or IP addresses, personal data, or terms from the private reference
// project. Findings print with a redacted excerpt, so CI logs never repeat a
// secret.
//
// Usage: node scripts/check-public.mjs [path ...]
// Without paths it scans DEFAULT_TARGETS from the current directory.
//
// Live check (Work Item 003-025): node scripts/check-public.mjs --live <origin>
// fetches every LIVE_PATHS entry (/, /es/, and the framework overview in both languages) and
// passes when each answers 200 with HTML in its
// language from Cloudflare, not from GitHub Pages. cf:deploy runs it after
// every deploy; it retries while a new custom domain's certificate is issued.

import {readdirSync, readFileSync, statSync, existsSync} from 'node:fs';
import {request as httpRequest} from 'node:http';
import {request as httpsRequest} from 'node:https';
import {join, relative, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

export const DEFAULT_TARGETS = [
  'docs',
  'i18n',
  'docusaurus.config.js',
  'sidebars.js',
  'static',
];

const SKIP_DIRS = new Set(['node_modules', '.git', '.docusaurus', 'build']);

// Hosts that public content may link to: Gelpy's public hosts, the public
// website of the person who leads Gelpy's engineering (owner request of
// 2026-11-06), plus public reference sites that Docusaurus writes into its
// generated translation files.
// GitHub links must stay inside the public Gelpy/gelpy repository.
const ALLOWED_HOSTS = new Set([
  'gelpy.app',
  'www.gelpy.app',
  'docs.gelpy.app',
  'edgardo-gutierrez.com',
  'www.unicode.org',
  // The public docs of the project the framework came from, linked only from its origin page
  // (Work Item 001-021); the term exception below keeps the name off every other page.
  'docs.portfolio-tracker.us',
]);
const ALLOWED_GITHUB_PREFIX = '/gelpy/gelpy';

const IPV4_OCTET = '(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)';

export const RULES = [
  // Secrets
  {id: 'private-key', category: 'secret', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g},
  {id: 'github-token', category: 'secret', re: /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{22,})\b/g},
  {id: 'aws-access-key', category: 'secret', re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g},
  {id: 'google-api-key', category: 'secret', re: /\bAIza[0-9A-Za-z_-]{35}\b/g},
  {id: 'slack-token', category: 'secret', re: /\bxox[abprs]-[0-9A-Za-z-]{10,}\b/g},
  {id: 'stripe-key', category: 'secret', re: /\b[rs]k_(?:live|test)_[0-9A-Za-z]{16,}\b/g},
  {id: 'jwt', category: 'secret', re: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g},
  {id: 'credential-in-url', category: 'secret', re: /\b[a-z][a-z0-9+.-]*:\/\/[^\s/:@'"`]+:[^\s/@'"`]+@/gi},
  {
    id: 'secret-assignment',
    category: 'secret',
    re: /\b(?:api[_-]?key|secret|token|password|passwd|client[_-]?secret|access[_-]?key)\b["']?\s*[:=]\s*["'`][^"'`\s]{8,}["'`]/gi,
  },

  // Internal hosts and addresses
  {id: 'test-host', category: 'internal', re: /\b[a-z0-9-]+-test\.gelpy\.app\b/gi},
  {id: 'test-worker', category: 'internal', re: /\bgelpy-[a-z]+-test\b/gi},
  {id: 'internal-host', category: 'internal', re: /\b(?:localhost|[a-z0-9-]+\.(?:internal|local|lan|corp|intranet|home\.arpa))\b/gi},
  {id: 'platform-host', category: 'internal', re: /\b[a-z0-9-]+\.(?:workers\.dev|pages\.dev|r2\.dev|r2\.cloudflarestorage\.com)\b/gi},
  {id: 'ipv4', category: 'internal', re: new RegExp(`(?<!\\d)(?<!\\d\\.)(?:${IPV4_OCTET}\\.){3}${IPV4_OCTET}(?!\\d|\\.\\d)`, 'g')},
  {id: 'ipv6-private', category: 'internal', re: /(?<![0-9a-f:])(?:fe80|f[cd][0-9a-f]{2})::?[0-9a-f:]*[0-9a-f]/gi},

  // Personal data
  {id: 'email', category: 'personal-data', re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g},
  {id: 'phone', category: 'personal-data', re: /\+\d{1,3}[\s.-]?\(?\d{1,4}\)?(?:[\s.-]?\d{2,4}){2,4}\b/g},

  // Private reference project
  {id: 'reference-project-term', category: 'reference-project', re: /portfolio|edjosephgr|profile-professional/gi},
];

// Path-scoped exceptions (Work Item 001-021, owner decision 2026-11-08). The framework's origin
// page, in English and Spanish, may name the project the method came from. Only the term
// "portfolio" is exempt, and only on those two files: every other term of the rule, and every
// other rule, still applies there.
export const TERM_EXCEPTIONS = [
  {rule: 'reference-project-term', term: 'portfolio', files: ['docs/framework/evolution.md', 'i18n/es/docusaurus-plugin-content-docs/current/framework/evolution.md']},
];

/** True when a match is covered by a path-scoped exception. */
export function isExcepted(rule, match, file) {
  const path = file.replaceAll('\\', '/');
  const term = match.toLowerCase();
  return TERM_EXCEPTIONS.some((exception) => exception.rule === rule && exception.term === term && exception.files.includes(path));
}

const URL_RE = /\bhttps?:\/\/[^\s)'"`<>\]}]+/gi;

/** Returns null when the URL is allowed, or the reason it is not. */
export function urlProblem(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    return 'unparseable URL';
  }
  const host = url.hostname.toLowerCase();
  if (ALLOWED_HOSTS.has(host)) return null;
  if (host === 'github.com') {
    const path = url.pathname.toLowerCase();
    if (path === ALLOWED_GITHUB_PREFIX || path.startsWith(`${ALLOWED_GITHUB_PREFIX}/`)) return null;
    return 'GitHub link outside Gelpy/gelpy';
  }
  return 'host is not on the public allowlist';
}

/** Masks a match so the report never repeats it in full. */
export function redact(text) {
  if (text.length <= 4) return '•'.repeat(text.length);
  return `${text.slice(0, 3)}${'•'.repeat(Math.min(text.length - 3, 8))}`;
}

function position(text, index) {
  const before = text.slice(0, index);
  const line = before.split('\n').length;
  const column = index - before.lastIndexOf('\n');
  return {line, column};
}

/** Scans one text and returns its findings. */
export function scanText(text, file = '<text>') {
  const findings = [];
  for (const rule of RULES) {
    rule.re.lastIndex = 0;
    for (const match of text.matchAll(rule.re)) {
      if (isExcepted(rule.id, match[0], file)) continue;
      findings.push({file, ...position(text, match.index), rule: rule.id, category: rule.category, excerpt: redact(match[0])});
    }
  }
  for (const match of text.matchAll(URL_RE)) {
    const problem = urlProblem(match[0]);
    if (problem) {
      findings.push({file, ...position(text, match.index), rule: 'url-not-allowed', category: 'internal', excerpt: redact(match[0]), detail: problem});
    }
  }
  return findings.sort((a, b) => a.line - b.line || a.column - b.column);
}

/** Lists the files under the given targets, skipping build output. */
export function collectFiles(targets, root = process.cwd()) {
  const files = [];
  const walk = (path) => {
    const stats = statSync(path);
    if (stats.isDirectory()) {
      for (const entry of readdirSync(path).sort()) {
        if (!SKIP_DIRS.has(entry)) walk(join(path, entry));
      }
    } else if (stats.isFile()) {
      files.push(path);
    }
  };
  for (const target of targets) {
    const path = resolve(root, target);
    if (existsSync(path)) walk(path);
  }
  return files;
}

/** Scans files. Binary files (with a NUL byte) are skipped. */
export function scanFiles(files, root = process.cwd()) {
  const findings = [];
  let scanned = 0;
  for (const file of files) {
    const buffer = readFileSync(file);
    if (buffer.includes(0)) continue;
    scanned += 1;
    findings.push(...scanText(buffer.toString('utf8'), relative(root, file) || file));
  }
  return {scanned, findings};
}

export function formatFinding(f) {
  const detail = f.detail ? ` (${f.detail})` : '';
  return `${f.file}:${f.line}:${f.column} ${f.category}/${f.rule}${detail}: ${f.excerpt}`;
}

export function main(args = process.argv.slice(2), {root = process.cwd(), log = console.log, error = console.error} = {}) {
  const targets = args.length > 0 ? args : DEFAULT_TARGETS;
  const {scanned, findings} = scanFiles(collectFiles(targets, root), root);
  for (const finding of findings) error(formatFinding(finding));
  const summary = `check:public: ${scanned} files scanned in ${targets.join(', ')}; ${findings.length} findings`;
  if (findings.length > 0) {
    error(summary);
    return 1;
  }
  log(summary);
  return 0;
}

// The framework overview has no trailing slash: with trailingSlash: false, the Worker redirects
// /framework/overview/ to it, and the pinned DNS-over-HTTPS fetch does not follow redirects.
export const LIVE_PATHS = [
  {path: '/', lang: 'en'},
  {path: '/es/', lang: 'es'},
  {path: '/framework/overview', lang: 'en'},
  {path: '/es/framework/overview', lang: 'es'},
];

/** Returns null when one live response is the docs Worker serving the page, or the reason it is not. */
export function liveProblem({status, headers, body}, lang) {
  if (status !== 200) return `status ${status}`;
  if (headers.get('x-github-request-id')) return 'served by GitHub Pages';
  if (!(headers.get('server') ?? '').toLowerCase().includes('cloudflare')) return 'not served by Cloudflare';
  if (!(headers.get('content-type') ?? '').includes('text/html')) return 'not HTML';
  if (!body.includes(`<html lang="${lang}"`)) return `no <html lang="${lang}">`;
  return null;
}

const pause = (ms) => new Promise((done) => setTimeout(done, ms));

// The live check waits up to 5 minutes per path (30 x 10 s): a new custom domain needs its
// certificate issued and the old record's TTL to run out before the Worker answers. Each request,
// body included, is aborted after LIVE_TIMEOUT_MS, and no attempt starts after the path's
// LIVE_WINDOW_MS deadline, so a stalled origin cannot hold the deploy past the window.
export const LIVE_ATTEMPTS = 30;
export const LIVE_DELAY_MS = 10_000;
export const LIVE_TIMEOUT_MS = 10_000;
export const LIVE_WINDOW_MS = 300_000;

/** What one attempt saw, for the log: status and server, or the network or TLS error. */
export function describeAttempt({response, failure}) {
  if (failure) {
    const code = failure.cause?.code ?? failure.code ?? '';
    const tls = /CERT|TLS|SSL|VERIFY|SELF_SIGNED|HANDSHAKE/i.test(`${code} ${failure.cause?.message ?? ''}`);
    return `${tls ? 'TLS error' : 'network error'}: ${failure.message}${code ? ` (${code})` : ''}`;
  }
  return `status ${response.status}, server ${response.headers.get('server') ?? 'none'}`;
}

// A first cutover leaves "no such name" in the build resolver's negative cache for up to the
// zone's SOA minimum (30 min for gelpy.app), longer than the window (Gelpy/gelpy#22). When the
// system resolver says the name does not exist, the check asks DNS over HTTPS instead and fetches
// with the connection pinned to that address, so it sees the Worker as soon as the edge serves it.
export const DOH_URL = 'https://cloudflare-dns.com/dns-query';
const DNS_MISS = new Set(['ENOTFOUND', 'EAI_AGAIN']);

export function isDnsMiss(failure) {
  return DNS_MISS.has(failure?.cause?.code ?? failure?.code);
}

/** The first IPv4 address of a host, from DNS over HTTPS (JSON API). */
export async function resolveViaDoh(host, {request = globalThis.fetch, timeoutMs = LIVE_TIMEOUT_MS} = {}) {
  const response = await request(`${DOH_URL}?name=${encodeURIComponent(host)}&type=A`, {headers: {accept: 'application/dns-json'}, signal: AbortSignal.timeout(timeoutMs)});
  if (response.status !== 200) throw new Error(`DNS over HTTPS answered ${response.status}`);
  const answers = (await response.json())?.Answer ?? [];
  const address = answers.find((answer) => answer.type === 1)?.data;
  if (!address) throw new Error(`DNS over HTTPS has no A record for ${host}`);
  return address;
}

/**
 * GET url with the connection pinned to address; TLS still verifies the URL's host name. No agent
 * (agent: false), so every call opens its own connection to that address and never reuses a
 * keep-alive socket opened for the same host and port through another address.
 */
export function fetchPinned(url, address, {timeoutMs = LIVE_TIMEOUT_MS} = {}) {
  const target = new URL(url);
  const send = target.protocol === 'https:' ? httpsRequest : httpRequest;
  const lookup = (hostname, options, callback) => (options?.all ? callback(null, [{address, family: 4}]) : callback(null, address, 4));
  return new Promise((done, failed) => {
    const req = send(target, {method: 'GET', agent: false, lookup, servername: target.hostname, signal: AbortSignal.timeout(timeoutMs)}, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('error', failed);
      res.on('end', () => {
        const headers = new Headers();
        for (const [name, value] of Object.entries(res.headers)) headers.set(name, Array.isArray(value) ? value.join(', ') : String(value));
        const body = Buffer.concat(chunks).toString('utf8');
        done({status: res.statusCode, headers, text: async () => body});
      });
    });
    req.on('error', failed);
    req.end();
  });
}

/** The DoH path of one attempt: resolve, then fetch pinned to the address. */
export async function viaDoh(url, {request = globalThis.fetch, timeoutMs = LIVE_TIMEOUT_MS} = {}) {
  const address = await resolveViaDoh(new URL(url).hostname, {request, timeoutMs});
  return {address, response: await fetchPinned(url, address, {timeoutMs})};
}

/** Checks every live path, with retries, and returns an exit code. */
export async function checkLive(origin, {
  request = globalThis.fetch,
  wait = pause,
  attempts = LIVE_ATTEMPTS,
  delayMs = LIVE_DELAY_MS,
  timeoutMs = LIVE_TIMEOUT_MS,
  windowMs = LIVE_WINDOW_MS,
  now = Date.now,
  doh = (url) => viaDoh(url, {request, timeoutMs}),
  log = console.log,
  error = console.error,
} = {}) {
  let failed = 0;
  for (const {path, lang} of LIVE_PATHS) {
    const url = new URL(path, origin).href;
    const deadline = now() + windowMs;
    let problem = 'not checked';
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      let seen;
      try {
        const response = await request(url, {redirect: 'follow', signal: AbortSignal.timeout(timeoutMs)});
        seen = describeAttempt({response});
        problem = liveProblem({status: response.status, headers: response.headers, body: await response.text()}, lang);
      } catch (failure) {
        seen = describeAttempt({failure});
        problem = seen;
        if (isDnsMiss(failure)) {
          try {
            const {address, response} = await doh(url);
            seen = `${seen}; via DNS over HTTPS (${address}): ${describeAttempt({response})}`;
            problem = liveProblem({status: response.status, headers: response.headers, body: await response.text()}, lang);
          } catch (dohFailure) {
            seen = `${seen}; DNS over HTTPS failed: ${dohFailure.message}`;
            problem = seen;
          }
          if (!problem) log(`check:public --live: ${url}: attempt ${attempt}/${attempts}: ${seen}`);
        }
      }
      if (!problem) break;
      log(`check:public --live: ${url}: attempt ${attempt}/${attempts}: ${seen === problem ? seen : `${seen}; ${problem}`}`);
      if (attempt === attempts) break;
      if (now() + delayMs >= deadline) {
        problem = `${problem} (gave up: the ${windowMs / 1000} s window ended)`;
        break;
      }
      await wait(delayMs);
    }
    if (problem) {
      failed += 1;
      error(`check:public --live: ${url}: ${problem}`);
    } else {
      log(`check:public --live: ${url}: 200 from Cloudflare (${lang})`);
    }
  }
  return failed === 0 ? 0 : 1;
}

/** The command line: --live <origin>, or the content scan. */
export async function cli(args = process.argv.slice(2), options = {}) {
  if (args[0] === '--live') {
    if (!args[1]) {
      (options.error ?? console.error)('Usage: node scripts/check-public.mjs --live <origin>');
      return 2;
    }
    return checkLive(args[1], options);
  }
  return main(args, options);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = await cli();
}
