'use server';

// Platform-operator company management actions.
// Every action: (1) requires the platform-operator role, (2) performs the
// mutation via the service-role client, (3) writes an audit_logs row scoped to
// entity_type 'company' / entity_id = portfolio id, (4) fails loudly via
// redirect(?error=...) per CLAUDE.md rule 3.
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requirePlatformOperator, type MeResult } from '@/lib/auth/me';
import { PLAN_BY_ID, type PlanId } from '@/lib/billing/plans';

const SITE_URL = process.env.NEXT_PUBLIC_PORTAL_URL || 'https://portier369.com';
const COMPANIES = '/platform-operator/companies';
// Verified Resend sender for platform-level email
const FROM_ADDRESS = 'hello@portier369.com';
const FROM_NAME = 'Portier369';

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

function inviteEmailBody(companyName: string, token: string, expiresAt: string | null) {
  const url = `${SITE_URL}/invite?token=${encodeURIComponent(token)}`;
  const expiry = expiresAt
    ? new Date(expiresAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : 'in 30 days';
  return `
<p>Hello,</p>
<p>You have been invited to administer <strong>${companyName}</strong> on Portier369.</p>
<p><a href="${url}">Set up your account</a></p>
<p>This invitation expires ${expiry}.</p>
<p>— The Portier369 team</p>`.trim();
}

// ── Create Company + Invite Company Admin ─────────────────────────────────
export async function createCompanyWithAdmin(formData: FormData) {
  const me = await requirePlatformOperator();
  const supabase = await createClient();

  const companyName = (formData.get('company_name') as string)?.trim();
  const firstName = (formData.get('first_name') as string)?.trim();
  const lastName = (formData.get('last_name') as string)?.trim();
  const email = (formData.get('admin_email') as string)?.trim().toLowerCase();
  const phone = (formData.get('phone_number') as string)?.trim() || null;
  const tier = (formData.get('tier') as string) || 'foundation';
  const maxUnits = parseInt(formData.get('max_units') as string, 10) || null;
  const plan = PLAN_BY_ID[tier as PlanId];

  if (!companyName || !firstName || !lastName || !email) {
    fail(COMPANIES, 'Company name, admin first/last name, and email are required.');
  }

  const fullName = `${firstName} ${lastName}`;

  // 1+2+3: create company, subscription (trialing), and admin invitation with token
  const { data: result, error } = await (supabase as any).rpc('provision_portfolio', {
    p_company_name: companyName,
    p_first_admin_email: email,
    p_first_admin_name: fullName,
    p_tier: tier,
    p_seats: 5,
    p_trial_days: 0,
  });
  if (error) fail(COMPANIES, `Could not create company: ${error.message}`);

  const portfolioId = result?.portfolio_id as string;
  const invitationId = result?.invitation_id as string;
  const token = result?.invitation_token as string;
  const expiresAt = result?.invitation_expires_at as string | null;

  const svc = createServiceClient() as any;

  // Post-provision details the RPC doesn't cover.
  // No trials: companies start as active subscriptions immediately.
  if (phone) await svc.from('portfolios').update({ phone_number: phone }).eq('id', portfolioId);
  await svc.from('subscriptions')
    .update({
      status: 'active',
      trial_ends_at: null,
      units_limit: maxUnits ?? plan?.unitsLimit ?? null,
      ...(plan && !plan.custom ? { price_monthly_cents: plan.priceMonthlyCents } : {}),
    })
    .eq('portfolio_id', portfolioId);
  await svc.from('user_invitations')
    .update({ hoa_role: 'company_admin', full_name: fullName })
    .eq('id', invitationId);

  // 4: send welcome email
  const { error: mailError } = await svc.from('email_queue').insert({
    to_email: email,
    to_name: fullName,
    subject: `Welcome to Portier369 — set up ${companyName}`,
    body: inviteEmailBody(companyName, token, expiresAt),
    status: 'pending',
    from_address: FROM_ADDRESS,
    from_name: FROM_NAME,
    portfolio_id: portfolioId,
  });
  if (mailError) fail(COMPANIES, `Company created but the welcome email failed to queue: ${mailError.message}`);

  // 5: log
  await audit(svc, me, 'company_created', portfolioId, { company_name: companyName, tier, max_units: maxUnits });
  await audit(svc, me, 'admin_invited', portfolioId, { email, full_name: fullName, invitation_id: invitationId });

  revalidatePath(COMPANIES);
  ok(COMPANIES, 'created');
}

// ── Invite an additional Company Admin ────────────────────────────────────
export async function inviteAdmin(formData: FormData) {
  const me = await requirePlatformOperator();
  const portfolioId = formData.get('portfolio_id') as string;
  const returnTo = (formData.get('return_to') as string) || `${COMPANIES}/${portfolioId}`;
  const firstName = (formData.get('first_name') as string)?.trim();
  const lastName = (formData.get('last_name') as string)?.trim();
  const email = (formData.get('admin_email') as string)?.trim().toLowerCase();
  if (!email || !firstName || !lastName) fail(returnTo, 'Admin first name, last name, and email are required.');

  const fullName = `${firstName} ${lastName}`;
  const svc = createServiceClient() as any;

  const { data: portfolio } = await svc.from('portfolios').select('company_name').eq('id', portfolioId).maybeSingle();
  if (!portfolio) fail(returnTo, 'Company not found.');

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
    })
    .select('id, token, expires_at')
    .single();
  if (error) fail(returnTo, `Could not create invitation: ${error.message}`);

  await svc.from('email_queue').insert({
    to_email: email,
    to_name: fullName,
    subject: `You're invited to administer ${portfolio.company_name} on Portier369`,
    body: inviteEmailBody(portfolio.company_name, invite.token, invite.expires_at),
    status: 'pending',
    from_address: FROM_ADDRESS,
    from_name: FROM_NAME,
    portfolio_id: portfolioId,
  });

  await audit(svc, me, 'admin_invited', portfolioId, { email, full_name: fullName, invitation_id: invite.id });
  revalidatePath(returnTo);
  ok(returnTo, 'invited');
}

// ── Invitation quick actions ──────────────────────────────────────────────
export async function resendInvitation(formData: FormData) {
  const me = await requirePlatformOperator();
  const invitationId = formData.get('invitation_id') as string;
  const returnTo = (formData.get('return_to') as string) || '/platform-operator/invitations';

  const svc = createServiceClient() as any;
  const { data: inv } = await svc
    .from('user_invitations')
    .select('id, email, full_name, token, expires_at, portfolio_id, status, metadata')
    .eq('id', invitationId)
    .maybeSingle();
  if (!inv?.token) fail(returnTo, 'Invitation not found or missing token.');
  if (inv.status !== 'pending') fail(returnTo, `Only pending invitations can be resent (this one is ${inv.status}).`);

  const { data: portfolio } = inv.portfolio_id
    ? await svc.from('portfolios').select('company_name').eq('id', inv.portfolio_id).maybeSingle()
    : { data: null };
  const companyName = portfolio?.company_name ?? 'your company';

  await svc.from('email_queue').insert({
    to_email: inv.email,
    to_name: inv.full_name,
    subject: `Reminder: set up your ${companyName} Portier369 account`,
    body: inviteEmailBody(companyName, inv.token, inv.expires_at),
    status: 'pending',
    from_address: FROM_ADDRESS,
    from_name: FROM_NAME,
    portfolio_id: inv.portfolio_id,
  });

  const meta = { ...(inv.metadata ?? {}), resent_count: ((inv.metadata?.resent_count as number) ?? 0) + 1, last_resent_at: new Date().toISOString() };
  await svc.from('user_invitations').update({ metadata: meta }).eq('id', invitationId);

  await audit(svc, me, 'invitation_resent', inv.portfolio_id, { email: inv.email, invitation_id: invitationId });
  revalidatePath(returnTo);
  ok(returnTo, 'resent');
}

export async function cancelInvitation(formData: FormData) {
  const me = await requirePlatformOperator();
  const invitationId = formData.get('invitation_id') as string;
  const returnTo = (formData.get('return_to') as string) || '/platform-operator/invitations';

  const svc = createServiceClient() as any;
  const { data: inv, error } = await svc
    .from('user_invitations')
    .update({ status: 'revoked' })
    .eq('id', invitationId)
    .select('portfolio_id, email')
    .single();
  if (error) fail(returnTo, `Could not cancel invitation: ${error.message}`);

  await audit(svc, me, 'invitation_cancelled', inv.portfolio_id, { email: inv.email, invitation_id: invitationId });
  revalidatePath(returnTo);
  ok(returnTo, 'cancelled');
}

export async function regenerateInvitation(formData: FormData) {
  const me = await requirePlatformOperator();
  const invitationId = formData.get('invitation_id') as string;
  const returnTo = (formData.get('return_to') as string) || '/platform-operator/invitations';

  const svc = createServiceClient() as any;
  const { data: old } = await svc
    .from('user_invitations')
    .select('email, full_name, hoa_role, role_id, portfolio_id, message')
    .eq('id', invitationId)
    .maybeSingle();
  if (!old) fail(returnTo, 'Invitation not found.');

  // Revoke the old link, mint a fresh one (new token + 30-day expiry)
  await svc.from('user_invitations').update({ status: 'revoked' }).eq('id', invitationId);
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
    })
    .select('id, token, expires_at')
    .single();
  if (error) fail(returnTo, `Could not generate a new invitation: ${error.message}`);

  const { data: portfolio } = old.portfolio_id
    ? await svc.from('portfolios').select('company_name').eq('id', old.portfolio_id).maybeSingle()
    : { data: null };
  const companyName = portfolio?.company_name ?? 'your company';

  await svc.from('email_queue').insert({
    to_email: old.email,
    to_name: old.full_name,
    subject: `Your new ${companyName} invitation link`,
    body: inviteEmailBody(companyName, fresh.token, fresh.expires_at),
    status: 'pending',
    from_address: FROM_ADDRESS,
    from_name: FROM_NAME,
    portfolio_id: old.portfolio_id,
  });

  await audit(svc, me, 'invitation_regenerated', old.portfolio_id, { email: old.email, old_invitation_id: invitationId, new_invitation_id: fresh.id });
  revalidatePath(returnTo);
  ok(returnTo, 'regenerated');
}

// ── Password management ───────────────────────────────────────────────────
export async function sendPasswordReset(formData: FormData) {
  const me = await requirePlatformOperator();
  const profileId = formData.get('profile_id') as string;
  const returnTo = (formData.get('return_to') as string) || COMPANIES;

  const svc = createServiceClient() as any;
  const { data: profile } = await svc.from('profiles').select('id, email, full_name, portfolio_id').eq('id', profileId).maybeSingle();
  if (!profile?.email) fail(returnTo, 'User not found.');

  const { data: linkData, error } = await svc.auth.admin.generateLink({
    type: 'recovery',
    email: profile.email,
    options: { redirectTo: `${SITE_URL}/api/auth/callback?next=/login` },
  });
  if (error) fail(returnTo, `Could not generate reset link: ${error.message}`);

  await svc.from('email_queue').insert({
    to_email: profile.email,
    to_name: profile.full_name,
    subject: 'Reset your Portier369 password',
    body: `<p>Hello,</p><p>A password reset was requested for your account by the platform team.</p><p><a href="${linkData.properties.action_link}">Reset your password</a></p><p>If you did not expect this, contact support.</p>`,
    status: 'pending',
    from_address: FROM_ADDRESS,
    from_name: FROM_NAME,
    portfolio_id: profile.portfolio_id,
  });

  await audit(svc, me, 'password_reset_sent', profile.portfolio_id, { email: profile.email, user_id: profileId });
  revalidatePath(returnTo);
  ok(returnTo, 'reset_sent');
}

export async function forcePasswordReset(formData: FormData) {
  const me = await requirePlatformOperator();
  const profileId = formData.get('profile_id') as string;
  const returnTo = (formData.get('return_to') as string) || COMPANIES;

  const svc = createServiceClient() as any;
  const { data: profile } = await svc.from('profiles').select('id, email, portfolio_id').eq('id', profileId).maybeSingle();
  if (!profile) fail(returnTo, 'User not found.');

  const { error } = await svc.auth.admin.updateUserById(profileId, {
    user_metadata: { force_password_reset: true, force_password_reset_at: new Date().toISOString() },
  });
  if (error) fail(returnTo, `Could not flag the account: ${error.message}`);

  await audit(svc, me, 'password_reset_forced', profile.portfolio_id, { email: profile.email, user_id: profileId });
  revalidatePath(returnTo);
  ok(returnTo, 'reset_forced');
}

// Directly set a temporary password (more reliable than emailed reset when
// email deliverability is uncertain). The operator shares it with the admin.
export async function setTemporaryPassword(formData: FormData) {
  const me = await requirePlatformOperator();
  const profileId = formData.get('profile_id') as string;
  const newPassword = (formData.get('new_password') as string) || '';
  const returnTo = (formData.get('return_to') as string) || COMPANIES;
  if (newPassword.trim().length < 8) fail(returnTo, 'Temporary password must be at least 8 characters.');

  const svc = createServiceClient() as any;
  const { data: profile } = await svc.from('profiles').select('id, email, portfolio_id').eq('id', profileId).maybeSingle();
  if (!profile) fail(returnTo, 'User not found.');

  const { error } = await svc.auth.admin.updateUserById(profileId, { password: newPassword.trim() });
  if (error) fail(returnTo, `Could not set password: ${error.message}`);

  await audit(svc, me, 'password_set', profile.portfolio_id, { email: profile.email, user_id: profileId });
  revalidatePath(returnTo);
  ok(returnTo, 'password_set');
}

// ── Invoicing ─────────────────────────────────────────────────────────────
function invoiceNumber(): string {
  const d = new Date();
  const ym = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `INV-${ym}-${rand}`;
}

// Generate an invoice for a company. Amount defaults to the subscription's
// monthly price; period defaults to the current calendar month.
export async function generateInvoice(formData: FormData) {
  const me = await requirePlatformOperator();
  const portfolioId = formData.get('portfolio_id') as string;
  const returnTo = (formData.get('return_to') as string) || `${COMPANIES}/${portfolioId}`;
  const periodStart = (formData.get('period_start') as string) || '';
  const periodEnd = (formData.get('period_end') as string) || '';
  const amountInput = (formData.get('amount') as string) || '';

  const svc = createServiceClient() as any;
  const { data: sub } = await svc.from('subscriptions')
    .select('id, price_monthly_cents').eq('portfolio_id', portfolioId).maybeSingle();
  const totalCents = amountInput ? Math.round(parseFloat(amountInput) * 100) : (sub?.price_monthly_cents ?? 0);
  if (!totalCents || totalCents <= 0) fail(returnTo, 'Enter an amount (or set the plan price first).');

  const now = new Date();
  const ps = periodStart || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const pe = periodEnd || new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

  const { error } = await svc.from('invoices').insert({
    portfolio_id: portfolioId,
    subscription_id: sub?.id ?? null,
    number: invoiceNumber(),
    period_start: ps,
    period_end: pe,
    subtotal_cents: totalCents,
    total_cents: totalCents,
    status: 'open',
  });
  if (error) fail(returnTo, `Could not generate invoice: ${error.message}`);

  await audit(svc, me, 'invoice_generated', portfolioId, { total_cents: totalCents, period_start: ps, period_end: pe });
  revalidatePath(returnTo);
  ok(returnTo, 'invoice_generated');
}

// Email the invoice to the company's billing contact via the email queue.
export async function sendInvoice(formData: FormData) {
  const me = await requirePlatformOperator();
  const invoiceId = formData.get('invoice_id') as string;
  const portfolioId = formData.get('portfolio_id') as string;
  const returnTo = (formData.get('return_to') as string) || `${COMPANIES}/${portfolioId}`;

  const svc = createServiceClient() as any;
  const { data: inv } = await svc.from('invoices')
    .select('id, number, period_start, period_end, total_cents, notes, portfolio_id')
    .eq('id', invoiceId).maybeSingle();
  if (!inv) fail(returnTo, 'Invoice not found.');

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

  await svc.from('invoices').update({ sent_at: new Date().toISOString() }).eq('id', invoiceId);
  await audit(svc, me, 'invoice_sent', inv.portfolio_id, { invoice_id: invoiceId, to_email: toEmail });
  revalidatePath(returnTo);
  ok(returnTo, 'invoice_sent');
}

export async function markInvoicePaid(formData: FormData) {
  const me = await requirePlatformOperator();
  const invoiceId = formData.get('invoice_id') as string;
  const portfolioId = formData.get('portfolio_id') as string;
  const returnTo = (formData.get('return_to') as string) || `${COMPANIES}/${portfolioId}`;

  const svc = createServiceClient() as any;
  const { error } = await svc.from('invoices')
    .update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', invoiceId);
  if (error) fail(returnTo, `Could not mark invoice paid: ${error.message}`);

  await audit(svc, me, 'invoice_marked_paid', portfolioId, { invoice_id: invoiceId });
  revalidatePath(returnTo);
  ok(returnTo, 'invoice_paid');
}

export async function voidInvoice(formData: FormData) {
  const me = await requirePlatformOperator();
  const invoiceId = formData.get('invoice_id') as string;
  const portfolioId = formData.get('portfolio_id') as string;
  const returnTo = (formData.get('return_to') as string) || `${COMPANIES}/${portfolioId}`;

  const svc = createServiceClient() as any;
  const { error } = await svc.from('invoices').update({ status: 'void' }).eq('id', invoiceId);
  if (error) fail(returnTo, `Could not void invoice: ${error.message}`);

  await audit(svc, me, 'invoice_voided', portfolioId, { invoice_id: invoiceId });
  revalidatePath(returnTo);
  ok(returnTo, 'invoice_voided');
}

export async function unlockAccount(formData: FormData) {
  const me = await requirePlatformOperator();
  const profileId = formData.get('profile_id') as string;
  const returnTo = (formData.get('return_to') as string) || COMPANIES;

  const svc = createServiceClient() as any;
  const { data: profile } = await svc.from('profiles').select('id, email, portfolio_id').eq('id', profileId).maybeSingle();
  if (!profile) fail(returnTo, 'User not found.');

  const { error } = await svc.auth.admin.updateUserById(profileId, { ban_duration: 'none' });
  if (error) fail(returnTo, `Could not unlock the account: ${error.message}`);

  await audit(svc, me, 'account_unlocked', profile.portfolio_id, { email: profile.email, user_id: profileId });
  revalidatePath(returnTo);
  ok(returnTo, 'unlocked');
}

export async function disableLogin(formData: FormData) {
  const me = await requirePlatformOperator();
  const profileId = formData.get('profile_id') as string;
  const returnTo = (formData.get('return_to') as string) || COMPANIES;

  const svc = createServiceClient() as any;
  const { data: profile } = await svc.from('profiles').select('id, email, portfolio_id').eq('id', profileId).maybeSingle();
  if (!profile) fail(returnTo, 'User not found.');

  // 100-year ban = login disabled until explicitly unlocked
  const { error } = await svc.auth.admin.updateUserById(profileId, { ban_duration: '876000h' });
  if (error) fail(returnTo, `Could not disable login: ${error.message}`);

  await audit(svc, me, 'login_disabled', profile.portfolio_id, { email: profile.email, user_id: profileId });
  revalidatePath(returnTo);
  ok(returnTo, 'login_disabled');
}

// ── Edit company details ──────────────────────────────────────────────────
export async function updateCompanyDetails(formData: FormData) {
  const me = await requirePlatformOperator();
  const portfolioId = formData.get('portfolio_id') as string;
  const returnTo = (formData.get('return_to') as string) || `${COMPANIES}/${portfolioId}`;

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
  const { error } = await svc.from('portfolios').update(update).eq('id', portfolioId);
  if (error) fail(returnTo, `Could not update company: ${error.message}`);

  await audit(svc, me, 'company_updated', portfolioId, update);
  revalidatePath(returnTo);
  ok(returnTo, 'updated');
}

// ── Company status ────────────────────────────────────────────────────────
export async function suspendCompany(formData: FormData) {
  const me = await requirePlatformOperator();
  const portfolioId = formData.get('portfolio_id') as string;
  const reason = (formData.get('reason') as string)?.trim() || null;
  const returnTo = (formData.get('return_to') as string) || `${COMPANIES}/${portfolioId}`;

  const svc = createServiceClient() as any;
  const { error } = await svc
    .from('portfolios')
    .update({ suspended_at: new Date().toISOString(), suspension_reason: reason })
    .eq('id', portfolioId);
  if (error) fail(returnTo, `Could not suspend company: ${error.message}`);

  await audit(svc, me, 'company_suspended', portfolioId, { reason });
  revalidatePath(returnTo);
  ok(returnTo, 'suspended');
}

export async function reactivateCompany(formData: FormData) {
  const me = await requirePlatformOperator();
  const portfolioId = formData.get('portfolio_id') as string;
  const returnTo = (formData.get('return_to') as string) || `${COMPANIES}/${portfolioId}`;

  const svc = createServiceClient() as any;
  const { error } = await svc
    .from('portfolios')
    .update({ suspended_at: null, suspension_reason: null })
    .eq('id', portfolioId);
  if (error) fail(returnTo, `Could not reactivate company: ${error.message}`);

  await audit(svc, me, 'company_reactivated', portfolioId, {});
  revalidatePath(returnTo);
  ok(returnTo, 'reactivated');
}

// ── Archive (soft delete) ─────────────────────────────────────────────────
// Disables all logins; preserves association data, billing records, and audit logs.
export async function archiveCompany(formData: FormData) {
  const me = await requirePlatformOperator();
  const portfolioId = formData.get('portfolio_id') as string;

  const svc = createServiceClient() as any;
  const { data: portfolio } = await svc.from('portfolios').select('company_name').eq('id', portfolioId).maybeSingle();
  if (!portfolio) fail(COMPANIES, 'Company not found.');

  // Soft delete only — never destroy customer data
  const { error } = await svc
    .from('portfolios')
    .update({ archived_at: new Date().toISOString(), suspended_at: new Date().toISOString(), suspension_reason: 'Company archived' })
    .eq('id', portfolioId);
  if (error) fail(COMPANIES, `Could not archive company: ${error.message}`);

  // Disable every login on the account
  const { data: members } = await svc.from('profiles').select('id, email').eq('portfolio_id', portfolioId);
  for (const member of members ?? []) {
    await svc.auth.admin.updateUserById(member.id, { ban_duration: '876000h' });
  }

  // Revoke any open invitations
  await svc.from('user_invitations').update({ status: 'revoked' }).eq('portfolio_id', portfolioId).eq('status', 'pending');

  await audit(svc, me, 'company_archived', portfolioId, {
    company_name: portfolio.company_name,
    logins_disabled: (members ?? []).length,
  });
  revalidatePath(COMPANIES);
  ok(COMPANIES, 'archived');
}

// ── Subscription plan & limits ────────────────────────────────────────────
export async function changePlan(formData: FormData) {
  const me = await requirePlatformOperator();
  const portfolioId = formData.get('portfolio_id') as string;
  const tier = formData.get('tier') as string;
  const priceMonthly = formData.get('price_monthly') as string;
  const returnTo = (formData.get('return_to') as string) || `${COMPANIES}/${portfolioId}`;

  const plan = PLAN_BY_ID[tier as PlanId];
  const update: Record<string, unknown> = { tier };
  // Price: explicit input wins; otherwise use the plan's standard price (skip
  // for custom/Enterprise so the operator sets it).
  if (priceMonthly) update.price_monthly_cents = Math.round(parseFloat(priceMonthly) * 100);
  else if (plan && !plan.custom) update.price_monthly_cents = plan.priceMonthlyCents;
  // Move the unit cap to match the selected plan (non-custom tiers).
  if (plan && plan.unitsLimit != null) update.units_limit = plan.unitsLimit;

  const svc = createServiceClient() as any;
  const { error } = await svc.from('subscriptions').update(update).eq('portfolio_id', portfolioId);
  if (error) fail(returnTo, `Could not change plan: ${error.message}`);
  await svc.from('portfolios').update({ tier }).eq('id', portfolioId);

  await audit(svc, me, 'plan_changed', portfolioId, update);
  revalidatePath(returnTo);
  ok(returnTo, 'plan_changed');
}

export async function adjustLimits(formData: FormData) {
  const me = await requirePlatformOperator();
  const portfolioId = formData.get('portfolio_id') as string;
  const returnTo = (formData.get('return_to') as string) || `${COMPANIES}/${portfolioId}`;

  const update: Record<string, unknown> = {};
  const unitsLimit = formData.get('units_limit') as string;
  const assocLimit = formData.get('associations_limit') as string;
  const seats = formData.get('seats_included') as string;
  if (unitsLimit) update.units_limit = parseInt(unitsLimit, 10);
  if (assocLimit) update.associations_limit = parseInt(assocLimit, 10);
  if (seats) update.seats_included = parseInt(seats, 10);
  if (Object.keys(update).length === 0) fail(returnTo, 'No limits provided.');

  const svc = createServiceClient() as any;
  const { error } = await svc.from('subscriptions').update(update).eq('portfolio_id', portfolioId);
  if (error) fail(returnTo, `Could not adjust limits: ${error.message}`);

  await audit(svc, me, 'limits_adjusted', portfolioId, update);
  revalidatePath(returnTo);
  ok(returnTo, 'limits_adjusted');
}

// ── Transfer ownership ────────────────────────────────────────────────────
export async function transferOwnership(formData: FormData) {
  const me = await requirePlatformOperator();
  const portfolioId = formData.get('portfolio_id') as string;
  const newOwnerId = formData.get('new_owner_id') as string;
  const returnTo = (formData.get('return_to') as string) || `${COMPANIES}/${portfolioId}`;
  if (!newOwnerId) fail(returnTo, 'Select the staff member to become the company admin.');

  const svc = createServiceClient() as any;
  const { data: newOwner } = await svc
    .from('profiles')
    .select('id, email, full_name, portfolio_id')
    .eq('id', newOwnerId)
    .eq('portfolio_id', portfolioId)
    .maybeSingle();
  if (!newOwner) fail(returnTo, 'The selected user does not belong to this company.');

  // Demote current admins, promote the new one
  const { data: currentAdmins } = await svc
    .from('profiles')
    .select('id, email')
    .eq('portfolio_id', portfolioId)
    .eq('hoa_role', 'company_admin');

  for (const admin of currentAdmins ?? []) {
    if (admin.id !== newOwnerId) {
      await svc.from('profiles').update({ hoa_role: 'manager' }).eq('id', admin.id);
    }
  }
  const { error } = await svc.from('profiles').update({ hoa_role: 'company_admin' }).eq('id', newOwnerId);
  if (error) fail(returnTo, `Could not transfer ownership: ${error.message}`);

  await audit(svc, me, 'ownership_transferred', portfolioId, {
    new_admin: newOwner.email,
    demoted: (currentAdmins ?? []).filter((a: any) => a.id !== newOwnerId).map((a: any) => a.email),
  });
  revalidatePath(returnTo);
  ok(returnTo, 'ownership_transferred');
}
