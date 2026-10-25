// Read-only smoke test of a deployed site (default https://portier369.com).
// Only GET requests: nothing is written. Checks that public pages load,
// signed-out visitors are sent to sign in, background-job endpoints refuse
// callers without the cron secret, and the security headers are in place.
//
//   node scripts/smoke-production.mjs [https://site]
//
// Also run by .github/workflows/smoke.yml after each production deploy.
const base = (process.argv[2] || process.env.SMOKE_URL || 'https://portier369.com').replace(/\/$/, '');

const checks = [
  // Public pages.
  ...['/', '/login', '/pricing', '/features', '/sitemap.xml', '/robots.txt'].map((path) => ({ path, status: [200] })),
  // Signed-out visitors are sent to sign in.
  ...['/dashboard', '/portal', '/vendor', '/board', '/company-admin', '/platform-operator'].map((path) => ({
    path, status: [302, 303, 307, 308], location: /\/login/,
  })),
  // Background jobs refuse callers without the cron secret.
  ...['/api/email/process-queue', '/api/platform/health-alert', '/api/billing/assess-late-fees', '/api/payments/autopay-run', '/api/reports/run-scheduled']
    .map((path) => ({ path, status: [401, 503] })),
];

const REQUIRED_HEADERS = {
  'content-security-policy': /frame-ancestors 'none'/,
  'strict-transport-security': /max-age=\d{7,}/,
  'x-content-type-options': /nosniff/,
  'x-frame-options': /DENY/i,
  'referrer-policy': /strict-origin/,
};

let failed = 0;
const fail = (msg) => { failed += 1; console.log(`FAIL ${msg}`); };

for (const check of checks) {
  try {
    const res = await fetch(base + check.path, { redirect: 'manual', headers: { 'user-agent': 'portier369-smoke/1' } });
    const location = res.headers.get('location') ?? '';
    if (!check.status.includes(res.status)) fail(`${check.path}: ${res.status} (expected ${check.status.join(' or ')})`);
    else if (check.location && !check.location.test(location)) fail(`${check.path}: redirected to ${location || '(nothing)'}`);
    else console.log(`ok   ${check.path} ${res.status}${location ? ` -> ${new URL(location, base).pathname}` : ''}`);
  } catch (error) {
    fail(`${check.path}: ${error.message}`);
  }
}

const login = await fetch(`${base}/login`, { headers: { 'user-agent': 'portier369-smoke/1' } });
for (const [name, pattern] of Object.entries(REQUIRED_HEADERS)) {
  const value = login.headers.get(name);
  if (!value || !pattern.test(value)) fail(`header ${name}: ${value ?? '(missing)'}`);
  else console.log(`ok   header ${name}`);
}

console.log(failed ? `\n${failed} check(s) failed on ${base}` : `\nall checks passed on ${base}`);
process.exit(failed ? 1 : 0);
