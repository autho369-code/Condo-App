import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requirePlatformOperator } from '@/lib/auth/me';
import { money } from '@/lib/utils';
import {
  Building2,
  DoorOpen,
  Users,
  DollarSign,
  Heart,
  Mail,
  Headphones,
  CreditCard,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon: React.ElementType;
}) {
  return (
    <div className="rounded-2xl border border-gray-200/70 bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="truncate text-[11px] font-medium uppercase tracking-[0.08em] text-gray-400">{label}</div>
          <div className="mt-1.5 text-2xl font-semibold tabular-nums text-gray-950">{value}</div>
          {sub && <div className="mt-1 text-xs text-gray-500">{sub}</div>}
        </div>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-50 ring-1 ring-inset ring-gray-200/70">
          <Icon className="h-4.5 w-4.5 text-gray-400" />
        </div>
      </div>
    </div>
  );
}

export default async function PlatformOperatorOverview() {
  await requirePlatformOperator();
  const supabase = await createClient();
  const db = supabase as any;

  // Quick counts
  const [portfolios, profiles, associations, activeSubsRes, openInvoicesRes] = await Promise.all([
    db.from('portfolios').select('id', { count: 'exact', head: true }),
    db.from('profiles').select('id', { count: 'exact', head: true }),
    db.from('associations').select('id', { count: 'exact', head: true }).is('archived_at', null),
    db.from('subscriptions').select('price_monthly_cents').in('status', ['active', 'trialing']),
    db.from('invoices').select('id', { count: 'exact', head: true }).eq('status', 'past_due'),
  ]);

  const mrr = (activeSubsRes.data ?? []).reduce((sum: number, s: any) => sum + (s.price_monthly_cents ?? 0), 0) / 100;

  const quickLinks = [
    { label: 'Billing', href: '/platform-operator/billing', description: 'Invoices, subscriptions, payments', icon: CreditCard },
    { label: 'Door Usage', href: '/platform-operator/door-usage', description: 'Monitor door limits and overages', icon: DoorOpen },
    { label: 'Revenue', href: '/platform-operator/revenue', description: 'MRR, ARR, revenue analytics', icon: DollarSign },
    { label: 'Assoc. Health', href: '/platform-operator/association-health', description: 'Health scores and issues', icon: Heart },
    { label: 'Communications', href: '/platform-operator/communications', description: 'Email/SMS volume and delivery', icon: Mail },
    { label: 'Support Requests', href: '/platform-operator/support', description: 'Manage platform requests', icon: Headphones },
    { label: 'Supabase Admin', href: '/platform-operator/supabase-admin', description: 'Safe admin tools', icon: TrendingUp },
    { label: 'Audit Logs', href: '/platform-operator/audit-logs', description: 'Platform audit trail', icon: AlertTriangle },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950 sm:text-[26px]">Platform Operator</h1>
        <p className="mt-1.5 text-sm leading-6 text-gray-500">Platform-wide administration and monitoring dashboard</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Companies" value={portfolios.count ?? 0} icon={Building2} />
        <StatCard label="Users" value={profiles.count ?? 0} icon={Users} />
        <StatCard label="Associations" value={associations.count ?? 0} icon={DoorOpen} />
        <StatCard label="MRR" value={money(mrr)} icon={DollarSign} />
        <StatCard label="Past Due Invoices" value={openInvoicesRes.count ?? 0} icon={AlertTriangle} />
      </div>

      {/* Quick Links */}
      <div className="rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-950">Quick Navigation</h2>
        </div>
        <div className="grid grid-cols-1 gap-1 p-4 sm:grid-cols-2 lg:grid-cols-4">
          {quickLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="group flex items-start gap-3 rounded-xl p-3 transition-colors hover:bg-gray-50/60"
            >
              <link.icon className="mt-0.5 h-5 w-5 text-gray-400 group-hover:text-gray-950" />
              <div>
                <div className="text-sm font-medium text-gray-900 group-hover:text-gray-950">{link.label}</div>
                <div className="text-xs text-gray-500">{link.description}</div>
              </div>
              <ArrowRight className="ml-auto mt-0.5 h-4 w-4 text-gray-300 group-hover:text-gray-950" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
