import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { Workspace, WorkspaceHeader } from '@/components/workspace/shell';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import {
  inviteStaffMember, inviteBoardMemberWizard,
  inviteOwnerWizard, inviteVendorWizard,
  invitePropertyManager,
} from '@/lib/rpcs/team-invites';
import { date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const TABS = ['staff', 'manager', 'board', 'owner', 'vendor'] as const;
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

  const { data: associations } = await (supabase as any)
    .from('associations')
    .select('id, name')
    .is('archived_at', null)
    .order('name');

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
          subtitle="Invite staff, property managers, board members, owners, and vendors. Each role gets scoped access."
        />
      }
    >
      <nav className="mb-6 flex gap-1 border-b border-ink-100">
        {[
          { key: 'staff', label: 'Staff' },
          { key: 'manager', label: 'Managers' },
          { key: 'board', label: 'Board Members' },
          { key: 'owner', label: 'Owners' },
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
                <div><Label>Full Name</Label><Input name="full_name" required placeholder="Jane Smith" /></div>
                <div><Label>Email</Label><Input name="email" type="email" required placeholder="jane@company.com" /></div>
              </div>
              <div>
                <Label>Role</Label>
                <select name="role" required className="h-10 w-full rounded-md border border-ink-200 bg-white px-3 text-sm">
                  <option value="">Select role…</option>
                  {STAFF_ROLES.map((r) => (<option key={r.value} value={r.value}>{r.label}</option>))}
                </select>
              </div>
              <div className="flex justify-end"><Button type="submit" variant="default">Send invitation</Button></div>
            </form>
          </CardBody>
        </Card>
      )}

      {/* Property Manager Invite */}
      {activeTab === 'manager' && (
        <Card>
          <CardHeader>
            <CardTitle>Invite Property Manager</CardTitle>
            <p className="text-xs text-ink-500">Property managers can only see the units you assign below.</p>
          </CardHeader>
          <CardBody>
            <form action={invitePropertyManager as any} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div><Label>Full Name</Label><Input name="full_name" required placeholder="Mike Torres" /></div>
                <div><Label>Email</Label><Input name="email" type="email" required placeholder="mike@company.com" /></div>
              </div>
              <div>
                <Label>Assign Properties / Units (select at least one)</Label>
                <div className="max-h-64 overflow-y-auto rounded-md border border-ink-200 p-3 space-y-4 mt-1">
                  {(associations ?? []).map((a: any) => (
                    <div key={a.id} className="space-y-1">
                      <p className="text-xs font-semibold text-ink-700">{a.name}</p>
                      <label className="flex items-center gap-2 text-sm text-ink-600 cursor-pointer">
                        <input type="checkbox" name="unit_ids" value={a.id} className="h-4 w-4 rounded border-ink-300 text-brand-600" />
                        <span>All units in {a.name}</span>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex justify-end"><Button type="submit" variant="default">Send invitation</Button></div>
            </form>
          </CardBody>
        </Card>
      )}

      {/* Board Member Invite */}
      {activeTab === 'board' && (
        <Card>
          <CardHeader><CardTitle>Invite Board Member</CardTitle></CardHeader>
          <CardBody>
            <form action={inviteBoardMemberWizard as any} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div><Label>Full Name</Label><Input name="full_name" required placeholder="George Park" /></div>
                <div><Label>Email</Label><Input name="email" type="email" required placeholder="george@example.com" /></div>
              </div>
              <div>
                <Label>Association</Label>
                <select name="association_id" required className="h-10 w-full rounded-md border border-ink-200 bg-white px-3 text-sm">
                  <option value="">Select association…</option>
                  {(associations ?? []).map((a: any) => (<option key={a.id} value={a.id}>{a.name}</option>))}
                </select>
              </div>
              <div><Label>Board Role (optional)</Label><Input name="board_role" placeholder="e.g. President, Treasurer" /></div>
              <div className="flex justify-end"><Button type="submit" variant="default">Send invitation</Button></div>
            </form>
          </CardBody>
        </Card>
      )}

      {/* Owner Invite */}
      {activeTab === 'owner' && (
        <Card>
          <CardHeader><CardTitle>Invite Owner</CardTitle></CardHeader>
          <CardBody>
            <form action={inviteOwnerWizard as any} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div><Label>Full Name</Label><Input name="full_name" required placeholder="Alice Walker" /></div>
                <div><Label>Email</Label><Input name="email" type="email" required placeholder="alice@example.com" /></div>
              </div>
              <div>
                <Label>Association</Label>
                <select name="association_id" required className="h-10 w-full rounded-md border border-ink-200 bg-white px-3 text-sm">
                  <option value="">Select association…</option>
                  {(associations ?? []).map((a: any) => (<option key={a.id} value={a.id}>{a.name}</option>))}
                </select>
              </div>
              <div><Label>Unit Number</Label><Input name="unit_number" required placeholder="101" /></div>
              <div className="flex justify-end"><Button type="submit" variant="default">Send invitation</Button></div>
            </form>
          </CardBody>
        </Card>
      )}

      {/* Vendor Invite */}
      {activeTab === 'vendor' && (
        <Card>
          <CardHeader><CardTitle>Invite Vendor</CardTitle></CardHeader>
          <CardBody>
            <form action={inviteVendorWizard as any} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div><Label>Company Name</Label><Input name="name" required placeholder="A&A Services Corp" /></div>
                <div><Label>Contact Email</Label><Input name="email" type="email" required placeholder="contact@aaservices.com" /></div>
              </div>
              <div>
                <Label>Trade</Label>
                <select name="trade" required className="h-10 w-full rounded-md border border-ink-200 bg-white px-3 text-sm">
                  <option value="">Select trade…</option>
                  {['plumbing','electrical','hvac','landscaping','roofing','general_contractor','handyperson','snow_removal','pest_control','other'].map((t) => (
                    <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end"><Button type="submit" variant="default">Send invitation</Button></div>
            </form>
          </CardBody>
        </Card>
      )}

      {/* Pending Invitations */}
      <div className="mt-8">
        <Card>
          <CardHeader><CardTitle>Pending Invitations</CardTitle></CardHeader>
          <CardBody>
            {invitations && invitations.length > 0 ? (
              <Table>
                <THead>
                  <TR>
                    <TH>Email</TH><TH>Name</TH><TH>Role</TH><TH>Association</TH><TH>Sent</TH><TH>Status</TH>
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
                          'bg-cream-100 text-ink-500'
                        }`}>{inv.status ?? 'pending'}</span>
                      </TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            ) : (<p className="py-6 text-center text-sm text-ink-500">No pending invitations.</p>)}
          </CardBody>
        </Card>
      </div>
    </Workspace>
  );
}
