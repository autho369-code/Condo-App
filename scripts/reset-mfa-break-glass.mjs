import { createClient } from '@supabase/supabase-js';

function flag(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : null;
}

const userId = flag('user-id');
const confirmEmail = flag('confirm-email')?.trim().toLowerCase();
const actorEmail = flag('actor-email')?.trim().toLowerCase();
const reason = flag('reason')?.trim();
const projectRef = flag('project-ref')?.trim();
const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!userId || !confirmEmail || !actorEmail || !reason || !projectRef || !url || !serviceRoleKey) {
  throw new Error('Usage: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, then run with --project-ref <ref> --user-id <uuid> --confirm-email <email> --actor-email <email> --reason <ticket-or-incident>.');
}
if (new URL(url).hostname.split('.')[0] !== projectRef) {
  throw new Error('SUPABASE_URL does not match --project-ref. Recovery stopped.');
}

const service = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: authUser, error: userError } = await service.auth.admin.getUserById(userId);
if (userError || !authUser.user) throw new Error(`User lookup failed: ${userError?.message ?? 'not found'}`);
if (authUser.user.email?.toLowerCase() !== confirmEmail) {
  throw new Error('Confirmation email does not match the target account. Recovery stopped.');
}

const { data: factorsData, error: factorsError } = await service.auth.admin.mfa.listFactors({ userId });
if (factorsError) throw new Error(`Factor lookup failed: ${factorsError.message}`);
const factors = factorsData.factors ?? [];

const auditBase = {
  entity_type: 'user',
  entity_id: userId,
  actor_id: null,
  actor_email: actorEmail,
};
const { error: authorizationError } = await service.from('audit_logs').insert({
  ...auditBase,
  action: 'mfa_break_glass_authorized',
  changes: { reason, project_ref: projectRef, target_email: confirmEmail, factor_count: factors.length },
});
if (authorizationError) throw new Error(`Authorization audit failed: ${authorizationError.message}`);

let deleted = 0;
for (const factor of factors) {
  const { error } = await service.auth.admin.mfa.deleteFactor({ id: factor.id, userId });
  if (error) {
    await service.from('audit_logs').insert({
      ...auditBase,
      action: 'mfa_break_glass_incomplete',
      changes: { reason, project_ref: projectRef, deleted_factors: deleted, factor_count: factors.length },
    });
    throw new Error(`Factor removal stopped after ${deleted} factor(s): ${error.message}`);
  }
  deleted += 1;
}

const [profileUpdate, operatorUpdate] = await Promise.all([
  service.from('profiles').update({ mfa_enrolled_at: null }).eq('id', userId),
  service.from('platform_operators').update({ mfa_enrolled_at: null }).eq('auth_user_id', userId),
]);
if (profileUpdate.error || operatorUpdate.error) {
  throw new Error(`Status synchronization failed after factor removal: ${profileUpdate.error?.message ?? operatorUpdate.error?.message}`);
}

const { error: completionError } = await service.from('audit_logs').insert({
  ...auditBase,
  action: 'mfa_break_glass_completed',
  changes: { reason, project_ref: projectRef, deleted_factors: deleted },
});
if (completionError) throw new Error(`Completion audit failed after factor removal: ${completionError.message}`);

console.log(`MFA break-glass recovery completed for project ${projectRef}; ${deleted} factor(s) removed.`);
