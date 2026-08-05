interface ResetMfaOptions {
  service: any;
  userId: string;
  targetEmail: string | null;
  actorId: string;
  actorEmail: string | null;
  portfolioId?: string | null;
}

export async function resetUserMfa({
  service,
  userId,
  targetEmail,
  actorId,
  actorEmail,
  portfolioId = null,
}: ResetMfaOptions): Promise<{ factorCount: number; error: string | null }> {
  const factorsResult = await service.auth.admin.mfa.listFactors({ userId });
  if (factorsResult.error) {
    return { factorCount: 0, error: `Could not inspect the user's authenticators: ${factorsResult.error.message}` };
  }

  const factors = factorsResult.data?.factors ?? [];
  const { error: authorizationAuditError } = await service.from('audit_logs').insert({
    portfolio_id: portfolioId,
    entity_type: 'user',
    entity_id: userId,
    action: 'mfa_reset_authorized',
    actor_id: actorId,
    actor_email: actorEmail,
    changes: { target_email: targetEmail, factor_count: factors.length },
  });
  if (authorizationAuditError) {
    return { factorCount: factors.length, error: `The reset was stopped because its audit record could not be created: ${authorizationAuditError.message}` };
  }

  let deleted = 0;
  for (const factor of factors) {
    const result = await service.auth.admin.mfa.deleteFactor({ id: factor.id, userId });
    if (result.error) {
      await service.from('audit_logs').insert({
        portfolio_id: portfolioId,
        entity_type: 'user',
        entity_id: userId,
        action: 'mfa_reset_incomplete',
        actor_id: actorId,
        actor_email: actorEmail,
        changes: { target_email: targetEmail, deleted_factors: deleted, factor_count: factors.length },
      });
      return { factorCount: factors.length, error: `MFA reset stopped after ${deleted} factor(s): ${result.error.message}` };
    }
    deleted += 1;
  }

  const [profileUpdate, operatorUpdate] = await Promise.all([
    service.from('profiles').update({ mfa_enrolled_at: null }).eq('id', userId),
    service.from('platform_operators').update({ mfa_enrolled_at: null }).eq('auth_user_id', userId),
  ]);
  if (profileUpdate.error || operatorUpdate.error) {
    await service.from('audit_logs').insert({
      portfolio_id: portfolioId,
      entity_type: 'user',
      entity_id: userId,
      action: 'mfa_reset_status_sync_failed',
      actor_id: actorId,
      actor_email: actorEmail,
      changes: { target_email: targetEmail, deleted_factors: deleted },
    });
    return {
      factorCount: factors.length,
      error: `Authenticator factors were removed, but the profile status could not be synchronized: ${profileUpdate.error?.message ?? operatorUpdate.error?.message}`,
    };
  }

  const { error: completionAuditError } = await service.from('audit_logs').insert({
    portfolio_id: portfolioId,
    entity_type: 'user',
    entity_id: userId,
    action: 'mfa_reset_completed',
    actor_id: actorId,
    actor_email: actorEmail,
    changes: { target_email: targetEmail, deleted_factors: deleted },
  });
  if (completionAuditError) {
    console.error('MFA reset completed but completion audit failed:', completionAuditError.message);
  }

  return { factorCount: factors.length, error: null };
}
