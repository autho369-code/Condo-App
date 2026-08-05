import { NextResponse } from 'next/server';

import { createClient, createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST() {
  const supabase = await createClient();
  const [{ data: auth, error: authError }, { data: assurance, error: assuranceError }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  ]);

  if (authError || !auth.user) {
    return NextResponse.json({ error: 'authentication_required' }, { status: 401 });
  }
  if (assuranceError || assurance?.currentLevel !== 'aal2') {
    return NextResponse.json({ error: 'mfa_verification_required' }, { status: 403 });
  }

  const service = createServiceClient() as any;
  const [{ data: profile }, { data: operator }, { data: latestPasswordLogin }] = await Promise.all([
    service.from('profiles').select('mfa_enrolled_at, portfolio_id, email').eq('id', auth.user.id).maybeSingle(),
    service.from('platform_operators').select('mfa_enrolled_at, email').eq('auth_user_id', auth.user.id).maybeSingle(),
    service.from('login_attempts')
      .select('id')
      .eq('auth_user_id', auth.user.id)
      .eq('success', true)
      .gte('at', new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString())
      .order('at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const enrolledAt = new Date().toISOString();
  const wasRecorded = Boolean(profile?.mfa_enrolled_at || operator?.mfa_enrolled_at);

  const [profileUpdate, operatorUpdate, loginUpdate] = await Promise.all([
    service.from('profiles').update({ mfa_enrolled_at: enrolledAt }).eq('id', auth.user.id),
    service.from('platform_operators').update({ mfa_enrolled_at: enrolledAt }).eq('auth_user_id', auth.user.id),
    latestPasswordLogin?.id
      ? service.from('login_attempts').update({ mfa_used: true }).eq('id', latestPasswordLogin.id)
      : Promise.resolve({ error: null }),
  ]);
  if (profileUpdate.error || operatorUpdate.error || loginUpdate.error) {
    return NextResponse.json({ error: 'mfa_status_update_failed' }, { status: 500 });
  }

  if (!wasRecorded) {
    const { error: auditError } = await service.from('audit_logs').insert({
      portfolio_id: profile?.portfolio_id ?? null,
      entity_type: 'user',
      entity_id: auth.user.id,
      action: 'mfa_enrolled',
      actor_id: auth.user.id,
      actor_email: auth.user.email ?? profile?.email ?? operator?.email ?? null,
      changes: { factor_type: 'totp' },
    });
    if (auditError) {
      return NextResponse.json({ error: 'mfa_audit_failed' }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
}
