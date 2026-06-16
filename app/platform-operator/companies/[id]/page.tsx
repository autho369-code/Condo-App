import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, CardTitle, Stat } from '@/components/ui/card';
import { Input, Label } from '@/components/ui/input';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { Alert } from '@/components/ui/shell';
import { StatusChip, type Tone } from '@/components/operations/status-chip';
import { createClient } from '@/lib/supabase/server';
import { requirePlatformOperator } from '@/lib/auth/me';
import { date, money } from '@/lib/utils';
import { PLANS, planOptionLabel } from '@/lib/billing/plans';
import {
  adjustLimits,
  archiveCompany,
  cancelInvitation,
  changePlan,
  disableLogin,
  forcePasswordReset,
  generateInvoice,
  inviteAdmin,
  markInvoicePaid,
  sendInvoice,
  reactivateCompany,
  regenerateInvitation,
  resendInvitation,
  sendPasswordReset,
  setTemporaryPassword,
  suspendCompany,
  transferOwnership,
  unlockAccount,
  updateCompanyDetails,
  voidInvoice,
} from '../actions';

export const dynamic = 'force-dynamic';

function subStatusChip(status: string | null | undefined) {
  const map: Record<string, { label: string; tone: Tone }> = {
    active: { label: 'Active', tone: 'success' },
    trialing: { label: 'Trial', tone: 'info' },
    past_due: { label: 'Past Due', tone: 'danger' },
    canceled: { label: 'Cancelled', tone: 'neutral' },
    expired: { label: 'Cancelled', tone: 'neutral' },
    paused: { label: 'Paused', tone: 'warning' },
    // invoice statuses
    open: { label: 'Open', tone: 'warning' },
    paid: { label: 'Paid', tone: 'success' },
    void: { label: 'Void', tone: 'neutral' },
    draft: { label: 'Draft', tone: 'neutral' },
  };
  const m = status ? map[status.toLowerCase()] : null;
  return <StatusChip tone={m?.tone ?? 'neutral'}>{m?.label ?? status ?? 'Not configured'}</StatusChip>;
}

// Spec invitation statuses: Pending / Accepted / Expired / Resent
function inviteStatusChip(inv: any) {
  const isExpired = inv.status === 'expired' || (inv.status === 'pending' && inv.expires_at && new Date(inv.expires_at) < new Date());
  if (inv.status === 'accepted') return <StatusChip tone="success">Accepted</StatusChip>;
  if (inv.status === 'revoked') return <StatusChip tone="neutral">Cancelled</StatusChip>;
  if (isExpired) return <StatusChip tone="warning">Expired</StatusChip>;
  if ((inv.metadata?.resent_count ?? 0) > 0) return <StatusChip tone="info">Resent</StatusChip>;
  return <StatusChip tone="info">Pending</StatusChip>;
}

const ACTION_LABELS: Record<string, string> = {
  company_created: 'Company Created',
  company_updated: 'Company Updated',
  admin_invited: 'Admin Invited',
  invitation_resent: 'Invitation Resent',
  invitation_cancelled: 'Invitation Cancelled',
  invitation_regenerated: 'Invitation Regenerated',
  password_reset_sent: 'Password Reset',
  password_reset_forced: 'Password Reset Forced',
  account_unlocked: 'Account Unlocked',
  login_disabled: 'Login Disabled',
  plan_changed: 'Plan Changed',
  limits_adjusted: 'Unit Limits Adjusted',
  company_suspended: 'Company Suspended',
  company_reactivated: 'Company Reactivated',
  company_archived: 'Company Archived',
  ownership_transferred: 'Ownership Transferred',
};

const BANNERS: Record<string, string> = {
  invited: 'Invitation created and welcome email queued.',
  resent: 'Invitation resent.',
  cancelled: 'Invitation cancelled.',
  regenerated: 'A new invitation link was generated and emailed.',
  reset_sent: 'Password reset email queued.',
  reset_forced: 'The user must reset their password on next login.',
  unlocked: 'Account unlocked.',
  login_disabled: 'Login disabled for the selected user.',
  suspended: 'Company suspended.',
  reactivated: 'Company reactivated.',
  plan_changed: 'Subscription plan updated.',
  limits_adjusted: 'Limits updated.',
  ownership_transferred: 'Company ownership transferred.',
  updated: 'Company details updated.',
  password_set: 'Temporary password set. Share it with the user securely.',
  invoice_generated: 'Invoice generated.',
  invoice_sent: 'Invoice emailed to the company billing contact.',
  invoice_paid: 'Invoice marked paid.',
  invoice_voided: 'Invoice voided.',
};

export default async function CompanyDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  await requirePlatformOperator();
  const supabase = await createClient();
  const db = supabase as any;
  const returnTo = `/platform-operator/companies/${id}`;

  const [
    { data: portfolio },
    { data: subscription },
    { data: staff },
    { data: associationsData },
    { data: invoices },
    { data: invitations },
    { data: auditRows },
  ] = await Promise.all([
    db.from('portfolios').select('id, company_name, slug, tier, created_at, suspended_at, suspension_reason, archived_at, address_city, address_state, phone_number, support_email').eq('id', id).maybeSingle(),
    db.from('subscriptions').select('id, tier, status, billing_email, seats_used, seats_included, associations_limit, units_limit, price_monthly_cents, trial_ends_at, current_period_end').eq('portfolio_id', id).maybeSingle(),
    db.from('profiles').select('id, email, full_name, display_name, hoa_role, last_login_at, mfa_enrolled_at').eq('portfolio_id', id).in('hoa_role', ['company_admin', 'manager']).order('hoa_role'),
    db.from('associations').select('id, name, city, state, unit_count, status').eq('portfolio_id', id).is('archived_at', null).order('name').limit(20),
    db.from('invoices').select('id, number, period_start, period_end, total_cents, status, paid_at, sent_at').eq('portfolio_id', id).order('period_start', { ascending: false }).limit(20),
    db.from('user_invitations').select('id, email, full_name, hoa_role, status, expires_at, created_at, metadata').eq('portfolio_id', id).order('created_at', { ascending: false }).limit(20),
    db.from('audit_logs').select('id, action, actor_email, changes, created_at').eq('entity_type', 'company').eq('entity_id', id).order('created_at', { ascending: false }).limit(30),
  ]);

  if (!portfolio) notFound();

  const totalDoors = (associationsData ?? []).reduce((sum: number, a: any) => sum + (a.unit_count ?? 0), 0);
  const isSuspended = !!portfolio.suspended_at;
  const isArchived = !!portfolio.archived_at;
  const admins = (staff ?? []).filter((s: any) => s.hoa_role === 'company_admin');
  const banner = Object.keys(BANNERS).find((k) => sp[k] === '1');

  return (
    <div className="space-y-7">
      {sp.error && <Alert title="Action failed">{sp.error}</Alert>}
      {banner && <Alert tone="success" title={BANNERS[banner]} />}

      <header className="space-y-2">
        <div className="text-sm">
          <Link href="/platform-operator/companies" className="text-gray-500 hover:text-gray-950 hover:underline">
            Companies
          </Link>
          <span className="px-2 text-gray-300">/</span>
          <span className="text-gray-500">{portfolio.company_name}</span>
        </div>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-950">{portfolio.company_name}</h1>
            <p className="mt-1 text-sm text-gray-500">
              Account management, subscription, invitations, and billing. Property operations stay with the company.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {isArchived ? (
              <StatusChip tone="neutral">Archived</StatusChip>
            ) : (
              <>
                {isSuspended ? (
                  <form action={reactivateCompany as any}>
                    <input type="hidden" name="portfolio_id" value={id} />
                    <input type="hidden" name="return_to" value={returnTo} />
                    <Button type="submit" variant="primary" size="sm">Reactivate</Button>
                  </form>
                ) : (
                  <form action={suspendCompany as any} className="flex items-center gap-2">
                    <input type="hidden" name="portfolio_id" value={id} />
                    <input type="hidden" name="return_to" value={returnTo} />
                    <Input name="reason" placeholder="Suspension reason (optional)" className="h-9 w-56 text-xs" />
                    <Button type="submit" variant="danger" size="sm">Suspend</Button>
                  </form>
                )}
                <form action={archiveCompany as any}>
                  <input type="hidden" name="portfolio_id" value={id} />
                  <Button type="submit" variant="danger" size="sm">Archive Company</Button>
                </form>
              </>
            )}
            {subStatusChip(subscription?.status)}
          </div>
        </div>
        {isSuspended && portfolio.suspension_reason && (
          <p className="text-xs text-red-600">Suspended: {portfolio.suspension_reason}</p>
        )}
      </header>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <Stat label="Tier" value={subscription?.tier ?? portfolio.tier ?? '—'} />
        <Stat label="Seats" value={`${subscription?.seats_used ?? 0} / ${subscription?.seats_included ?? '—'}`} />
        <Stat label="Associations" value={associationsData?.length ?? 0} sub={`Limit: ${subscription?.associations_limit ?? '—'}`} />
        <Stat label="Doors" value={totalDoors} sub={`Limit: ${subscription?.units_limit ?? '—'}`} />
        <Stat label="Monthly" value={subscription?.price_monthly_cents ? money(subscription.price_monthly_cents / 100) : '—'} />
      </div>

      {/* ── Plan & limits ───────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2" id="plan">
        <Card>
          <CardHeader>
            <CardTitle>Change subscription plan</CardTitle>
          </CardHeader>
          <CardBody>
            <form action={changePlan as any} className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="portfolio_id" value={id} />
              <input type="hidden" name="return_to" value={returnTo} />
              <div>
                <Label htmlFor="tier">Plan</Label>
                <select id="tier" name="tier" defaultValue={subscription?.tier ?? 'foundation'} className="h-10 w-64 rounded-md border border-gray-300 bg-white px-3 text-sm">
                  {PLANS.map((p) => <option key={p.id} value={p.id}>{planOptionLabel(p)}</option>)}
                </select>
              </div>
              <div>
                <Label htmlFor="price_monthly">Monthly price ($)</Label>
                <Input id="price_monthly" name="price_monthly" type="number" step="0.01" min="0"
                  defaultValue={subscription?.price_monthly_cents ? (subscription.price_monthly_cents / 100).toFixed(2) : ''} className="w-36" />
              </div>
              <Button type="submit" variant="secondary">Update Plan</Button>
            </form>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Adjust limits</CardTitle>
          </CardHeader>
          <CardBody>
            <form action={adjustLimits as any} className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="portfolio_id" value={id} />
              <input type="hidden" name="return_to" value={returnTo} />
              <div>
                <Label htmlFor="units_limit">Max units</Label>
                <Input id="units_limit" name="units_limit" type="number" min={1} defaultValue={subscription?.units_limit ?? ''} className="w-28" />
              </div>
              <div>
                <Label htmlFor="associations_limit">Max associations</Label>
                <Input id="associations_limit" name="associations_limit" type="number" min={1} defaultValue={subscription?.associations_limit ?? ''} className="w-28" />
              </div>
              <div>
                <Label htmlFor="seats_included">Seats</Label>
                <Input id="seats_included" name="seats_included" type="number" min={1} defaultValue={subscription?.seats_included ?? ''} className="w-24" />
              </div>
              <Button type="submit" variant="secondary">Save Limits</Button>
            </form>
          </CardBody>
        </Card>
      </div>

      {/* ── Company details ─────────────────────────────────────────── */}
      <Card id="details">
        <CardHeader>
          <CardTitle>Company details</CardTitle>
          <p className="text-xs text-gray-500">Changes are recorded in the audit log as &ldquo;Company Updated&rdquo;.</p>
        </CardHeader>
        <CardBody>
          <form action={updateCompanyDetails as any} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="portfolio_id" value={id} />
            <input type="hidden" name="return_to" value={returnTo} />
            <div>
              <Label htmlFor="company_name">Company name</Label>
              <Input id="company_name" name="company_name" required defaultValue={portfolio.company_name ?? ''} className="w-64" />
            </div>
            <div>
              <Label htmlFor="phone_number">Phone number</Label>
              <Input id="phone_number" name="phone_number" type="tel" defaultValue={portfolio.phone_number ?? ''} className="w-44" />
            </div>
            <div>
              <Label htmlFor="support_email">Support email</Label>
              <Input id="support_email" name="support_email" type="email" defaultValue={portfolio.support_email ?? ''} className="w-64" />
            </div>
            <Button type="submit" variant="secondary">Save Details</Button>
          </form>
        </CardBody>
      </Card>

      {/* ── Admins & password management ────────────────────────────── */}
      <Card id="admins">
        <CardHeader>
          <CardTitle>Team &amp; password management</CardTitle>
          <p className="text-xs text-gray-500">Reset passwords, lock or unlock accounts, and transfer company ownership.</p>
        </CardHeader>
        <CardBody className="p-0">
          <Table className="border-0">
            <THead>
              <TR>
                <TH>User</TH>
                <TH>Role</TH>
                <TH>Last Login</TH>
                <TH>MFA</TH>
                <TH>Password &amp; Access</TH>
              </TR>
            </THead>
            <tbody>
              {(staff ?? []).length === 0 ? (
                <TR><TD colSpan={5} className="py-8 text-center text-gray-500">No staff accounts found.</TD></TR>
              ) : (
                (staff ?? []).map((member: any) => (
                  <TR key={member.id}>
                    <TD>
                      <div className="font-medium text-gray-950">{member.full_name ?? member.display_name ?? member.email}</div>
                      <div className="text-xs text-gray-500">{member.email}</div>
                    </TD>
                    <TD className="text-xs capitalize text-gray-700">{member.hoa_role?.replace(/_/g, ' ')}</TD>
                    <TD className="text-xs text-gray-500">{date(member.last_login_at)}</TD>
                    <TD className="text-xs text-gray-500">{member.mfa_enrolled_at ? 'Enrolled' : '—'}</TD>
                    <TD>
                      <div className="flex flex-wrap items-center gap-1">
                        <form action={sendPasswordReset as any}>
                          <input type="hidden" name="profile_id" value={member.id} />
                          <input type="hidden" name="return_to" value={returnTo} />
                          <Button type="submit" variant="ghost" size="sm">Send Reset</Button>
                        </form>
                        <form action={forcePasswordReset as any}>
                          <input type="hidden" name="profile_id" value={member.id} />
                          <input type="hidden" name="return_to" value={returnTo} />
                          <Button type="submit" variant="ghost" size="sm">Force Reset</Button>
                        </form>
                        <form action={unlockAccount as any}>
                          <input type="hidden" name="profile_id" value={member.id} />
                          <input type="hidden" name="return_to" value={returnTo} />
                          <Button type="submit" variant="ghost" size="sm">Unlock</Button>
                        </form>
                        <form action={disableLogin as any}>
                          <input type="hidden" name="profile_id" value={member.id} />
                          <input type="hidden" name="return_to" value={returnTo} />
                          <Button type="submit" variant="ghost" size="sm" className="text-red-600 hover:text-red-700">Disable Login</Button>
                        </form>
                        <form action={setTemporaryPassword as any} className="flex items-center gap-1">
                          <input type="hidden" name="profile_id" value={member.id} />
                          <input type="hidden" name="return_to" value={returnTo} />
                          <input name="new_password" type="text" placeholder="New temp password" minLength={8} required className="h-8 w-40 rounded-md border border-gray-300 px-2 text-xs" />
                          <Button type="submit" variant="ghost" size="sm">Set Password</Button>
                        </form>
                      </div>
                    </TD>
                  </TR>
                ))
              )}
            </tbody>
          </Table>
          <div className="grid gap-4 border-t border-gray-100 p-4 lg:grid-cols-2">
            <div>
              <h3 className="text-sm font-semibold text-gray-950">Invite additional admin</h3>
              <form action={inviteAdmin as any} className="mt-3 flex flex-wrap items-end gap-2">
                <input type="hidden" name="portfolio_id" value={id} />
                <input type="hidden" name="return_to" value={returnTo} />
                <div>
                  <Label htmlFor="first_name">First name</Label>
                  <Input id="first_name" name="first_name" required className="w-32" />
                </div>
                <div>
                  <Label htmlFor="last_name">Last name</Label>
                  <Input id="last_name" name="last_name" required className="w-32" />
                </div>
                <div>
                  <Label htmlFor="admin_email">Email</Label>
                  <Input id="admin_email" name="admin_email" type="email" required className="w-56" />
                </div>
                <Button type="submit" variant="secondary">Invite Admin</Button>
              </form>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-950">Transfer company ownership</h3>
              <form action={transferOwnership as any} className="mt-3 flex flex-wrap items-end gap-2">
                <input type="hidden" name="portfolio_id" value={id} />
                <input type="hidden" name="return_to" value={returnTo} />
                <div>
                  <Label htmlFor="new_owner_id">New company admin</Label>
                  <select id="new_owner_id" name="new_owner_id" required className="h-10 w-64 rounded-md border border-gray-300 bg-white px-3 text-sm">
                    <option value="">Select staff member…</option>
                    {(staff ?? []).map((member: any) => (
                      <option key={member.id} value={member.id}>
                        {(member.full_name ?? member.email) + (member.hoa_role === 'company_admin' ? ' (current admin)' : '')}
                      </option>
                    ))}
                  </select>
                </div>
                <Button type="submit" variant="secondary">Transfer</Button>
              </form>
              <p className="mt-2 text-xs text-gray-400">Current admins are demoted to manager; the selected user becomes the company admin.</p>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* ── Invitations ─────────────────────────────────────────────── */}
      <Card id="invitations">
        <CardHeader>
          <CardTitle>Invitations</CardTitle>
          <p className="text-xs text-gray-500">{admins.length} active admin{admins.length === 1 ? '' : 's'} · invitation history for this company</p>
        </CardHeader>
        <CardBody className="p-0">
          <Table className="border-0">
            <THead>
              <TR>
                <TH>Invitee</TH>
                <TH>Role</TH>
                <TH>Status</TH>
                <TH>Sent</TH>
                <TH>Expires</TH>
                <TH>Quick Actions</TH>
              </TR>
            </THead>
            <tbody>
              {(invitations ?? []).length === 0 ? (
                <TR><TD colSpan={6} className="py-8 text-center text-gray-500">No invitations for this company.</TD></TR>
              ) : (
                (invitations ?? []).map((inv: any) => {
                  const actionable = inv.status === 'pending';
                  return (
                    <TR key={inv.id}>
                      <TD>
                        <div className="font-medium text-gray-950">{inv.full_name || '—'}</div>
                        <div className="text-xs text-gray-500">{inv.email}</div>
                      </TD>
                      <TD className="text-xs capitalize text-gray-700">{inv.hoa_role?.replace(/_/g, ' ')}</TD>
                      <TD>{inviteStatusChip(inv)}</TD>
                      <TD className="text-xs text-gray-500">{date(inv.created_at)}</TD>
                      <TD className="text-xs text-gray-500">{date(inv.expires_at)}</TD>
                      <TD>
                        <div className="flex flex-wrap items-center gap-1">
                          {actionable && (
                            <form action={resendInvitation as any}>
                              <input type="hidden" name="invitation_id" value={inv.id} />
                              <input type="hidden" name="return_to" value={returnTo} />
                              <Button type="submit" variant="ghost" size="sm">Resend</Button>
                            </form>
                          )}
                          {actionable && (
                            <form action={cancelInvitation as any}>
                              <input type="hidden" name="invitation_id" value={inv.id} />
                              <input type="hidden" name="return_to" value={returnTo} />
                              <Button type="submit" variant="ghost" size="sm">Cancel</Button>
                            </form>
                          )}
                          {inv.status !== 'accepted' && (
                            <form action={regenerateInvitation as any}>
                              <input type="hidden" name="invitation_id" value={inv.id} />
                              <input type="hidden" name="return_to" value={returnTo} />
                              <Button type="submit" variant="ghost" size="sm">New Link</Button>
                            </form>
                          )}
                        </div>
                      </TD>
                    </TR>
                  );
                })
              )}
            </tbody>
          </Table>
        </CardBody>
      </Card>

      {/* ── Company info + associations ─────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Company info</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-gray-500">Company name</span>
                <div className="font-medium text-gray-950">{portfolio.company_name}</div>
              </div>
              <div>
                <span className="text-gray-500">Slug</span>
                <div className="font-medium text-gray-950">{portfolio.slug ?? '—'}</div>
              </div>
              <div>
                <span className="text-gray-500">Created</span>
                <div className="font-medium text-gray-950">{date(portfolio.created_at, 'long')}</div>
              </div>
              <div>
                <span className="text-gray-500">Location</span>
                <div className="font-medium text-gray-950">{[portfolio.address_city, portfolio.address_state].filter(Boolean).join(', ') || '—'}</div>
              </div>
              <div>
                <span className="text-gray-500">Phone</span>
                <div className="font-medium text-gray-950">{portfolio.phone_number || '—'}</div>
              </div>
              <div>
                <span className="text-gray-500">Billing email</span>
                <div className="font-medium text-gray-950">{subscription?.billing_email ?? '—'}</div>
              </div>
              <div>
                <span className="text-gray-500">Trial ends</span>
                <div className="font-medium text-gray-950">{date(subscription?.trial_ends_at)}</div>
              </div>
              <div>
                <span className="text-gray-500">Period ends</span>
                <div className="font-medium text-gray-950">{date(subscription?.current_period_end)}</div>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Associations ({associationsData?.length ?? 0})</CardTitle>
          </CardHeader>
          <CardBody className="p-0">
            <Table className="border-0">
              <THead>
                <TR>
                  <TH>Property</TH>
                  <TH>Location</TH>
                  <TH className="text-right">Doors</TH>
                </TR>
              </THead>
              <tbody>
                {(associationsData ?? []).length === 0 ? (
                  <TR><TD colSpan={3} className="text-center text-gray-500">No associations found.</TD></TR>
                ) : (
                  (associationsData ?? []).map((assoc: any) => (
                    <TR key={assoc.id}>
                      <TD className="font-medium text-gray-950">{assoc.name}</TD>
                      <TD className="text-xs text-gray-500">{[assoc.city, assoc.state].filter(Boolean).join(', ') || '—'}</TD>
                      <TD className="text-right tabular-nums">{assoc.unit_count ?? 0}</TD>
                    </TR>
                  ))
                )}
              </tbody>
            </Table>
          </CardBody>
        </Card>
      </div>

      {/* ── Billing history ─────────────────────────────────────────── */}
      <Card id="billing">
        <CardHeader>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <CardTitle>Billing history</CardTitle>
            <form action={generateInvoice as any} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="portfolio_id" value={id} />
              <input type="hidden" name="return_to" value={returnTo} />
              <div>
                <Label htmlFor="inv_amount" className="text-xs">Amount ($)</Label>
                <Input id="inv_amount" name="amount" type="number" step="0.01" min="0"
                  defaultValue={subscription?.price_monthly_cents ? (subscription.price_monthly_cents / 100).toFixed(2) : ''}
                  placeholder="Plan price" className="h-9 w-28" />
              </div>
              <div>
                <Label htmlFor="inv_start" className="text-xs">Period start</Label>
                <Input id="inv_start" name="period_start" type="date" className="h-9 w-36" />
              </div>
              <div>
                <Label htmlFor="inv_end" className="text-xs">Period end</Label>
                <Input id="inv_end" name="period_end" type="date" className="h-9 w-36" />
              </div>
              <Button type="submit" size="sm">Generate invoice</Button>
            </form>
          </div>
          <p className="mt-1 text-xs text-gray-500">Billed offline: generate an invoice (defaults to the plan price + current month), then mark it paid when payment arrives. The company admin sees it on their Billing page.</p>
        </CardHeader>
        <CardBody className="p-0">
          <Table className="border-0">
            <THead>
              <TR>
                <TH>Invoice</TH>
                <TH>Period</TH>
                <TH className="text-right">Total</TH>
                <TH>Status</TH>
                <TH>Paid</TH>
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <tbody>
              {(invoices ?? []).length === 0 ? (
                <TR><TD colSpan={6} className="text-center text-gray-500">No invoices yet — generate one above.</TD></TR>
              ) : (
                (invoices ?? []).map((inv: any) => (
                  <TR key={inv.id}>
                    <TD className="font-medium text-gray-950">{inv.number ?? inv.id}</TD>
                    <TD className="text-xs text-gray-500">
                      {date(inv.period_start)} – {date(inv.period_end)}
                    </TD>
                    <TD className="text-right tabular-nums">{money((inv.total_cents ?? 0) / 100)}</TD>
                    <TD>{subStatusChip(inv.status)}</TD>
                    <TD className="text-xs text-gray-500">{date(inv.paid_at)}</TD>
                    <TD className="text-right">
                      <div className="flex flex-wrap items-center justify-end gap-1">
                        {inv.status !== 'void' && (
                          <form action={sendInvoice as any}>
                            <input type="hidden" name="invoice_id" value={inv.id} />
                            <input type="hidden" name="portfolio_id" value={id} />
                            <input type="hidden" name="return_to" value={returnTo} />
                            <Button type="submit" variant="ghost" size="sm">{inv.sent_at ? 'Resend' : 'Send'}</Button>
                          </form>
                        )}
                        {inv.status !== 'paid' && inv.status !== 'void' && (
                          <>
                            <form action={markInvoicePaid as any}>
                              <input type="hidden" name="invoice_id" value={inv.id} />
                              <input type="hidden" name="portfolio_id" value={id} />
                              <input type="hidden" name="return_to" value={returnTo} />
                              <Button type="submit" variant="ghost" size="sm">Mark paid</Button>
                            </form>
                            <form action={voidInvoice as any}>
                              <input type="hidden" name="invoice_id" value={inv.id} />
                              <input type="hidden" name="portfolio_id" value={id} />
                              <input type="hidden" name="return_to" value={returnTo} />
                              <Button type="submit" variant="ghost" size="sm" className="text-red-600 hover:text-red-700">Void</Button>
                            </form>
                          </>
                        )}
                        {inv.status === 'void' && <span className="text-xs text-gray-400">—</span>}
                      </div>
                    </TD>
                  </TR>
                ))
              )}
            </tbody>
          </Table>
        </CardBody>
      </Card>

      {/* ── Audit log ───────────────────────────────────────────────── */}
      <Card id="audit">
        <CardHeader>
          <CardTitle>Audit log</CardTitle>
          <p className="text-xs text-gray-500">Every platform action against this company: who, what, and when.</p>
        </CardHeader>
        <CardBody className="p-0">
          <Table className="border-0">
            <THead>
              <TR>
                <TH>Date &amp; Time</TH>
                <TH>User</TH>
                <TH>Action</TH>
                <TH>Details</TH>
              </TR>
            </THead>
            <tbody>
              {(auditRows ?? []).length === 0 ? (
                <TR><TD colSpan={4} className="py-8 text-center text-gray-500">No platform actions recorded for this company yet.</TD></TR>
              ) : (
                (auditRows ?? []).map((row: any) => (
                  <TR key={row.id}>
                    <TD className="whitespace-nowrap text-xs tabular-nums text-gray-700">
                      {new Date(row.created_at).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </TD>
                    <TD className="text-xs text-gray-700">{row.actor_email ?? '—'}</TD>
                    <TD className="text-sm font-medium text-gray-950">{ACTION_LABELS[row.action] ?? row.action}</TD>
                    <TD className="max-w-md truncate text-xs text-gray-500">
                      {row.changes && Object.keys(row.changes).length > 0
                        ? Object.entries(row.changes).map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join(' · ')
                        : '—'}
                    </TD>
                  </TR>
                ))
              )}
            </tbody>
          </Table>
        </CardBody>
      </Card>
    </div>
  );
}
