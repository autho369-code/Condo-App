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
