import { describe, expect, it } from 'vitest';
import { blocksOperatorWrite } from './operator-writes';

const op = (role: string | null) => ({ is_platform_operator: true, platform_operator_role: role });

describe('blocksOperatorWrite', () => {
  it('never blocks non-operators', () => {
    expect(blocksOperatorWrite({ is_platform_operator: false }, 'POST', '/owners/new')).toBe(false);
    expect(blocksOperatorWrite(null, 'POST', '/owners/new')).toBe(false);
  });

  it('lets operator admins write anywhere', () => {
    expect(blocksOperatorWrite(op('admin'), 'POST', '/associations/x/payments')).toBe(false);
  });

  it('lets every operator read', () => {
    expect(blocksOperatorWrite(op('readonly'), 'GET', '/associations/x/payments')).toBe(false);
    expect(blocksOperatorWrite(op('readonly'), 'HEAD', '/platform-operator')).toBe(false);
  });

  it('blocks writes by readonly and support operators', () => {
    expect(blocksOperatorWrite(op('readonly'), 'POST', '/associations/x/payments')).toBe(true);
    expect(blocksOperatorWrite(op('support'), 'POST', '/api/plaid/exchange-token')).toBe(true);
    expect(blocksOperatorWrite(op('readonly'), 'DELETE', '/api/anything')).toBe(true);
  });

  it('treats an operator with an unknown role as non-admin', () => {
    expect(blocksOperatorWrite(op(null), 'POST', '/owners/new')).toBe(true);
  });

  it('allows own-session writes for every operator', () => {
    expect(blocksOperatorWrite(op('readonly'), 'POST', '/mfa')).toBe(false);
    expect(blocksOperatorWrite(op('readonly'), 'POST', '/api/auth/mfa-complete')).toBe(false);
    expect(blocksOperatorWrite(op('readonly'), 'POST', '/account')).toBe(false);
  });

  it('lets support (only) work support requests', () => {
    expect(blocksOperatorWrite(op('support'), 'POST', '/platform-operator/support')).toBe(false);
    expect(blocksOperatorWrite(op('readonly'), 'POST', '/platform-operator/support')).toBe(true);
    expect(blocksOperatorWrite(op('support'), 'POST', '/platform-operator/supportx')).toBe(true);
  });
});

describe('server-action operator refusal in auth guards', () => {
  // An action ID can be posted to any path, so the guards privileged actions
  // call must refuse non-admin operators themselves.
  const source = require('node:fs').readFileSync('lib/auth/me.ts', 'utf8') as string;
  const body = (name: string) => {
    const start = source.indexOf(`export async function ${name}(`);
    return source.slice(start, source.indexOf('\n}\n', start));
  };

  it.each(['requireStaff', 'requireBoard', 'requireWorkspaceStaff', 'requireFinanceOrPortfolioAdmin', 'requireFinanceStaff', 'requirePortfolioAdmin'])(
    '%s refuses non-admin operators inside server actions',
    (name) => {
      expect(body(name)).toContain('await refuseOperatorAction(me);');
    },
  );

  it('requirePlatformOperator lets only admin and support act', () => {
    expect(body('requirePlatformOperator')).toContain("refuseOperatorAction(me, ['admin', 'support'])");
  });

  it('requireAuth defaults to admin-only; only the account page opts in', () => {
    expect(body('requireAuth')).toContain("operatorActionRoles ?? ['admin']");
    const account = require('node:fs').readFileSync('app/account/page.tsx', 'utf8') as string;
    expect(account).toContain('requireAuth({ operatorActionRoles: ALL_OPERATOR_ROLES })');
  });

  it('getMe refuses non-admin operators in actions by default', () => {
    const getMe = body('getMe');
    expect(getMe).toContain("refuseOperatorAction(me, options.operatorActionRoles ?? ['admin'])");
  });

  it('treats server actions and any non-GET request as mutations', () => {
    expect(source).toContain(".get('next-action')");
    expect(source).toContain(".get('x-portier-request-method')");
    // No trusted method (middleware skipped the path) fails closed.
    expect(source).toContain("return !method || !['GET', 'HEAD', 'OPTIONS'].includes(method)");
  });

  it('middleware stamps the trusted method and strips client copies', () => {
    const mw = require('node:fs').readFileSync('middleware.ts', 'utf8') as string;
    expect(mw).toContain("'x-portier-request-method',");
    expect(mw).toContain("requestHeaders.set('x-portier-request-method', request.method.toUpperCase())");
  });
});
