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
  accent = 'navy',
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
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
          {sub && <div className="mt-1 text-xs text-gray-500">{sub}</div>}
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg border ${accents[accent]}`}>
          <Icon className="h-5 w-5" />
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
        <h1 className="text-2xl font-bold text-gray-900">Platform Operator</h1>
        <p className="mt-1 text-sm text-gray-500">Platform-wide administration and monitoring dashboard</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Companies" value={portfolios.count ?? 0} icon={Building2} accent="navy" />
        <StatCard label="Users" value={profiles.count ?? 0} icon={Users} accent="navy" />
        <StatCard label="Associations" value={associations.count ?? 0} icon={DoorOpen} accent="emerald" />
        <StatCard label="MRR" value={money(mrr)} icon={DollarSign} accent="emerald" />
        <StatCard label="Past Due Invoices" value={openInvoicesRes.count ?? 0} icon={AlertTriangle} accent="red" />
      </div>

      {/* Quick Links */}
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-900">Quick Navigation</h2>
        </div>
        <div className="grid grid-cols-1 gap-1 p-4 sm:grid-cols-2 lg:grid-cols-4">
          {quickLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-start gap-3 rounded-lg p-3 hover:bg-gray-50 transition-colors group"
            >
              <link.icon className="h-5 w-5 text-gray-400 group-hover:text-[#1E3A5F] mt-0.5" />
              <div>
                <div className="text-sm font-medium text-gray-900 group-hover:text-[#1E3A5F]">{link.label}</div>
                <div className="text-xs text-gray-500">{link.description}</div>
              </div>
              <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-[#1E3A5F] ml-auto mt-0.5" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
