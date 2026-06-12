import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requirePlatformOperator } from '@/lib/auth/me';
import { Database, Shield, Users, Building2, DoorOpen, Wrench, FileText, Mail, Search, ArrowRight, Archive } from 'lucide-react';

export const dynamic = 'force-dynamic';

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ElementType;
}) {
  return (
    <div className="rounded-2xl border border-gray-200/70 bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="truncate text-[11px] font-medium uppercase tracking-[0.08em] text-gray-400">{label}</div>
          <div className="mt-1.5 text-2xl font-semibold tabular-nums text-gray-950">{value}</div>
        </div>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-50 ring-1 ring-inset ring-gray-200/70">
          <Icon className="h-4.5 w-4.5 text-gray-400" />
        </div>
      </div>
    </div>
  );
}

const ADMIN_TOOLS = [
  {
    title: 'Suspend / reactivate a company',
    description: 'Company status changes live on the companies directory, with reasons and audit logging.',
    href: '/platform-operator/companies',
    cta: 'Open companies',
  },
  {
    title: 'Change a user’s role or disable login',
    description: 'Role changes, enable/disable, and per-user management for every profile on the platform.',
    href: '/platform-operator/users',
    cta: 'Open users',
  },
  {
    title: 'Adjust unit limits & plans',
    description: 'Plan tier, monthly price, unit/association/seat limits — per company, audit-logged.',
    href: '/platform-operator/companies',
    cta: 'Pick a company',
  },
  {
    title: 'Resend or regenerate invitations',
    description: 'Pending invitations with resend, cancel, and new-link quick actions.',
    href: '/platform-operator/invitations',
    cta: 'Open invitations',
  },
  {
    title: 'Password management',
    description: 'Send reset emails, force reset on next login, unlock accounts, disable logins — on each company’s detail page.',
    href: '/platform-operator/companies',
    cta: 'Pick a company',
  },
  {
    title: 'Audit trail',
    description: 'Every platform action — who, what, when, and the affected company.',
    href: '/platform-operator/audit-logs',
    cta: 'Open audit logs',
  },
];

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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gray-50 ring-1 ring-inset ring-gray-200/70">
          <Shield className="h-5 w-5 text-gray-400" />
        </div>
        <div>
          <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950 sm:text-[26px]">Platform Admin</h1>
          <p className="mt-1 text-sm leading-6 text-gray-500">Database record counts and shortcuts to every administrative tool</p>
        </div>
      </div>

      {/* Record Counts */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Companies" value={counts[0].count ?? 0} icon={Building2} />
        <StatCard label="Users" value={counts[1].count ?? 0} icon={Users} />
        <StatCard label="Associations" value={counts[2].count ?? 0} icon={DoorOpen} />
        <StatCard label="Units" value={counts[3].count ?? 0} icon={Database} />
        <StatCard label="Active Work Orders" value={counts[4].count ?? 0} icon={Wrench} />
        <StatCard label="Billing Records" value={counts[5].count ?? 0} icon={FileText} />
        <StatCard label="Invitations" value={counts[6].count ?? 0} icon={Mail} />
        <StatCard label="Audit Logs" value={counts[7].count ?? 0} icon={Search} />
      </div>

      {/* Admin tool shortcuts */}
      <div className="rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-950">Administrative Tools</h2>
          <p className="mt-0.5 text-xs text-gray-500">Every action below is confirmed, role-restricted, and written to the audit log.</p>
        </div>
        <div className="grid grid-cols-1 gap-1 p-4 md:grid-cols-2">
          {ADMIN_TOOLS.map((tool) => (
            <Link
              key={tool.title}
              href={tool.href}
              className="group flex items-start justify-between gap-3 rounded-xl p-4 transition-colors hover:bg-gray-50/60"
            >
              <div>
                <div className="text-sm font-medium text-gray-900 group-hover:text-gray-950">{tool.title}</div>
                <p className="mt-1 text-xs leading-5 text-gray-500">{tool.description}</p>
                <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-gray-500 group-hover:text-gray-950">
                  {tool.cta} <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Data retention note */}
      <div className="flex items-start gap-3 rounded-2xl border border-gray-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <Archive className="mt-0.5 h-5 w-5 shrink-0 text-gray-400" />
        <div>
          <h2 className="text-sm font-semibold text-gray-950">Deletes are soft, by policy</h2>
          <p className="mt-1 text-sm leading-6 text-gray-500">
            Customer data is never permanently destroyed from this console. Archiving a company disables its logins while
            preserving association data, billing records, and audit logs. Hard deletion requires a direct database operation
            by the platform team.
          </p>
        </div>
      </div>
    </div>
  );
}
