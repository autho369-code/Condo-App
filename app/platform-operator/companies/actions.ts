'use server';

// Platform-operator company management actions.
// Every action: (1) requires the platform-operator role, (2) performs the
// mutation via the service-role client, (3) writes an audit_logs row scoped to
// entity_type 'company' / entity_id = portfolio id, (4) fails loudly via
// redirect(?error=...) per CLAUDE.md rule 3.
import { verifiedAuthLink } from '@/lib/auth/email-links';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requirePlatformAdmin, requirePlatformOperator, type MeResult } from '@/lib/auth/me';
import { PLAN_BY_ID, type PlanId } from '@/lib/billing/plans';
import { safeInternalNext } from '@/lib/security/redirects';
import { siteUrl } from '@/lib/url/site-url';
import { tenantWorkspaceUrl } from '@/lib/tenant/host';
import { attachDomainToVercel, parseCustomDomain, vercelDomainsEnv } from '@/lib/tenant/custom-domain';
import { parseSenderSettings, registerSenderDomain, resendClient, storedStatus } from '@/lib/email/sender-domains';
import { claimSubmission, releaseSubmission, completeSubmission } from '@/lib/forms/submission';
import { monthWindowInZone, parseDollarsToCents, parsePositiveInt } from '@/lib/platform/operator-metrics';
import { displayTimeZone } from '@/lib/time/display-zone';
import { todayInZone } from '@/lib/time/zoned';

const COMPANIES = '/platform-operator/companies';
// Verified Resend sender for platform-level email
const FROM_ADDRESS = 'hello@portier369.com';
const FROM_NAME = 'Portier369';

function returnPath(formData: FormData, fallback: string): string {
  return safeInternalNext(formData.get('return_to')) ?? fallback;
}

function fail(returnTo: string, message: string): never {
  const sep = returnTo.includes('?') ? '&' : '?';
  redirect(`${returnTo}${sep}error=${encodeURIComponent(message)}`);
}

function ok(returnTo: string, flag: string): never {
  const sep = returnTo.includes('?') ? '&' : '?';
  redirect(`${returnTo}${sep}${flag}=1`);
}

async function audit(
  svc: any,
  me: MeResult,
  action: string,
  portfolioId: string | null,
  changes: Record<string, unknown> = {},
) {
  await svc.from('audit_logs').insert({
    entity_type: 'company',
    entity_id: portfolioId,
    action,
    actor_id: me.auth_user_id,
    actor_email: me.email,
    changes,
  });
}

function inviteEmailBody(companyName: string, token: string, expiresAt: string | null, slug?: string | null) {
  const publicUrl = siteUrl();
  const workspaceUrl = tenantWorkspaceUrl(slug);
  const url = tenantWorkspaceUrl(slug, `/invite?token=${encodeURIComponent(token)}`);
  const expiry = expiresAt
    ? new Date(expiresAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : 'in 30 days';
  return `
<p>Hello,</p>
<p>You have been invited to administer <strong>${companyName}</strong> on Portier369.</p>
<p><a href="${url}">Set up your account</a></p>
<p>Your company workspace: <a href="${workspaceUrl}">${workspaceUrl}</a></p>
<p>This invitation expires ${expiry}.</p>
<p>Your operating documents — keep these handy while you get set up:</p>
<ul>
<li><a href="${publicUrl}/manuals/Portier369-Company-Admin-Guide.pdf">Company Admin Guide</a> — step-by-step setup and day-to-day administration</li>
<li><a href="${publicUrl}/manuals/Portier369-Manager-Runbook.pdf">Manager Runbook</a> — daily operations for your property managers</li>
</ul>
<p>— The Portier369 team</p>`.trim();
}

// ── Create Company + Invite Company Admin ─────────────────────────────────
export async function createCompanyWithAdmin(formData: FormData) {
  const me = await requirePlatformAdmin();
  const supabase = await createClient();

  const companyName = (formData.get('company_name') as string)?.trim();
  const firstName = (formData.get('first_name') as string)?.trim();
  const lastName = (formData.get('last_name') as string)?.trim();
  const email = (formData.get('admin_email') as string)?.trim().toLowerCase();
  const phone = (formData.get('phone_number') as string)?.trim() || null;
  const tier = (formData.get('tier') as string) || 'foundation';
  const maxUnitsInput = String(formData.get('max_units') ?? '').trim();
  const maxUnits = parsePositiveInt(maxUnitsInput);
  const plan = PLAN_BY_ID[tier as PlanId];

  if (!companyName || !firstName || !lastName || !email) {
    fail(COMPANIES, 'Company name, admin first/last name, and email are required.');
  }
  if (!plan) fail(COMPANIES, 'Select a valid plan.');
  if (maxUnitsInput && maxUnits === null) fail(COMPANIES, 'Maximum units must be a whole number greater than zero.');

  const fullName = `${firstName} ${lastName}`;

  // A double click or re-sent form must not provision the company twice.
  const svc = createServiceClient() as any;
  const claim = await claimSubmission(svc, formData, 'platform_company_create', me.auth_user_id);
  if (claim.status === 'error') fail(COMPANIES, claim.message);
  if (claim.status === 'duplicate') {
    if (claim.resultId) ok(COMPANIES, 'created');
    fail(COMPANIES, 'This company is already being created. Refresh in a moment to see it.');
  }
  const submissionToken = (claim as { token: string }).token;

  // 1+2+3: create company, subscription (trialing), and admin invitation with token
  const { data: result, error } = await (supabase as any).rpc('provision_portfolio', {
    p_company_name: companyName,
    p_first_admin_email: email,
    p_first_admin_name: fullName,
    p_tier: tier,
    p_seats: 5,
    p_trial_days: 0,
  });
  if (error) {
    await releaseSubmission(svc, submissionToken);
    fail(COMPANIES, `Could not create company: ${error.message}`);
  }

  const portfolioId = result?.portfolio_id as string;
  const invitationId = result?.invitation_id as string;
  const token = result?.invitation_token as string;
  const expiresAt = result?.invitation_expires_at as string | null;
  // The claim stays in progress until every setup step below succeeds: a
  // replay of a partly set-up company must not report "created". (It is not
  // released either, so a replay can't provision the company a second time.)

  const { data: provisionedPortfolio } = await svc.from('portfolios')
    .select('slug')
    .eq('id', portfolioId)
    .maybeSingle();

  // Post-provision details the RPC doesn't cover.
  // No trials: companies start as active subscriptions immediately.
  if (phone) {
    const { error: phoneError } = await svc.from('portfolios').update({ phone_number: phone }).eq('id', portfolioId);
    if (phoneError) fail(COMPANIES, `Company created, but the phone number was not saved: ${phoneError.message}`);
  }
  const { error: subscriptionError } = await svc.from('subscriptions')
    .update({
      status: 'active',
      trial_ends_at: null,
      units_limit: maxUnits ?? plan?.unitsLimit ?? null,
      ...(plan && !plan.custom ? { price_monthly_cents: plan.priceMonthlyCents } : {}),
    })
    .eq('portfolio_id', portfolioId);
  if (subscriptionError) fail(COMPANIES, `Company created, but its subscription could not be activated: ${subscriptionError.message}`);
  // provision_portfolio creates the invitation as a manager; it must be a
  // company admin before the email goes out, or the first admin joins as a manager.
  // role_id is cleared too: the provisioned invitation carries the board
  // "President" role, which a company admin must not inherit.
  const { data: promoted, error: promoteError } = await svc.from('user_invitations')
    .update({ hoa_role: 'company_admin', full_name: fullName, role_id: null })
    .eq('id', invitationId)
    .select('id');
  if (promoteError || !promoted?.length) fail(COMPANIES, `Company created, but the admin invitation could not be set up: ${promoteError?.message ?? 'invitation not found'}. Invite the admin again from the company page.`);

  // 4: send welcome email
  const { error: mailError } = await svc.from('email_queue').insert({
    to_email: email,
    to_name: fullName,
    subject: `Welcome to Portier369 — set up ${companyName}`,
    body: inviteEmailBody(companyName, token, expiresAt, provisionedPortfolio?.slug),
    status: 'pending',
    from_address: FROM_ADDRESS,
    from_name: FROM_NAME,
    portfolio_id: portfolioId,
  });
  if (mailError) fail(COMPANIES, `Company created but the welcome email failed to queue: ${mailError.message}`);

  // 5: log
  await audit(svc, me, 'company_created', portfolioId, { company_name: companyName, tier, max_units: maxUnits });
  await audit(svc, me, 'admin_invited', portfolioId, { email, full_name: fullName, invitation_id: invitationId });
  await completeSubmission(svc, submissionToken, portfolioId);

  revalidatePath(COMPANIES);
  ok(COMPANIES, 'created');
}

// ── Invite an additional Company Admin ────────────────────────────────────
export async function inviteAdmin(formData: FormData) {
  const me = await requirePlatformAdmin();
  const portfolioId = formData.get('portfolio_id') as string;
  const returnTo = returnPath(formData, `${COMPANIES}/${portfolioId}`);
  const firstName = (formData.get('first_name') as string)?.trim();
  const lastName = (formData.get('last_name') as string)?.trim();
  const email = (formData.get('admin_email') as string)?.trim().toLowerCase();
  if (!email || !firstName || !lastName) fail(returnTo, 'Admin first name, last name, and email are required.');

  const fullName = `${firstName} ${lastName}`;
  const svc = createServiceClient() as any;

  const { data: portfolio } = await svc.from('portfolios').select('company_name, slug, archived_at').eq('id', portfolioId).maybeSingle();
  if (!portfolio) fail(returnTo, 'Company not found.');
  if (portfolio.archived_at) fail(returnTo, 'This company is archived; it cannot take new admins.');

  const { data: invite, error } = await svc
    .from('user_invitations')
    .insert({
      portfolio_id: portfolioId,
      email,
      full_name: fullName,
      hoa_role: 'company_admin',
      invited_by: me.auth_user_id,
      expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
      message: `You have been invited to administer ${portfolio.company_name}.`,
      // We queue our own branded email below; stop queue_invitation_email
      // from sending a second one.
      metadata: { email_delivery: 'application' },
    })
    .select('id, token, expires_at')
    .single();
  if (error) fail(returnTo, `Could not create invitation: ${error.message}`);

  const { error: inviteEmailError } = await svc.from('email_queue').insert({
    to_email: email,
    to_name: fullName,
    subject: `You're invited to administer ${portfolio.company_name} on Portier369`,
    body: inviteEmailBody(portfolio.company_name, invite.token, invite.expires_at, portfolio.slug),
    status: 'pending',
    from_address: FROM_ADDRESS,
    from_name: FROM_NAME,
    portfolio_id: portfolioId,
  });
  if (inviteEmailError) fail(returnTo, `Invitation created, but the email could not be queued: ${inviteEmailError.message}. Use Resend on the invitation.`);

  await audit(svc, me, 'admin_invited', portfolioId, { email, full_name: fullName, invitation_id: invite.id });
  revalidatePath(returnTo);
  ok(returnTo, 'invited');
}

// ── Invitation quick actions ──────────────────────────────────────────────
export async function resendInvitation(formData: FormData) {
  const me = await requirePlatformAdmin();
  const invitationId = formData.get('invitation_id') as string;
  const returnTo = returnPath(formData, '/platform-operator/invitations');

  const svc = createServiceClient() as any;
  const { data: inv } = await svc
    .from('user_invitations')
    .select('id, email, full_name, token, expires_at, portfolio_id, status, metadata')
    .eq('id', invitationId)
    .maybeSingle();
  if (!inv?.token) fail(returnTo, 'Invitation not found or missing token.');
  if (inv.status !== 'pending') fail(returnTo, `Only pending invitations can be resent (this one is ${inv.status}).`);
  if (inv.expires_at && new Date(inv.expires_at) < new Date()) fail(returnTo, 'This invitation has expired. Use Regenerate to send a fresh link.');

  const { data: portfolio } = inv.portfolio_id
    ? await svc.from('portfolios').select('company_name, slug').eq('id', inv.portfolio_id).maybeSingle()
    : { data: null };
  const companyName = portfolio?.company_name ?? 'your company';

  const { error: resendError } = await svc.from('email_queue').insert({
    to_email: inv.email,
    to_name: inv.full_name,
    subject: `Reminder: set up your ${companyName} Portier369 account`,
    body: inviteEmailBody(companyName, inv.token, inv.expires_at, portfolio?.slug),
    status: 'pending',
    from_address: FROM_ADDRESS,
    from_name: FROM_NAME,
    portfolio_id: inv.portfolio_id,
  });
  if (resendError) fail(returnTo, `Could not queue the reminder email: ${resendError.message}`);

  const meta = { ...(inv.metadata ?? {}), resent_count: ((inv.metadata?.resent_count as number) ?? 0) + 1, last_resent_at: new Date().toISOString() };
  await svc.from('user_invitations').update({ metadata: meta }).eq('id', invitationId);

  await audit(svc, me, 'invitation_resent', inv.portfolio_id, { email: inv.email, invitation_id: invitationId });
  revalidatePath(returnTo);
  ok(returnTo, 'resent');
}

export async function cancelInvitation(formData: FormData) {
  const me = await requirePlatformAdmin();
  const invitationId = formData.get('invitation_id') as string;
  const returnTo = returnPath(formData, '/platform-operator/invitations');

  const svc = createServiceClient() as any;
  const { data: inv, error } = await svc
    .from('user_invitations')
    .update({ status: 'revoked' })
    .eq('id', invitationId)
    .eq('status', 'pending') // an accepted invitation is history, not cancellable
    .select('portfolio_id, email')
    .maybeSingle();
  if (error) fail(returnTo, `Could not cancel invitation: ${error.message}`);
  if (!inv) fail(returnTo, 'Only pending invitations can be cancelled.');

  await audit(svc, me, 'invitation_cancelled', inv.portfolio_id, { email: inv.email, invitation_id: invitationId });
  revalidatePath(returnTo);
  ok(returnTo, 'cancelled');
}

export async function regenerateInvitation(formData: FormData) {
  const me = await requirePlatformAdmin();
  const invitationId = formData.get('invitation_id') as string;
  const returnTo = returnPath(formData, '/platform-operator/invitations');

  const svc = createServiceClient() as any;
  const { data: old } = await svc
    .from('user_invitations')
    .select('email, full_name, hoa_role, role_id, portfolio_id, message, metadata, status')
    .eq('id', invitationId)
    .maybeSingle();
  if (!old) fail(returnTo, 'Invitation not found.');
  // An accepted invitation means the person is already onboarded.
  if (!['pending', 'expired'].includes(old.status)) fail(returnTo, `Only pending or expired invitations can be regenerated (this one is ${old.status}).`);

  // Revoke the old link, mint a fresh one (new token + 30-day expiry). If the
  // revoke fails, stop: two live tokens must never exist.
  const { error: revokeError } = await svc.from('user_invitations').update({ status: 'revoked' }).eq('id', invitationId).in('status', ['pending', 'expired']);
  if (revokeError) fail(returnTo, `Could not revoke the old invitation: ${revokeError.message}`);
  const { data: fresh, error } = await svc
    .from('user_invitations')
    .insert({
      email: old.email,
      full_name: old.full_name,
      hoa_role: old.hoa_role,
      role_id: old.role_id,
      portfolio_id: old.portfolio_id,
      message: old.message,
      invited_by: me.auth_user_id,
      expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
      metadata: { ...(old.metadata ?? {}), email_delivery: 'application' }, // app sends the email below
    })
    .select('id, token, expires_at')
    .single();
  if (error) fail(returnTo, `Could not generate a new invitation: ${error.message}`);

  const { data: portfolio } = old.portfolio_id
    ? await svc.from('portfolios').select('company_name, slug').eq('id', old.portfolio_id).maybeSingle()
    : { data: null };
  const companyName = portfolio?.company_name ?? 'your company';

  const { error: regenEmailError } = await svc.from('email_queue').insert({
    to_email: old.email,
    to_name: old.full_name,
    subject: `Your new ${companyName} invitation link`,
    body: inviteEmailBody(companyName, fresh.token, fresh.expires_at, portfolio?.slug),
    status: 'pending',
    from_address: FROM_ADDRESS,
    from_name: FROM_NAME,
    portfolio_id: old.portfolio_id,
  });
  if (regenEmailError) fail(returnTo, `New link created, but the email could not be queued: ${regenEmailError.message}. Use Resend.`);

  await audit(svc, me, 'invitation_regenerated', old.portfolio_id, { email: old.email, old_invitation_id: invitationId, new_invitation_id: fresh.id });
  revalidatePath(returnTo);
  ok(returnTo, 'regenerated');
}

// Account-state changes need a platform *admin* (support/readonly operators may
// not lock people out), can't target yourself or another operator, and must
// keep profiles.disabled_at in step with the auth ban — that flag is what
// isActiveProfile enforces and what /platform-operator/users shows.
async function requireAccountAdministrator(returnTo: string, profileId: string) {
  const me = await requirePlatformAdmin();
  const svc = createServiceClient() as any;
  const { data: operator } = await svc.from('platform_operators')
    .select('role, active').eq('auth_user_id', me.auth_user_id).maybeSingle();
  if (!operator?.active || operator.role !== 'admin') fail(returnTo, 'Platform administrator access is required to change account access.');
  if (!profileId || profileId === me.auth_user_id) fail(returnTo, 'You cannot change your own account here.');
  const { data: targetOperator } = await svc.from('platform_operators').select('id').eq('auth_user_id', profileId).maybeSingle();
  if (targetOperator) fail(returnTo, 'Platform operator accounts are managed from the Operators area.');
  const { data: profile } = await svc.from('profiles').select('id, email, full_name, portfolio_id, disabled_at').eq('id', profileId).maybeSingle();
  if (!profile) fail(returnTo, 'User not found.');
  return { me, svc, profile };
}

// ── Password management ───────────────────────────────────────────────────
export async function sendPasswordReset(formData: FormData) {
  const me = await requirePlatformAdmin();
  const profileId = formData.get('profile_id') as string;
  const returnTo = returnPath(formData, COMPANIES);

  const svc = createServiceClient() as any;
  const { data: profile } = await svc.from('profiles').select('id, email, full_name, portfolio_id').eq('id', profileId).maybeSingle();
  if (!profile?.email) fail(returnTo, 'User not found.');
  const { data: portfolio } = profile.portfolio_id
    ? await svc.from('portfolios').select('slug').eq('id', profile.portfolio_id).maybeSingle()
    : { data: null };

  const { data: linkData, error } = await svc.auth.admin.generateLink({
    type: 'recovery',
    email: profile.email,
    options: { redirectTo: tenantWorkspaceUrl(portfolio?.slug, '/api/auth/callback?next=/reset-password') },
  });
  if (error) fail(returnTo, `Could not generate reset link: ${error.message}`);

  const { error: queueError } = await svc.from('email_queue').insert({
    to_email: profile.email,
    to_name: profile.full_name,
    subject: 'Reset your Portier369 password',
    body: `<p>Hello,</p><p>A password reset was requested for your account by the platform team.</p><p><a href="${verifiedAuthLink(linkData, tenantWorkspaceUrl(portfolio?.slug, '/api/auth/callback?next=/reset-password'), 'recovery')}">Reset your password</a></p><p>If you did not expect this, contact support.</p>`,
    status: 'pending',
    from_address: FROM_ADDRESS,
    from_name: FROM_NAME,
    portfolio_id: profile.portfolio_id,
  });
  if (queueError) fail(returnTo, `Could not queue the reset email: ${queueError.message}`);

  await audit(svc, me, 'password_reset_sent', profile.portfolio_id, { email: profile.email, user_id: profileId });
  revalidatePath(returnTo);
  ok(returnTo, 'reset_sent');
}

export async function forcePasswordReset(formData: FormData) {
  const returnTo = returnPath(formData, COMPANIES);
  const profileId = formData.get('profile_id') as string;
  const { me, svc, profile } = await requireAccountAdministrator(returnTo, profileId);
  if (!profile.email) fail(returnTo, 'This user has no email address to send a reset link to.');

  // Actually force it: replace the password with an unguessable one (the old
  // password stops working) and email a reset link. Previously this only set a
  // metadata flag that nothing read.
  const { randomBytes } = await import('node:crypto');
  const { error } = await svc.auth.admin.updateUserById(profileId, {
    password: randomBytes(32).toString('base64url'),
    user_metadata: { force_password_reset: true, force_password_reset_at: new Date().toISOString() },
  });
  if (error) fail(returnTo, `Could not reset the password: ${error.message}`);

  const { data: portfolio } = profile.portfolio_id
    ? await svc.from('portfolios').select('slug').eq('id', profile.portfolio_id).maybeSingle()
    : { data: null };
  const { data: linkData, error: linkError } = await svc.auth.admin.generateLink({
    type: 'recovery',
    email: profile.email,
    options: { redirectTo: tenantWorkspaceUrl(portfolio?.slug, '/api/auth/callback?next=/reset-password') },
  });
  if (linkError) fail(returnTo, `Password was reset, but the reset link could not be generated: ${linkError.message}. Use "Send reset email".`);
  const { error: queueError } = await svc.from('email_queue').insert({
    to_email: profile.email,
    to_name: profile.full_name,
    subject: 'Set a new Portier369 password',
    body: `<p>Hello,</p><p>The platform team has reset your password. Choose a new one to sign in again.</p><p><a href="${verifiedAuthLink(linkData, tenantWorkspaceUrl(portfolio?.slug, '/api/auth/callback?next=/reset-password'), 'recovery')}">Set a new password</a></p><p>If you did not expect this, contact support.</p>`,
    status: 'pending',
    from_address: FROM_ADDRESS,
    from_name: FROM_NAME,
    portfolio_id: profile.portfolio_id,
  });
  if (queueError) fail(returnTo, `Password was reset, but the email could not be queued: ${queueError.message}. Use "Send reset email".`);

  await audit(svc, me, 'password_reset_forced', profile.portfolio_id, { email: profile.email, user_id: profileId });
  revalidatePath(returnTo);
  ok(returnTo, 'reset_forced');
}

// ── Invoicing ─────────────────────────────────────────────────────────────
function invoiceNumber(): string {
  const ym = todayInZone(displayTimeZone()).slice(0, 7).replace('-', '');
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `INV-${ym}-${rand}`;
}

// Generate an invoice for a company. Amount defaults to the subscription's
// monthly price; period defaults to the current calendar month.
export async function generateInvoice(formData: FormData) {
  const me = await requirePlatformAdmin();
  const portfolioId = formData.get('portfolio_id') as string;
  const returnTo = returnPath(formData, `${COMPANIES}/${portfolioId}`);
  const periodStart = (formData.get('period_start') as string) || '';
  const periodEnd = (formData.get('period_end') as string) || '';
  const amountInput = (formData.get('amount') as string) || '';

  if (!portfolioId) fail(returnTo, 'Select a company.');
  const amountCents = amountInput ? parseDollarsToCents(amountInput) : null;
  if (amountInput && amountCents === null) fail(returnTo, 'Enter the amount as dollars and cents, e.g. 249.00.');

  const svc = createServiceClient() as any;
  const { data: company } = await svc.from('portfolios').select('id').eq('id', portfolioId).maybeSingle();
  if (!company) fail(returnTo, 'Company not found.');
  const { data: sub } = await svc.from('subscriptions')
    .select('id, price_monthly_cents').eq('portfolio_id', portfolioId).maybeSingle();
  const totalCents = amountCents ?? (sub?.price_monthly_cents ?? 0);
  if (!totalCents || totalCents <= 0) fail(returnTo, 'Enter an amount (or set the plan price first).');

  // Default period: the current calendar month in the platform's zone (the
  // server runs in UTC, so local-Date math could land on the wrong month).
  const month = monthWindowInZone(displayTimeZone());
  const ps = periodStart || month.startDate;
  const pe = periodEnd || month.endDate;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ps) || !/^\d{4}-\d{2}-\d{2}$/.test(pe)) fail(returnTo, 'Enter valid period dates.');
  if (pe < ps) fail(returnTo, 'The period end must be on or after the period start.');

  // A double click or re-sent form must not bill the company twice.
  const claim = await claimSubmission(svc, formData, 'platform_invoice_generate', me.auth_user_id);
  if (claim.status === 'error') fail(returnTo, claim.message);
  if (claim.status === 'duplicate') ok(returnTo, 'invoice_generated');
  const submissionToken = (claim as { token: string }).token;

  const { data: created, error } = await svc.from('invoices').insert({
    portfolio_id: portfolioId,
    subscription_id: sub?.id ?? null,
    number: invoiceNumber(),
    period_start: ps,
    period_end: pe,
    subtotal_cents: totalCents,
    total_cents: totalCents,
    status: 'open',
  }).select('id').single();
  if (error) {
    await releaseSubmission(svc, submissionToken);
    fail(returnTo, `Could not generate invoice: ${error.message}`);
  }
  await completeSubmission(svc, submissionToken, created.id);

  await audit(svc, me, 'invoice_generated', portfolioId, { total_cents: totalCents, period_start: ps, period_end: pe });
  revalidatePath(returnTo);
  ok(returnTo, 'invoice_generated');
}

// Email the invoice to the company's billing contact via the email queue.
export async function sendInvoice(formData: FormData) {
  const me = await requirePlatformAdmin();
  const invoiceId = formData.get('invoice_id') as string;
  const portfolioId = formData.get('portfolio_id') as string;
  const returnTo = returnPath(formData, `${COMPANIES}/${portfolioId}`);

  const svc = createServiceClient() as any;
  const { data: inv } = await svc.from('invoices')
    .select('id, number, period_start, period_end, total_cents, notes, portfolio_id, status')
    .eq('id', invoiceId).maybeSingle();
  if (!inv) fail(returnTo, 'Invoice not found.');
  // Only an open invoice is a bill to send: a draft isn't final, and a paid or
  // void one would ask the company to pay something it doesn't owe.
  if (inv.status !== 'open') fail(returnTo, `Only open invoices can be sent (this one is ${inv.status}).`);

  // Recipient: subscription billing_email, else a company admin's email.
  const { data: sub } = await svc.from('subscriptions').select('billing_email').eq('portfolio_id', inv.portfolio_id).maybeSingle();
  let toEmail = (sub?.billing_email as string | null) ?? null;
  if (!toEmail) {
    const { data: admin } = await svc.from('profiles')
      .select('email').eq('portfolio_id', inv.portfolio_id).eq('hoa_role', 'company_admin').limit(1).maybeSingle();
    toEmail = admin?.email ?? null;
  }
  if (!toEmail) fail(returnTo, 'No billing email on file — add a company admin or set a billing email first.');

  const { data: company } = await svc.from('portfolios').select('company_name').eq('id', inv.portfolio_id).maybeSingle();
  const amount = `$${(((inv.total_cents ?? 0) as number) / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
  const period = inv.period_start ? `${inv.period_start} to ${inv.period_end}` : '';
  const body = [
    '<p>Hello,</p>',
    `<p>Invoice <strong>${inv.number ?? inv.id}</strong> for <strong>${company?.company_name ?? 'your company'}</strong> is ready.</p>`,
    '<ul>',
    `<li>Amount due: <strong>${amount}</strong></li>`,
    period ? `<li>Billing period: ${period}</li>` : '',
    '</ul>',
    inv.notes ? `<p>${inv.notes}</p>` : '',
    `<p>You can view this invoice on your Billing page in Portier369. For remittance details or questions, reply to this email or contact ${FROM_ADDRESS}.</p>`,
    '<p>— The Portier369 team</p>',
  ].join('');

  const { error } = await svc.from('email_queue').insert({
    to_email: toEmail,
    to_name: company?.company_name ?? null,
    subject: `Invoice ${inv.number ?? ''} from Portier369`.trim(),
    body,
    status: 'pending',
    from_address: FROM_ADDRESS,
    from_name: FROM_NAME,
    portfolio_id: inv.portfolio_id,
  });
  if (error) fail(returnTo, `Could not queue the invoice email: ${error.message}`);

  const { error: sentAtError } = await svc.from('invoices').update({ sent_at: new Date().toISOString() }).eq('id', invoiceId);
  if (sentAtError) fail(returnTo, `The invoice email was queued, but the sent date could not be recorded: ${sentAtError.message}`);
  await audit(svc, me, 'invoice_sent', inv.portfolio_id, { invoice_id: invoiceId, to_email: toEmail });
  revalidatePath(returnTo);
  ok(returnTo, 'invoice_sent');
}

export async function markInvoicePaid(formData: FormData) {
  const me = await requirePlatformAdmin();
  const invoiceId = formData.get('invoice_id') as string;
  const portfolioId = formData.get('portfolio_id') as string;
  const returnTo = returnPath(formData, `${COMPANIES}/${portfolioId}`);

  const svc = createServiceClient() as any;
  // Only open/overdue invoices can be paid (a voided one must stay void).
  const { data: paid, error } = await svc.from('invoices')
    .update({ status: 'paid', paid_at: new Date().toISOString() })
    .eq('id', invoiceId)
    .in('status', ['open', 'overdue'])
    .select('id, portfolio_id');
  if (error) fail(returnTo, `Could not mark invoice paid: ${error.message}`);
  if (!paid?.length) fail(returnTo, 'Only open or overdue invoices can be marked paid.');

  await audit(svc, me, 'invoice_marked_paid', paid[0].portfolio_id ?? portfolioId, { invoice_id: invoiceId });
  revalidatePath(returnTo);
  ok(returnTo, 'invoice_paid');
}

export async function voidInvoice(formData: FormData) {
  const me = await requirePlatformAdmin();
  const invoiceId = formData.get('invoice_id') as string;
  const portfolioId = formData.get('portfolio_id') as string;
  const returnTo = returnPath(formData, `${COMPANIES}/${portfolioId}`);

  const svc = createServiceClient() as any;
  // A paid invoice cannot be voided (refund it instead).
  const { data: voided, error } = await svc.from('invoices')
    .update({ status: 'void' })
    .eq('id', invoiceId)
    .in('status', ['draft', 'open', 'overdue'])
    .select('id, portfolio_id');
  if (error) fail(returnTo, `Could not void invoice: ${error.message}`);
  if (!voided?.length) fail(returnTo, 'Only draft, open or overdue invoices can be voided.');

  await audit(svc, me, 'invoice_voided', voided[0].portfolio_id ?? portfolioId, { invoice_id: invoiceId });
  revalidatePath(returnTo);
  ok(returnTo, 'invoice_voided');
}

async function setLoginDisabled(formData: FormData, disable: boolean) {
  const returnTo = returnPath(formData, COMPANIES);
  const profileId = formData.get('profile_id') as string;
  const { me, svc, profile } = await requireAccountAdministrator(returnTo, profileId);

  const { error } = await svc.auth.admin.updateUserById(profileId, { ban_duration: disable ? '876000h' : 'none' });
  if (error) fail(returnTo, `Could not ${disable ? 'disable' : 'unlock'} the login: ${error.message}`);
  const { error: profileError } = await svc.from('profiles')
    .update({ disabled_at: disable ? (profile.disabled_at ?? new Date().toISOString()) : null })
    .eq('id', profileId);
  if (profileError) {
    // Keep the login and the profile flag consistent.
    await svc.auth.admin.updateUserById(profileId, { ban_duration: disable ? 'none' : '876000h' });
    fail(returnTo, `Could not update the user profile: ${profileError.message}`);
  }

  await audit(svc, me, disable ? 'login_disabled' : 'account_unlocked', profile.portfolio_id, { email: profile.email, user_id: profileId });
  revalidatePath(returnTo);
  revalidatePath('/platform-operator/users');
  ok(returnTo, disable ? 'login_disabled' : 'unlocked');
}

export async function unlockAccount(formData: FormData) {
  await setLoginDisabled(formData, false);
}

export async function disableLogin(formData: FormData) {
  await setLoginDisabled(formData, true);
}

// ── Edit company details ──────────────────────────────────────────────────
export async function updateCompanyDetails(formData: FormData) {
  const me = await requirePlatformAdmin();
  const portfolioId = formData.get('portfolio_id') as string;
  const returnTo = returnPath(formData, `${COMPANIES}/${portfolioId}`);

  const companyName = (formData.get('company_name') as string)?.trim();
  const phone = (formData.get('phone_number') as string)?.trim();
  const supportEmail = (formData.get('support_email') as string)?.trim();
  if (!companyName) fail(returnTo, 'Company name is required.');

  const update: Record<string, unknown> = {
    company_name: companyName,
    phone_number: phone || null,
    support_email: supportEmail || null,
  };

  const svc = createServiceClient() as any;
  const { data: updated, error } = await svc.from('portfolios').update(update).eq('id', portfolioId).select('id');
  if (error) fail(returnTo, `Could not update company: ${error.message}`);
  if (!updated?.length) fail(returnTo, 'Company not found.');

  await audit(svc, me, 'company_updated', portfolioId, update);
  revalidatePath(returnTo);
  ok(returnTo, 'updated');
}

// ── Workspace address (<slug>.<apex>) ─────────────────────────────────────
export async function updateWorkspaceAddress(formData: FormData) {
  const me = await requirePlatformAdmin();
  const portfolioId = String(formData.get('portfolio_id') ?? '');
  const returnTo = returnPath(formData, `${COMPANIES}/${portfolioId}`);
  const slug = String(formData.get('slug') ?? '').trim().toLowerCase();
  if (!/^[0-9a-f-]{36}$/i.test(portfolioId)) fail(returnTo, 'Company not found.');
  if (!slug) fail(returnTo, 'Enter the new workspace address.');

  const svc = createServiceClient() as any;
  const { data: before } = await svc.from('portfolios').select('slug').eq('id', portfolioId).maybeSingle();
  if (!before) fail(returnTo, 'Company not found.');

  // Signed-in session (not the service role): platform_set_portfolio_slug
  // re-checks that the caller is a platform admin, validates the address,
  // keeps the old one as a forwarding alias and refuses any address another
  // company holds now or held before.
  const db = (await createClient()) as any;
  const { data: saved, error } = await db.rpc('platform_set_portfolio_slug', { p_portfolio_id: portfolioId, p_slug: slug });
  if (error) fail(returnTo, error.message);

  if (saved !== before.slug) {
    await audit(svc, me, 'workspace_address_changed', portfolioId, { from: before.slug, to: saved });
  }
  revalidatePath(returnTo);
  ok(returnTo, 'address_changed');
}

export async function updateCustomDomain(formData: FormData) {
  const me = await requirePlatformAdmin();
  const portfolioId = String(formData.get('portfolio_id') ?? '');
  const returnTo = returnPath(formData, `${COMPANIES}/${portfolioId}`);
  if (!/^[0-9a-f-]{36}$/i.test(portfolioId)) fail(returnTo, 'Company not found.');
  const parsed = parseCustomDomain(formData.get('custom_domain'));
  if (!parsed.ok) fail(returnTo, parsed.error);

  const svc = createServiceClient() as any;
  const { data: before } = await svc.from('portfolios').select('custom_domain').eq('id', portfolioId).maybeSingle();
  if (!before) fail(returnTo, 'Company not found.');

  // Signed-in session: the RPC re-checks platform admin, repeats the
  // validation and refuses a domain another company already uses.
  const db = (await createClient()) as any;
  const { data: saved, error } = await db.rpc('platform_set_portfolio_custom_domain', {
    p_portfolio_id: portfolioId,
    p_domain: parsed.domain ?? '',
  });
  if (error) fail(returnTo, error.message);

  if ((saved ?? null) !== (before.custom_domain ?? null)) {
    await audit(svc, me, 'custom_domain_changed', portfolioId, { from: before.custom_domain ?? null, to: saved ?? null });
  }
  revalidatePath(returnTo);
  if (!saved) ok(returnTo, 'domain_cleared');

  const vercel = vercelDomainsEnv();
  if (vercel) {
    const attached = await attachDomainToVercel(vercel, saved);
    if (!attached.ok) {
      fail(returnTo, `Domain saved, but it could not be added to the Vercel project: ${attached.error} Add ${saved} under Vercel → Project → Domains.`);
    }
  }
  ok(returnTo, 'domain_saved');
}

// ── Email sender domain ─────────────────────────────────────────────────
// Writes go through the signed-in session: portfolio_email_domains RLS lets
// only platform admins insert or update.
export async function setupSenderDomain(formData: FormData) {
  const me = await requirePlatformAdmin();
  const portfolioId = String(formData.get('portfolio_id') ?? '');
  const returnTo = returnPath(formData, `${COMPANIES}/${portfolioId}`);
  if (!/^[0-9a-f-]{36}$/i.test(portfolioId)) fail(returnTo, 'Company not found.');
  const parsed = parseSenderSettings(formData.get('domain'), formData.get('from_local_part'));
  if (!parsed.ok) fail(returnTo, parsed.error);

  const db = (await createClient()) as any;
  const { data: company } = await db.from('portfolios').select('id').eq('id', portfolioId).maybeSingle();
  if (!company) fail(returnTo, 'Company not found.');
  const { data: current, error: currentError } = await db.from('portfolio_email_domains')
    .select('domain, from_local_part, provider_domain_id').eq('portfolio_id', portfolioId).maybeSingle();
  if (currentError) fail(returnTo, currentError.message);

  const { data: taken } = await db.from('portfolio_email_domains')
    .select('portfolio_id').eq('domain', parsed.domain).neq('portfolio_id', portfolioId).maybeSingle();
  if (taken) fail(returnTo, `${parsed.domain} is already another company's sending domain.`);
  // A domain ever registered for another company stays theirs.
  const { data: owner, error: ownerError } = await db.from('email_sender_domain_owners')
    .select('portfolio_id, provider_domain_id').eq('domain', parsed.domain).maybeSingle();
  if (ownerError) fail(returnTo, ownerError.message);
  if (owner && owner.portfolio_id !== portfolioId) {
    fail(returnTo, `${parsed.domain} was registered for another company and can't be used for this one.`);
  }

  // Same domain: only the address before @ changes; keep the verification.
  if (current?.domain === parsed.domain && current.provider_domain_id) {
    const { error } = await db.from('portfolio_email_domains')
      .update({ from_local_part: parsed.localPart }).eq('portfolio_id', portfolioId);
    if (error) fail(returnTo, error.message);
    if (current.from_local_part !== parsed.localPart) {
      await audit(createServiceClient(), me, 'email_domain_changed', portfolioId, {
        from: `${current.from_local_part}@${current.domain}`, to: `${parsed.localPart}@${parsed.domain}`,
      });
    }
    revalidatePath(returnTo);
    ok(returnTo, 'email_domain_saved');
  }

  const resend = resendClient();
  if (!resend) fail(returnTo, 'Email is not configured on this deployment (RESEND_API_KEY is missing).');
  const registered = await registerSenderDomain(resend, parsed.domain, owner?.provider_domain_id ?? null);
  if (!registered.ok) fail(returnTo, `The email provider did not accept ${parsed.domain}: ${registered.error}`);
  const created = registered.domain;
  if (!owner || owner.provider_domain_id !== created.id) {
    const { error: claimError } = owner
      ? await db.from('email_sender_domain_owners').update({ provider_domain_id: created.id })
        .eq('domain', parsed.domain).eq('portfolio_id', portfolioId)
      : await db.from('email_sender_domain_owners')
        .insert({ domain: parsed.domain, portfolio_id: portfolioId, provider_domain_id: created.id });
    if (claimError) fail(returnTo, `${parsed.domain} was registered with the email provider but its ownership could not be saved: ${claimError.message}`);
  }

  const row = {
    portfolio_id: portfolioId,
    domain: parsed.domain,
    from_local_part: parsed.localPart,
    provider_domain_id: created.id,
    status: storedStatus(created.status),
    records: created.records ?? [],
    enabled: true,
    verified_at: created.status === 'verified' ? new Date().toISOString() : null,
    last_checked_at: new Date().toISOString(),
    last_error: null,
  };
  const { error } = await db.from('portfolio_email_domains').upsert(row, { onConflict: 'portfolio_id' });
  if (error) fail(returnTo, `${parsed.domain} was registered with the email provider but could not be saved: ${error.message}`);

  await audit(createServiceClient(), me, 'email_domain_changed', portfolioId, {
    from: current ? `${current.from_local_part}@${current.domain}` : null,
    to: `${parsed.localPart}@${parsed.domain}`,
  });
  revalidatePath(returnTo);
  ok(returnTo, 'email_domain_saved');
}

export async function checkSenderDomain(formData: FormData) {
  await requirePlatformAdmin();
  const portfolioId = String(formData.get('portfolio_id') ?? '');
  const returnTo = returnPath(formData, `${COMPANIES}/${portfolioId}`);
  if (!/^[0-9a-f-]{36}$/i.test(portfolioId)) fail(returnTo, 'Company not found.');

  const db = (await createClient()) as any;
  const { data: current, error: currentError } = await db.from('portfolio_email_domains')
    .select('provider_domain_id, verified_at').eq('portfolio_id', portfolioId).maybeSingle();
  if (currentError) fail(returnTo, currentError.message);
  if (!current?.provider_domain_id) fail(returnTo, 'Set up a sending domain first.');
  const resend = resendClient();
  if (!resend) fail(returnTo, 'Email is not configured on this deployment (RESEND_API_KEY is missing).');

  // Ask the provider to re-check DNS, then read the result.
  const { error: verifyError } = await resend.domains.verify(current.provider_domain_id);
  const { data: domain, error: getError } = await resend.domains.get(current.provider_domain_id);
  const now = new Date().toISOString();
  if (getError || !domain) {
    await db.from('portfolio_email_domains')
      .update({ last_checked_at: now, last_error: getError?.message ?? verifyError?.message ?? 'No response' })
      .eq('portfolio_id', portfolioId);
    fail(returnTo, `Could not check the sending domain: ${getError?.message ?? 'no response from the email provider'}`);
  }

  const status = storedStatus(domain.status);
  const { error } = await db.from('portfolio_email_domains').update({
    status,
    records: domain.records ?? [],
    verified_at: status === 'verified' ? (current.verified_at ?? now) : null,
    last_checked_at: now,
    last_error: verifyError?.message ?? null,
  }).eq('portfolio_id', portfolioId);
  if (error) fail(returnTo, error.message);
  revalidatePath(returnTo);
  ok(returnTo, status === 'verified' ? 'email_domain_verified' : 'email_domain_checked');
}

export async function setSenderDomainEnabled(formData: FormData) {
  const me = await requirePlatformAdmin();
  const portfolioId = String(formData.get('portfolio_id') ?? '');
  const returnTo = returnPath(formData, `${COMPANIES}/${portfolioId}`);
  if (!/^[0-9a-f-]{36}$/i.test(portfolioId)) fail(returnTo, 'Company not found.');
  const enabled = formData.get('enabled') === 'true';

  const db = (await createClient()) as any;
  const { data: updated, error } = await db.from('portfolio_email_domains')
    .update({ enabled }).eq('portfolio_id', portfolioId).select('domain');
  if (error) fail(returnTo, error.message);
  if (!updated?.length) fail(returnTo, 'Set up a sending domain first.');

  await audit(createServiceClient(), me, enabled ? 'email_domain_enabled' : 'email_domain_disabled', portfolioId, { domain: updated[0].domain });
  revalidatePath(returnTo);
  ok(returnTo, enabled ? 'email_domain_enabled' : 'email_domain_disabled');
}

// ── Company status ────────────────────────────────────────────────────────
export async function suspendCompany(formData: FormData) {
  const me = await requirePlatformAdmin();
  const portfolioId = formData.get('portfolio_id') as string;
  const reason = (formData.get('reason') as string)?.trim() || null;
  const returnTo = returnPath(formData, `${COMPANIES}/${portfolioId}`);

  const svc = createServiceClient() as any;
  const { data: suspended, error } = await svc
    .from('portfolios')
    .update({ suspended_at: new Date().toISOString(), suspension_reason: reason })
    .eq('id', portfolioId)
    .is('archived_at', null)
    .is('suspended_at', null)
    .select('id');
  if (error) fail(returnTo, `Could not suspend company: ${error.message}`);
  if (!suspended?.length) fail(returnTo, 'Only an active (not archived or already suspended) company can be suspended.');

  await audit(svc, me, 'company_suspended', portfolioId, { reason });
  revalidatePath(returnTo);
  ok(returnTo, 'suspended');
}

export async function reactivateCompany(formData: FormData) {
  const me = await requirePlatformAdmin();
  const portfolioId = formData.get('portfolio_id') as string;
  const returnTo = returnPath(formData, `${COMPANIES}/${portfolioId}`);

  const svc = createServiceClient() as any;
  // An archived company stays suspended: its logins were banned on archive,
  // so lifting the suspension would leave a half-restored account.
  const { data: reactivated, error } = await svc
    .from('portfolios')
    .update({ suspended_at: null, suspension_reason: null })
    .eq('id', portfolioId)
    .is('archived_at', null)
    .not('suspended_at', 'is', null)
    .select('id');
  if (error) fail(returnTo, `Could not reactivate company: ${error.message}`);
  if (!reactivated?.length) fail(returnTo, 'Only a suspended company that is not archived can be reactivated.');

  await audit(svc, me, 'company_reactivated', portfolioId, {});
  revalidatePath(returnTo);
  ok(returnTo, 'reactivated');
}

// ── Archive (soft delete) ─────────────────────────────────────────────────
// Disables all logins; preserves association data, billing records, and audit logs.
export async function archiveCompany(formData: FormData) {
  const me = await requirePlatformAdmin();
  const portfolioId = formData.get('portfolio_id') as string;

  const svc = createServiceClient() as any;
  const { data: portfolio } = await svc.from('portfolios').select('company_name, archived_at').eq('id', portfolioId).maybeSingle();
  if (!portfolio) fail(COMPANIES, 'Company not found.');
  if (portfolio.archived_at) fail(COMPANIES, 'This company is already archived.');

  // Soft delete only — never destroy customer data
  const { error } = await svc
    .from('portfolios')
    .update({ archived_at: new Date().toISOString(), suspended_at: new Date().toISOString(), suspension_reason: 'Company archived' })
    .eq('id', portfolioId);
  if (error) fail(COMPANIES, `Could not archive company: ${error.message}`);

  // Disable every login on the account
  // (The company is also suspended above, which blocks access in RLS and
  // getMe.) Mark every profile disabled so the users list and
  // isActiveProfile agree, and report bans that failed instead of hiding them.
  const { data: members } = await svc.from('profiles').select('id, email').eq('portfolio_id', portfolioId);
  const disabledAt = new Date().toISOString();
  const banFailures: string[] = [];
  for (const member of members ?? []) {
    const { error: banError } = await svc.auth.admin.updateUserById(member.id, { ban_duration: '876000h' });
    if (banError) banFailures.push(member.email ?? member.id);
  }
  const { error: disableError } = await svc.from('profiles').update({ disabled_at: disabledAt }).eq('portfolio_id', portfolioId).is('disabled_at', null);
  if (disableError) banFailures.push(`profiles (${disableError.message})`);

  // Revoke any open invitations
  await svc.from('user_invitations').update({ status: 'revoked' }).eq('portfolio_id', portfolioId).eq('status', 'pending');

  await audit(svc, me, 'company_archived', portfolioId, {
    company_name: portfolio.company_name,
    logins_disabled: (members ?? []).length - banFailures.length,
    ban_failures: banFailures,
  });
  revalidatePath(COMPANIES);
  if (banFailures.length) fail(COMPANIES, `Company archived and suspended, but ${banFailures.length} login(s) could not be banned: ${banFailures.slice(0, 5).join(', ')}. Their access is still blocked by the suspension.`);
  ok(COMPANIES, 'archived');
}

// ── Subscription plan & limits ────────────────────────────────────────────
export async function changePlan(formData: FormData) {
  const me = await requirePlatformAdmin();
  const portfolioId = formData.get('portfolio_id') as string;
  const tier = formData.get('tier') as string;
  const priceMonthly = formData.get('price_monthly') as string;
  const returnTo = returnPath(formData, `${COMPANIES}/${portfolioId}`);

  const plan = PLAN_BY_ID[tier as PlanId];
  if (!plan) fail(returnTo, 'Select a valid plan.');
  const priceCents = priceMonthly ? parseDollarsToCents(priceMonthly) : null;
  if (priceMonthly && priceCents === null) fail(returnTo, 'Enter the monthly price as dollars and cents, e.g. 249.00.');
  const update: Record<string, unknown> = { tier };
  // Price: explicit input wins; otherwise use the plan's standard price (skip
  // for custom/Enterprise so the operator sets it).
  if (priceCents !== null) update.price_monthly_cents = priceCents;
  else if (plan && !plan.custom) update.price_monthly_cents = plan.priceMonthlyCents;
  // Move the unit cap to match the selected plan (non-custom tiers).
  if (plan && plan.unitsLimit != null) update.units_limit = plan.unitsLimit;

  const svc = createServiceClient() as any;
  const { data: changed, error } = await svc.from('subscriptions').update(update).eq('portfolio_id', portfolioId).select('id');
  if (error) fail(returnTo, `Could not change plan: ${error.message}`);
  if (!changed?.length) fail(returnTo, 'This company has no subscription to change.');
  const { error: tierError } = await svc.from('portfolios').update({ tier }).eq('id', portfolioId);
  if (tierError) fail(returnTo, `Subscription updated, but the company tier could not be saved: ${tierError.message}`);

  await audit(svc, me, 'plan_changed', portfolioId, update);
  revalidatePath(returnTo);
  ok(returnTo, 'plan_changed');
}

export async function adjustLimits(formData: FormData) {
  const me = await requirePlatformAdmin();
  const portfolioId = formData.get('portfolio_id') as string;
  const returnTo = returnPath(formData, `${COMPANIES}/${portfolioId}`);

  const update: Record<string, unknown> = {};
  const unitsLimit = formData.get('units_limit') as string;
  const assocLimit = formData.get('associations_limit') as string;
  const seats = formData.get('seats_included') as string;
  for (const [field, raw] of [['units_limit', unitsLimit], ['associations_limit', assocLimit], ['seats_included', seats]] as const) {
    if (!raw?.trim()) continue;
    const value = parsePositiveInt(raw);
    if (value === null) fail(returnTo, 'Limits must be whole numbers greater than zero.');
    update[field] = value;
  }
  if (Object.keys(update).length === 0) fail(returnTo, 'No limits provided.');

  const svc = createServiceClient() as any;
  const { data: adjusted, error } = await svc.from('subscriptions').update(update).eq('portfolio_id', portfolioId).select('id');
  if (error) fail(returnTo, `Could not adjust limits: ${error.message}`);
  if (!adjusted?.length) fail(returnTo, 'This company has no subscription to adjust.');

  await audit(svc, me, 'limits_adjusted', portfolioId, update);
  revalidatePath(returnTo);
  ok(returnTo, 'limits_adjusted');
}

// ── Transfer ownership ────────────────────────────────────────────────────
export async function transferOwnership(formData: FormData) {
  const me = await requirePlatformAdmin();
  const portfolioId = formData.get('portfolio_id') as string;
  const newOwnerId = formData.get('new_owner_id') as string;
  const returnTo = returnPath(formData, `${COMPANIES}/${portfolioId}`);
  if (!newOwnerId) fail(returnTo, 'Select the staff member to become the company admin.');

  const svc = createServiceClient() as any;
  const { data: newOwner } = await svc
    .from('profiles')
    .select('id, email, full_name, portfolio_id, hoa_role, disabled_at')
    .eq('id', newOwnerId)
    .eq('portfolio_id', portfolioId)
    .maybeSingle();
  if (!newOwner) fail(returnTo, 'The selected user does not belong to this company.');
  // Only company staff can take over: an owner/board/tenant profile in the
  // same portfolio must never be promoted straight to company admin.
  if (!['company_admin', 'manager'].includes(newOwner.hoa_role)) fail(returnTo, 'Only a manager or company admin of this company can become its admin.');
  if (newOwner.disabled_at) fail(returnTo, 'The selected user is disabled. Re-enable their login first.');

  // Demote current admins, promote the new one
  const { data: currentAdmins } = await svc
    .from('profiles')
    .select('id, email')
    .eq('portfolio_id', portfolioId)
    .eq('hoa_role', 'company_admin');

  // Promote first, then demote: a failure part-way must never leave the
  // company with no admin. platform_set_profile_role keeps role_id and the
  // manager's association assignments consistent (a bare hoa_role update left
  // demoted admins as managers with no Property Manager role) and audits it.
  const supabase = await createClient();
  if (newOwner.hoa_role !== 'company_admin') {
    const { error } = await (supabase as any).rpc('platform_set_profile_role', { p_profile_id: newOwnerId, p_hoa_role: 'company_admin' });
    if (error) fail(returnTo, `Could not transfer ownership: ${error.message}`);
  }
  const demoteFailures: string[] = [];
  for (const admin of currentAdmins ?? []) {
    if (admin.id !== newOwnerId) {
      const { error: demoteError } = await (supabase as any).rpc('platform_set_profile_role', { p_profile_id: admin.id, p_hoa_role: 'manager' });
      if (demoteError) demoteFailures.push(`${admin.email ?? admin.id} (${demoteError.message})`);
    }
  }
  if (demoteFailures.length) fail(returnTo, `New admin set, but these admins could not be changed to manager: ${demoteFailures.join(', ')}`);

  await audit(svc, me, 'ownership_transferred', portfolioId, {
    new_admin: newOwner.email,
    demoted: (currentAdmins ?? []).filter((a: any) => a.id !== newOwnerId).map((a: any) => a.email),
  });
  revalidatePath(returnTo);
  ok(returnTo, 'ownership_transferred');
}
