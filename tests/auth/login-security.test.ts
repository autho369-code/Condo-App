import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createServiceClient: vi.fn(),
  getMe: vi.fn(),
  headers: vi.fn(),
  redirect: vi.fn(),
  revalidatePath: vi.fn(),
  consumePublic: vi.fn(),
  consumeScoped: vi.fn(),
  tenantFromHeaders: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: mocks.createClient,
  createServiceClient: mocks.createServiceClient,
}));
vi.mock('@/lib/auth/me', () => ({
  getMe: mocks.getMe,
  roleHome: () => '/dashboard',
}));
vi.mock('next/headers', () => ({ headers: mocks.headers }));
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock('@/lib/server/rate-limit', () => ({
  clientAddress: () => '203.0.113.10',
  consumePublicRateLimit: mocks.consumePublic,
  consumeScopedRateLimit: mocks.consumeScoped,
}));
vi.mock('@/lib/tenant/resolve', () => ({ tenantFromHeaders: mocks.tenantFromHeaders }));

import { loginWithPassword } from '@/lib/auth/actions';

const allowed = { allowed: true, remaining: 9, retryAfterSeconds: 900 };
const denied = { allowed: false, remaining: 0, retryAfterSeconds: 900 };

function loginForm() {
  const form = new FormData();
  form.set('email', ' Manager@Example.com ');
  form.set('password', 'test-password');
  form.set('mode', 'manager');
  return form;
}

describe('password login security boundary', () => {
  let signInWithPassword: ReturnType<typeof vi.fn>;
  let auditRpc: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    signInWithPassword = vi.fn();
    auditRpc = vi.fn().mockResolvedValue({ data: 'audit-id', error: null });
    mocks.createClient.mockResolvedValue({ auth: { signInWithPassword, signOut: vi.fn() } });
    mocks.createServiceClient.mockReturnValue({ rpc: auditRpc });
    mocks.headers.mockResolvedValue(new Headers({
      'x-vercel-forwarded-for': '203.0.113.10',
      'user-agent': 'Portier369 security test',
    }));
    mocks.consumePublic.mockResolvedValue(allowed);
    mocks.consumeScoped.mockResolvedValue(allowed);
    mocks.tenantFromHeaders.mockReturnValue(null);
    mocks.getMe.mockResolvedValue({ auth_user_id: 'user-1', is_staff: true });
    mocks.redirect.mockImplementation((url: string) => {
      throw new Error(`REDIRECT:${url}`);
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('stops before password verification when either durable limit denies the request', async () => {
    mocks.consumeScoped.mockResolvedValue(denied);

    await expect(loginWithPassword(loginForm())).rejects.toThrow('REDIRECT:/login?mode=manager&error=too_many_attempts');

    expect(signInWithPassword).not.toHaveBeenCalled();
    expect(auditRpc).not.toHaveBeenCalled();
    expect(mocks.consumeScoped).toHaveBeenCalledWith(expect.anything(), 'manager@example.com:203.0.113.10', expect.objectContaining({
      scope: 'password_login_account_source',
    }));
  });

  it('fails closed when the rate-limit backend is unavailable', async () => {
    mocks.consumePublic.mockResolvedValue({ ...denied, unavailable: true });

    await expect(loginWithPassword(loginForm())).rejects.toThrow('login_temporarily_unavailable');

    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it('records a normalized, non-enumerating failure audit event', async () => {
    signInWithPassword.mockResolvedValue({
      data: { user: null },
      error: { message: 'Invalid login credentials' },
    });

    await expect(loginWithPassword(loginForm())).rejects.toThrow('invalid_credentials');

    expect(signInWithPassword).toHaveBeenCalledWith({
      email: 'manager@example.com',
      password: 'test-password',
    });
    expect(auditRpc).toHaveBeenCalledWith('record_login_attempt', expect.objectContaining({
      p_email: 'manager@example.com',
      p_auth_user_id: null,
      p_success: false,
      p_failure_reason: 'invalid_credentials',
      p_ip_address: '203.0.113.10',
    }));
  });

  it('does not reveal whether an email belongs to an unconfirmed account', async () => {
    signInWithPassword.mockResolvedValue({
      data: { user: null },
      error: { message: 'Email not confirmed' },
    });

    await expect(loginWithPassword(loginForm())).rejects.toThrow('error=invalid_credentials');
    expect(auditRpc).toHaveBeenCalledWith('record_login_attempt', expect.objectContaining({
      p_failure_reason: 'email_not_confirmed',
    }));
  });

  it('records a successful password step and lets the destination enforce MFA', async () => {
    signInWithPassword.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    });

    await expect(loginWithPassword(loginForm())).rejects.toThrow('REDIRECT:/dashboard');

    expect(auditRpc).toHaveBeenCalledWith('record_login_attempt', expect.objectContaining({
      p_auth_user_id: 'user-1',
      p_success: true,
      p_mfa_used: false,
    }));
    expect(mocks.getMe).toHaveBeenCalledWith({ enforceMfa: false });
  });
});
