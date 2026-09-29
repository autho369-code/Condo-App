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
  const [profileResult, operatorResult, loginResult, enrollmentAuditResult, resetAuditResult] = await Promise.all([
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
    service.from('audit_logs')
      .select('id, created_at')
      .eq('entity_type', 'user')
      .eq('entity_id', auth.user.id)
      .eq('action', 'mfa_enrolled')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    service.from('audit_logs')
      .select('id, created_at')
      .eq('entity_type', 'user')
      .eq('entity_id', auth.user.id)
      .in('action', ['mfa_reset_completed', 'mfa_reset_status_sync_failed', 'mfa_break_glass_completed'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (
    profileResult.error
    || operatorResult.error
    || loginResult.error
    || enrollmentAuditResult.error
    || resetAuditResult.error
  ) {
    return NextResponse.json({ error: 'mfa_status_lookup_failed' }, { status: 500 });
  }

  const profile = profileResult.data;
  const operator = operatorResult.data;
  const latestPasswordLogin = loginResult.data;
  if (!profile && !operator) {
    return NextResponse.json({ error: 'managed_account_required' }, { status: 403 });
  }

  const enrolledAt = new Date().toISOString();
  const latestRecordedAt = Math.max(
    ...[
      profile?.mfa_enrolled_at,
      operator?.mfa_enrolled_at,
      enrollmentAuditResult.data?.created_at,
    ].map((value) => value ? Date.parse(value) : Number.NEGATIVE_INFINITY),
  );
  const latestResetAt = resetAuditResult.data?.created_at
    ? Date.parse(resetAuditResult.data.created_at)
    : Number.NEGATIVE_INFINITY;
  const wasRecorded = latestRecordedAt > latestResetAt;

  // Audit the verified factor before synchronizing the convenience columns.
  // If a later update fails, a retry can detect this event and complete the
  // status sync without creating a duplicate or losing the enrollment audit.
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

  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
}
