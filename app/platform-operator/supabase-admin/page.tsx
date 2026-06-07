import { createClient } from '@/lib/supabase/server';
import { requirePlatformOperator } from '@/lib/auth/me';
import { Database, Shield, Users, Building2, DoorOpen, Wrench, FileText, Mail, Search, AlertTriangle } from 'lucide-react';

export const dynamic = 'force-dynamic';

function StatCard({
  label,
  value,
  icon: Icon,
  accent = 'navy',
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ElementType;
  accent?: 'navy' | 'emerald' | 'amber' | 'red' | 'violet';
}) {
  const accents: Record<string, string> = {
    navy: 'bg-[#1E3A5F]/10 text-[#1E3A5F] border-[#1E3A5F]/20',
    emerald: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    amber: 'bg-amber-100 text-amber-700 border-amber-200',
    red: 'bg-red-100 text-red-700 border-red-200',
    violet: 'bg-violet-100 text-violet-700 border-violet-200',
  };
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="text-xs font-medium uppercase tracking-wider text-gray-500">{label}</div>
          <div className="mt-2 text-2xl font-bold tabular-nums text-gray-900">{value}</div>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg border ${accents[accent]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

export default async function SupabaseAdminPage() {
  await requirePlatformOperator();
  const supabase = await createClient();
  const db = supabase as any;

  // Record counts
  const counts = await Promise.all([
    db.from('portfolios').select('id', { count: 'exact', head: true }),
    db.from('profiles').select('id', { count: 'exact', head: true }),
    db.from('associations').select('id', { count: 'exact', head: true }).is('archived_at', null),
    db.from('units').select('id', { count: 'exact', head: true }),
    db.from('work_orders').select('id', { count: 'exact', head: true }).is('archived_at', null).not('status', 'in', '("completed","closed","cancelled")'),
    db.from('invoices').select('id', { count: 'exact', head: true }),
    db.from('user_invitations').select('id', { count: 'exact', head: true }),
    db.from('audit_logs').select('id', { count: 'exact', head: true }),
  ]);

  // Load portfolios and users for selection
  const [{ data: portfolios }, { data: profiles }, { data: invitations }] = await Promise.all([
    db.from('portfolios').select('id, company_name, tier, suspended_at').order('company_name'),
    db.from('profiles').select('id, full_name, email, hoa_role').order('full_name').limit(100),
    db.from('user_invitations').select('id, email, full_name, status').order('created_at', { ascending: false }).limit(50),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="h-8 w-8 text-[#1E3A5F]" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Supabase Admin</h1>
          <p className="mt-1 text-sm text-gray-500">Safe admin tools — use with caution</p>
        </div>
      </div>

      {/* Record Counts */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Companies" value={counts[0].count ?? 0} icon={Building2} accent="navy" />
        <StatCard label="Users" value={counts[1].count ?? 0} icon={Users} accent="navy" />
        <StatCard label="Associations" value={counts[2].count ?? 0} icon={DoorOpen} accent="emerald" />
        <StatCard label="Units" value={counts[3].count ?? 0} icon={Database} accent="violet" />
        <StatCard label="Active Work Orders" value={counts[4].count ?? 0} icon={Wrench} accent="amber" />
        <StatCard label="Billing Records" value={counts[5].count ?? 0} icon={FileText} accent="emerald" />
        <StatCard label="Invitations" value={counts[6].count ?? 0} icon={Mail} accent="navy" />
        <StatCard label="Audit Logs" value={counts[7].count ?? 0} icon={Search} accent="navy" />
      </div>

      {/* Safe Admin Actions */}
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-900">Safe Actions</h2>
          <p className="mt-0.5 text-xs text-gray-500">Each action requires explicit confirmation</p>
        </div>
        <div className="p-5 space-y-4">
          {/* Change Company Status */}
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-medium text-gray-900">Change Company Status</h3>
                <p className="mt-0.5 text-xs text-gray-500">Suspend or reactivate a company portfolio</p>
              </div>
              <div className="flex items-center gap-2">
                <select className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 bg-white">
                  <option value="">Select company...</option>
                  {(portfolios ?? []).map((p: any) => (
                    <option key={p.id} value={p.id}>{p.company_name} {p.suspended_at ? '(suspended)' : ''}</option>
                  ))}
                </select>
                <select className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 bg-white">
                  <option value="">New status...</option>
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                </select>
                <button className="rounded-lg bg-[#1E3A5F] px-3 py-1.5 text-sm text-white hover:bg-[#1E3A5F]/90">Apply</button>
              </div>
            </div>
          </div>

          {/* Change User Role */}
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-medium text-gray-900">Change User Role</h3>
                <p className="mt-0.5 text-xs text-gray-500">Modify a user&apos;s platform role</p>
              </div>
              <div className="flex items-center gap-2">
                <select className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 bg-white max-w-[200px]">
                  <option value="">Select user...</option>
                  {(profiles ?? []).slice(0, 30).map((p: any) => (
                    <option key={p.id} value={p.id}>{p.full_name ?? p.email} ({p.hoa_role ?? 'no role'})</option>
                  ))}
                </select>
                <select className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 bg-white">
                  <option value="">New role...</option>
                  <option value="platform_operator">Platform Operator</option>
                  <option value="company_admin">Company Admin</option>
                  <option value="manager">Manager</option>
                  <option value="board_member">Board Member</option>
                </select>
                <button className="rounded-lg bg-[#1E3A5F] px-3 py-1.5 text-sm text-white hover:bg-[#1E3A5F]/90">Apply</button>
              </div>
            </div>
          </div>

          {/* Correct Door Counts */}
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-medium text-gray-900">Correct Door Counts</h3>
                <p className="mt-0.5 text-xs text-gray-500">Override door count for a company</p>
              </div>
              <div className="flex items-center gap-2">
                <select className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 bg-white">
                  <option value="">Select company...</option>
                  {(portfolios ?? []).map((p: any) => (
                    <option key={p.id} value={p.id}>{p.company_name}</option>
                  ))}
                </select>
                <input type="number" placeholder="New count" className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 w-28" />
                <button className="rounded-lg bg-[#1E3A5F] px-3 py-1.5 text-sm text-white hover:bg-[#1E3A5F]/90">Update</button>
              </div>
            </div>
          </div>

          {/* Re-send Invitation */}
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-medium text-gray-900">Re-send Invitation</h3>
                <p className="mt-0.5 text-xs text-gray-500">Resend a pending invitation email</p>
              </div>
              <div className="flex items-center gap-2">
                <select className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 bg-white max-w-[250px]">
                  <option value="">Select invitation...</option>
                  {(invitations ?? []).filter((i: any) => i.status === 'pending').map((i: any) => (
                    <option key={i.id} value={i.id}>{i.email} — {i.full_name ?? 'Unknown'}</option>
                  ))}
                </select>
                <button className="rounded-lg bg-[#1E3A5F] px-3 py-1.5 text-sm text-white hover:bg-[#1E3A5F]/90">Re-send</button>
              </div>
            </div>
          </div>

          {/* Force Password Reset */}
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-medium text-gray-900">Force Password Reset</h3>
                <p className="mt-0.5 text-xs text-gray-500">Trigger a password reset for a user</p>
              </div>
              <div className="flex items-center gap-2">
                <select className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 bg-white max-w-[200px]">
                  <option value="">Select user...</option>
                  {(profiles ?? []).slice(0, 30).map((p: any) => (
                    <option key={p.id} value={p.id}>{p.full_name ?? p.email}</option>
                  ))}
                </select>
                <button className="rounded-lg bg-[#1E3A5F] px-3 py-1.5 text-sm text-white hover:bg-[#1E3A5F]/90">Reset</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="rounded-xl border-2 border-red-300 bg-white">
        <div className="border-b border-red-200 px-5 py-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <h2 className="text-sm font-semibold text-red-700">Danger Zone</h2>
          </div>
          <p className="mt-0.5 text-xs text-red-500">Destructive actions — require double confirmation</p>
        </div>
        <div className="p-5 space-y-4">
          {/* Hard Delete Company */}
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-medium text-red-800">Hard Delete Company</h3>
                <p className="mt-0.5 text-xs text-red-600">Permanently remove all company data. This cannot be undone.</p>
              </div>
              <div className="flex items-center gap-2">
                <select className="rounded-lg border border-red-300 px-3 py-1.5 text-sm text-gray-700 bg-white">
                  <option value="">Select company...</option>
                  {(portfolios ?? []).map((p: any) => (
                    <option key={p.id} value={p.id}>{p.company_name}</option>
                  ))}
                </select>
                <button
                  className="rounded-lg bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700"
                  onClick={(e) => {
                    if (!confirm('Are you sure? This will permanently delete the company and ALL associated data.')) {
                      e.preventDefault();
                    }
                    if (!confirm('FINAL WARNING: This action is irreversible. Proceed?')) {
                      e.preventDefault();
                    }
                  }}
                >
                  Delete Company
                </button>
              </div>
            </div>
          </div>

          {/* Hard Delete User */}
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-medium text-red-800">Hard Delete User</h3>
                <p className="mt-0.5 text-xs text-red-600">Permanently remove user account. This cannot be undone.</p>
              </div>
              <div className="flex items-center gap-2">
                <select className="rounded-lg border border-red-300 px-3 py-1.5 text-sm text-gray-700 bg-white max-w-[200px]">
                  <option value="">Select user...</option>
                  {(profiles ?? []).slice(0, 30).map((p: any) => (
                    <option key={p.id} value={p.id}>{p.full_name ?? p.email}</option>
                  ))}
                </select>
                <button
                  className="rounded-lg bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700"
                  onClick={(e) => {
                    if (!confirm('Are you sure? This will permanently delete the user and ALL associated data.')) {
                      e.preventDefault();
                    }
                    if (!confirm('FINAL WARNING: This action is irreversible. Proceed?')) {
                      e.preventDefault();
                    }
                  }}
                >
                  Delete User
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
