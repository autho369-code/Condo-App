import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { Workspace, WorkspaceHeader } from '@/components/workspace/shell';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Label, Field } from '@/components/ui/input';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import {
  inviteStaffMember, inviteBoardMemberWizard,
  inviteHomeownerWizard, inviteVendorWizard,
} from '@/lib/rpcs/team-invites';
import { date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const TABS = ['staff', 'board', 'homeowner', 'vendor'] as const;
type Tab = (typeof TABS)[number];

const STAFF_ROLES = [
  { value: 'manager', label: 'Manager — full operational access' },
  { value: 'accountant', label: 'Accountant — financial access' },
  { value: 'property_manager', label: 'Property Manager — day-to-day ops' },
];

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const me = await requireStaff();
  const { tab = 'staff' } = await searchParams;
  const activeTab = TABS.includes(tab as Tab) ? (tab as Tab) : 'staff';
  const supabase = await createClient();

  // Get associations this manager has access to
  const { data: associations } = await (supabase as any)
    .from('associations')
    .select('id, name')
    .is('archived_at', null)
    .order('name');

  // Get pending invitations
  const { data: invitations } = await (supabase as any)
    .from('user_invitations')
    .select('id, email, full_name, role, association_id, created_at, status, associations(name)')
    .is('archived_at', null)
    .order('created_at', { ascending: false })
    .limit(50);

  return (
    <Workspace
      header={
        <WorkspaceHeader
          eyebrow="Settings"
          title="Team & Invites"
          subtitle="Invite staff, board members, homeowners, and vendors. Each role gets scoped access."
        />
      }
    >
      {/* Tab navigation */}
      <nav className="mb-6 flex gap-1 border-b border-ink-100">
        {[
          { key: 'staff', label: 'Staff' },
          { key: 'board', label: 'Board Members' },
          { key: 'homeowner', label: 'Homeowners' },
          { key: 'vendor', label: 'Vendors' },
        ].map((t) => {
          const isActive = t.key === activeTab;
          return (
            <Link
              key={t.key}
              href={`/settings/team?tab=${t.key}`}
              className={`border-b-2 px-4 py-2 text-sm transition ${
                isActive
                  ? 'border-brand-600 font-medium text-brand-600'
                  : 'border-transparent text-ink-600 hover:text-ink-900'
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>

      {/* Staff Invite Form */}
      {activeTab === 'staff' && (
        <Card>
          <CardHeader>
            <CardTitle>Invite Staff Member</CardTitle>
          </CardHeader>
          <CardBody>
            <form action={inviteStaffMember as any} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Full Name">
                  <Input name="full_name" required placeholder="Jane Smith" />
                </Field>
                <Field label="Email">
                  <Input name="email" type="email" required placeholder="jane@company.com" />
                </Field>
              </div>
              <Field label="Role">
                <select
                  name="role"
                  required
                  className="h-10 w-full rounded-md border border-ink-200 bg-white px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  <option value="">Select role…</option>
                  {STAFF_ROLES.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </Field>
              <div className="flex justify-end">
                <Button type="submit" variant="accent">Send invitation</Button>
              </div>
            </form>
          </CardBody>
        </Card>
      )}

      {/* Board Member Invite */}
      {activeTab === 'board' && (
        <Card>
          <CardHeader>
            <CardTitle>Invite Board Member</CardTitle>
          </CardHeader>
          <CardBody>
            <form action={inviteBoardMemberWizard as any} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Full Name">
                  <Input name="full_name" required placeholder="George Park" />
                </Field>
                <Field label="Email">
                  <Input name="email" type="email" required placeholder="george@example.com" />
                </Field>
              </div>
              <Field label="Association">
                <select
                  name="association_id"
                  required
                  className="h-10 w-full rounded-md border border-ink-200 bg-white px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  <option value="">Select association…</option>
                  {(associations ?? []).map((a: any) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Board Role (optional)">
                <Input name="board_role" placeholder="e.g. President, Treasurer, Secretary" />
              </Field>
              <div className="flex justify-end">
                <Button type="submit" variant="accent">Send invitation</Button>
              </div>
            </form>
          </CardBody>
        </Card>
      )}

      {/* Homeowner Invite */}
      {activeTab === 'homeowner' && (
        <Card>
          <CardHeader>
            <CardTitle>Invite Homeowner</CardTitle>
          </CardHeader>
          <CardBody>
            <form action={inviteHomeownerWizard as any} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Full Name">
                  <Input name="full_name" required placeholder="Alice Walker" />
                </Field>
                <Field label="Email">
                  <Input name="email" type="email" required placeholder="alice@example.com" />
                </Field>
              </div>
              <Field label="Association">
                <select
                  name="association_id"
                  required
                  className="h-10 w-full rounded-md border border-ink-200 bg-white px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  <option value="">Select association…</option>
                  {(associations ?? []).map((a: any) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Unit Number">
                <Input name="unit_number" required placeholder="101" />
              </Field>
              <div className="flex justify-end">
                <Button type="submit" variant="accent">Send invitation</Button>
              </div>
            </form>
          </CardBody>
        </Card>
      )}

      {/* Vendor Invite */}
      {activeTab === 'vendor' && (
        <Card>
          <CardHeader>
            <CardTitle>Invite Vendor</CardTitle>
          </CardHeader>
          <CardBody>
            <form action={inviteVendorWizard as any} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Company Name">
                  <Input name="name" required placeholder="A&A Services Corp" />
                </Field>
                <Field label="Contact Email">
                  <Input name="email" type="email" required placeholder="contact@aaservices.com" />
                </Field>
              </div>
              <Field label="Trade">
                <select
                  name="trade"
                  required
                  className="h-10 w-full rounded-md border border-ink-200 bg-white px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  <option value="">Select trade…</option>
                  {['plumbing','electrical','hvac','landscaping','roofing','general_contractor','handyperson','snow_removal','pest_control','other'].map((t) => (
                    <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </Field>
              <div className="flex justify-end">
                <Button type="submit" variant="accent">Send invitation</Button>
              </div>
            </form>
          </CardBody>
        </Card>
      )}

      {/* Pending Invitations */}
      <div className="mt-8">
        <Card>
          <CardHeader>
            <CardTitle>Pending Invitations</CardTitle>
          </CardHeader>
          <CardBody>
            {invitations && invitations.length > 0 ? (
              <Table>
                <THead>
                  <TR>
                    <TH>Email</TH>
                    <TH>Name</TH>
                    <TH>Role</TH>
                    <TH>Association</TH>
                    <TH>Sent</TH>
                    <TH>Status</TH>
                  </TR>
                </THead>
                <tbody>
                  {invitations.map((inv: any) => (
                    <TR key={inv.id}>
                      <TD className="font-mono text-xs">{inv.email}</TD>
                      <TD>{inv.full_name ?? '—'}</TD>
                      <TD className="capitalize text-xs">{inv.role}</TD>
                      <TD className="text-xs text-ink-500">{inv.associations?.name ?? '—'}</TD>
                      <TD className="text-xs text-ink-500">{date(inv.created_at)}</TD>
                      <TD>
                        <span className={`rounded px-2 py-0.5 text-xs capitalize ${
                          inv.status === 'sent' ? 'bg-amber-100 text-amber-800' :
                          inv.status === 'accepted' ? 'bg-green-100 text-green-700' :
                          inv.status === 'expired' ? 'bg-cream-100 text-ink-500' :
                          'bg-cream-100 text-ink-600'
                        }`}>
                          {inv.status ?? 'pending'}
                        </span>
                      </TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            ) : (
              <p className="py-6 text-center text-sm text-ink-500">No pending invitations.</p>
            )}
          </CardBody>
        </Card>
      </div>
    </Workspace>
  );
}
