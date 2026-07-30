#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const SKIP_EXTENSIONS = /\.(?:aab|apk|avif|bin|bmp|class|dll|dylib|eot|exe|gif|gz|ico|jar|jpeg|jpg|jks|keystore|lock|mov|mp3|mp4|otf|p12|pdf|pfx|png|so|ttf|webm|webp|woff2?|zip)$/i;
const SKIP_PATHS = new Set(['package-lock.json', 'scripts/scan-secrets.mjs']);

const PATTERNS = [
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g],
  ['Stripe live secret', /\b(?:sk|rk)_live_[A-Za-z0-9]{16,}\b/g],
  ['Stripe webhook secret', /\bwhsec_[A-Za-z0-9_-]{16,}\b/g],
  ['Supabase secret key', /\bsb_secret_[A-Za-z0-9_-]{16,}\b/g],
  ['GitHub token', /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})\b/g],
  ['AWS access key', /\bAKIA[0-9A-Z]{16}\b/g],
  ['AI provider secret', /\bsk-[A-Za-z0-9_-]{20,}\b/g],
  ['Resend secret', /\bre_[A-Za-z0-9_-]{24,}\b/g],
  ['credential-bearing database URL', /\bpostgres(?:ql)?:\/\/[^\s:/@]+:[^\s/@]+@[^\s]+/gi],
];

function isPlaceholder(value) {
  return /(?:^|[-_/:])(?:ci|dummy|example|fake|placeholder|redacted|sample|test|your)(?:[-_/:]|$)|change[-_]?me|not[-_]?real|development/i.test(value);
}

function lineNumber(text, offset) {
  let line = 1;
  for (let index = 0; index < offset; index += 1) {
    if (text.charCodeAt(index) === 10) line += 1;
  }
  return line;
}

function scanText(text, file) {
  const findings = [];

  for (const [kind, expression] of PATTERNS) {
    expression.lastIndex = 0;
    for (const match of text.matchAll(expression)) {
      if (!isPlaceholder(match[0])) {
        findings.push({ file, line: lineNumber(text, match.index ?? 0), kind });
      }
    }
  }

  const jwtExpression = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g;
  for (const match of text.matchAll(jwtExpression)) {
    try {
      const payload = JSON.parse(Buffer.from(match[0].split('.')[1], 'base64url').toString('utf8'));
      if (payload?.role === 'service_role') {
        findings.push({ file, line: lineNumber(text, match.index ?? 0), kind: 'Supabase service-role JWT' });
      }
    } catch {
      // Not a decodable JWT payload.
    }
  }

  const passwordExpression = /\b(?:password|passwd|pwd|storePassword|keyPassword)\b\s*(?:=|:)\s*(['"])([^'"\r\n]{8,})\1/gi;
  for (const match of text.matchAll(passwordExpression)) {
    if (!isPlaceholder(match[2])) {
      findings.push({ file, line: lineNumber(text, match.index ?? 0), kind: 'hardcoded password literal' });
    }
  }

  return findings;
}

function selfTest() {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const serviceJwt = [encode({ alg: 'HS256' }), encode({ role: 'service_role', ref: 'example' }), 'signaturepart'].join('.');
  const cases = [
    ['const key = "' + 'sk_live_' + 'A'.repeat(24) + '";', true],
    ['const token = "' + serviceJwt + '";', true],
    ['const password = "' + 'Product2026!' + '";', true],
    ['const password = "test-password";', false],
    ['const url = "https://example.supabase.co";', false],
  ];
  for (const [text, shouldFind] of cases) {
    if ((scanText(text, 'self-test').length > 0) !== shouldFind) {
      console.error('Secret scanner self-test failed.');
      process.exit(1);
    }
  }
  console.log('Secret scanner self-test passed.');
}

if (process.argv.includes('--self-test')) {
  selfTest();
  process.exit(0);
}

const listed = execFileSync(
  'git',
  ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
  { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 },
);

const findings = [];
for (const file of listed.split('\0').filter(Boolean)) {
  if (SKIP_PATHS.has(file) || SKIP_EXTENSIONS.test(file)) continue;

  let bytes;
  try {
    bytes = readFileSync(file);
  } catch {
    continue;
  }
  if (bytes.length > MAX_FILE_BYTES || bytes.includes(0)) continue;
  findings.push(...scanText(bytes.toString('utf8'), file));
}

if (findings.length > 0) {
  console.error('Potential secrets detected. Values are intentionally redacted:');
  for (const finding of findings) {
    console.error(finding.file + ':' + finding.line + ' [' + finding.kind + ']');
  }
  process.exit(1);
}

console.log('Secret scan passed; no high-confidence current-source secrets detected.');
