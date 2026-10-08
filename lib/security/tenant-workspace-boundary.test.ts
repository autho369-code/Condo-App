import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const source = (path: string) => readFileSync(resolve(root, path), 'utf8');

describe('tenant workspace boundary wiring', () => {
  const middleware = source('middleware.ts');
  const auth = source('lib/auth/me.ts');
  const login = source('lib/auth/actions.ts');
  const config = source('supabase/config.toml');
  const migration = source('supabase/migrations/20260801030000_tenant_workspace_boundaries.sql');

  it('forwards trusted tenant identity as request headers and strips spoofed values', () => {
    expect(middleware).toContain("INTERNAL_TENANT_HEADERS.forEach((name) => requestHeaders.delete(name))");
    expect(middleware).toContain("NextResponse.next({ request: { headers: requestHeaders } })");
    expect(middleware).toContain("requestHeaders.set('x-portfolio-id', tenantPortfolio.id)");
  });

  it('fails closed for unknown, cross-company, and API tenant requests', () => {
    expect(middleware).toContain("'workspace_not_found'");
    expect(middleware).toContain("'workspace_access_denied'");
    expect(middleware).toContain("pathname === '/signup'");
    expect(middleware).toContain("pathname.startsWith('/api/')");
    expect(auth).toContain('requireMatchingTenantWorkspace(me)');
    expect(login).toContain('tenantAccessDecision(tenant.portfolioId, me)');
    expect(login).toContain('await supabase.auth.signOut()');
  });

  it("keeps the platform's marketing and site files off company addresses", () => {
    expect(middleware).toMatch(/const MARKETING_PATHS = \[[^\]]*'\/demo'[^\]]*'\/legal'/);
    for (const path of ['/sitemap.xml', '/llms.txt', '/api/demo-request', '/api/piper', '/report-card.html']) {
      expect(middleware).toMatch(new RegExp(`PLATFORM_ONLY_PATHS = \\[[^\\]]*'${path.replace(/[/.]/g, '\\$&')}'`));
    }
    expect(middleware).toContain("'User-agent: *\\nDisallow: /\\n'");
    // .html must reach middleware, and the platform's own page stays public there.
    expect(middleware).not.toMatch(/matcher:.*\|html\)/);
    expect(middleware).toMatch(/const PUBLIC_ASSETS = \[[^\]]*'\/report-card\.html'/);
  });

  it('allows tenant auth callbacks and collision-safe slug provisioning', () => {
    expect(config).toContain('https://*.portier369.com/**');
    expect(migration).toContain('pg_advisory_xact_lock');
    expect(migration).toContain("v_suffix := '-' || v_counter::text");
    expect(migration).toContain('p.archived_at is null');
  });
});
