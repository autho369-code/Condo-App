import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireCompanyAdmin } from '@/lib/auth/me';
import { Button } from '@/components/ui/button';
import { money } from '@/lib/utils';
import {
  CreditCard,
  DoorOpen,
  Receipt,
  AlertTriangle,
  Shield,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Calendar,
  CircleDollarSign,
  BadgeCheck,
  Clock,
  Users,
} from 'lucide-react';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function fmtCents(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return '—';
  return money(cents / 100);
}

function fmtDate(ts: string | null | undefined): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/* -------------------------------------------------------------------------- */
/*  Components                                                                */
/* -------------------------------------------------------------------------- */

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent = 'emerald',
  delta,
  href,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: 'emerald' | 'blue' | 'amber' | 'red' | 'purple' | 'slate';
  delta?: { value: string; up: boolean };
  href?: string;
}) {
  const gradient: Record<string, string> = {
    emerald: 'from-emerald-500/15 to-emerald-500/5 border-emerald-500/20',
    blue: 'from-blue-500/15 to-blue-500/5 border-blue-500/20',
    amber: 'from-amber-500/15 to-amber-500/5 border-amber-500/20',
    red: 'from-red-500/15 to-red-500/5 border-red-500/20',
    purple: 'from-purple-500/15 to-purple-500/5 border-purple-500/20',
    slate: 'from-slate-600/15 to-slate-600/5 border-slate-700/30',
  };
  const iconBg: Record<string, string> = {
    emerald: 'bg-emerald-400/10 text-emerald-400',
    blue: 'bg-blue-400/10 text-blue-400',
    amber: 'bg-amber-400/10 text-amber-400',
    red: 'bg-red-400/10 text-red-400',
    purple: 'bg-purple-400/10 text-purple-400',
    slate: 'bg-slate-400/10 text-slate-400',
  };

  const card = (
    <div
      className={`relative overflow-hidden rounded-xl border bg-gradient-to-br ${gradient[accent]} p-5 transition hover:bg-white/[0.03] ${
        href ? 'cursor-pointer' : ''
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1.5">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</p>
          <p className="text-2xl font-bold tracking-tight text-white tabular-nums">{value}</p>
          {sub && <p className="text-xs text-slate-500">{sub}</p>}
          {delta && (
            <div className="flex items-center gap-1">
              {delta.up ? (
                <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5 text-red-400" />
              )}
              <span
                className={`text-xs font-medium ${delta.up ? 'text-emerald-400' : 'text-red-400'}`}
              >
                {delta.value}
              </span>
            </div>
          )}
        </div>
        <div className={`rounded-lg p-2 ${iconBg[accent]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );

  if (href) return <Link href={href}>{card}</Link>;
  return card;
}

function Badge({
  children,
  variant = 'default',
}: {
  children: React.ReactNode;
  variant?: 'emerald' | 'amber' | 'red' | 'slate' | 'blue' | 'default';
}) {
  const colors: Record<string, string> = {
    emerald: 'bg-emerald-400/10 text-emerald-400 border-emerald-500/20',
    amber: 'bg-amber-400/10 text-amber-400 border-amber-500/20',
    red: 'bg-red-400/10 text-red-400 border-red-500/20',
    slate: 'bg-slate-400/10 text-slate-400 border-slate-600/30',
    blue: 'bg-blue-400/10 text-blue-400 border-blue-500/20',
    default: 'bg-slate-400/10 text-slate-400 border-slate-600/30',
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${colors[variant]}`}
    >
      {children}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                      */
/* -------------------------------------------------------------------------- */

export default async function BillingPage() {
  const me = await requireCompanyAdmin();
  const supabase = await createClient();
  const db = supabase as any;
  const portfolioId = me.portfolio?.id;

  if (!portfolioId) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Shield className="h-12 w-12 text-slate-600 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-white">No company assigned</h2>
          <p className="text-sm text-slate-400 mt-1">
            Contact the platform operator to set up your company.
          </p>
        </div>
      </div>
    );
  }

  const [{ data: subscription }, { data: associations }] = await Promise.all([
    supabase
      .from('subscriptions')
      .select(
        'id, tier, status, units_limit, price_monthly_cents, price_per_seat_cents, trial_ends_at, current_period_start, current_period_end, canceled_at, cancel_at_period_end, associations_limit, seats_included, seats_used, billing_email',
      )
      .eq('portfolio_id', portfolioId)
      .maybeSingle(),
    supabase
      .from('associations')
      .select('id, unit_count')
      .eq('portfolio_id', portfolioId)
      .is('archived_at', null),
  ]);

  const sub = subscription;
  const activeDoors = (associations ?? []).reduce(
    (sum, a) => sum + (a.unit_count ?? 0),
    0,
  );
  const doorLimit = sub?.units_limit ?? 0;
  const additionalDoors = Math.max(0, activeDoors - (doorLimit || 0));
  const pricePerAdditional = sub?.price_per_seat_cents;
  const monthlyCharge = sub?.price_monthly_cents ?? 0;

  const planStatus = sub?.status ?? 'inactive';
  const statusVariant =
    planStatus === 'active'
      ? 'emerald'
      : planStatus === 'past_due'
        ? 'red'
        : planStatus === 'trialing'
          ? 'blue'
          : 'amber';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
          Company Admin
        </p>
        <h1 className="mt-1 text-xl font-bold text-white">Billing &amp; Door Usage</h1>
        <p className="mt-1 text-sm text-slate-400">
          Manage your subscription, door capacity, and payment history
        </p>
      </div>

      {/* Note banner */}
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 flex items-center gap-3">
        <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0" />
        <p className="text-sm text-amber-300">
          Billing changes must be requested through Platform Requests
        </p>
      </div>

      {/* Stat cards row 1 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard
          label="Current Plan"
          value={sub?.tier ?? '—'}
          sub={
            <span className="inline-flex items-center gap-1">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  planStatus === 'active'
                    ? 'bg-emerald-400'
                    : planStatus === 'past_due'
                      ? 'bg-red-400'
                      : 'bg-amber-400'
                }`}
              />
              {planStatus}
            </span> as any
          }
          icon={BadgeCheck}
          accent="emerald"
        />
        <StatCard
          label="Active Doors"
          value={activeDoors}
          sub={`of ${doorLimit || '—'} limit`}
          icon={DoorOpen}
          accent={additionalDoors > 0 ? 'amber' : 'blue'}
        />
        <StatCard
          label="Monthly Charge"
          value={fmtCents(monthlyCharge)}
          icon={CircleDollarSign}
          accent="emerald"
        />
        <StatCard
          label="Additional Doors"
          value={additionalDoors}
          sub={
            additionalDoors > 0
              ? `+${fmtCents(pricePerAdditional ? pricePerAdditional * additionalDoors : 0)}/mo`
              : 'within limit'
          }
          icon={Users}
          accent={additionalDoors > 0 ? 'red' : 'slate'}
        />
        <StatCard
          label="Next Invoice"
          value={fmtDate(sub?.current_period_end)}
          sub={sub?.current_period_end ? 'projected' : undefined}
          icon={Calendar}
          accent="slate"
        />
      </div>

      {/* Plan details + Door usage */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Plan details card */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02]">
          <div className="flex items-center gap-2 border-b border-white/[0.04] px-5 py-3">
            <CreditCard className="h-4 w-4 text-emerald-400" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Plan Details
            </h3>
          </div>
          <div className="divide-y divide-white/[0.04]">
            <div className="flex items-center justify-between px-5 py-3">
              <span className="text-sm text-slate-400">Tier</span>
              <span className="text-sm font-semibold text-white">{sub?.tier ?? '—'}</span>
            </div>
            <div className="flex items-center justify-between px-5 py-3">
              <span className="text-sm text-slate-400">Status</span>
              <Badge variant={statusVariant}>{planStatus}</Badge>
            </div>
            <div className="flex items-center justify-between px-5 py-3">
              <span className="text-sm text-slate-400">Door Limit</span>
              <span className="text-sm font-semibold tabular-nums text-white">
                {doorLimit || '—'}
              </span>
            </div>
            <div className="flex items-center justify-between px-5 py-3">
              <span className="text-sm text-slate-400">Associations Limit</span>
              <span className="text-sm font-semibold tabular-nums text-white">
                {sub?.associations_limit ?? '—'}
              </span>
            </div>
            <div className="flex items-center justify-between px-5 py-3">
              <span className="text-sm text-slate-400">Seats Used / Included</span>
              <span className="text-sm font-semibold tabular-nums text-white">
                {sub?.seats_used ?? 0} / {sub?.seats_included ?? '—'}
              </span>
            </div>
            <div className="flex items-center justify-between px-5 py-3">
              <span className="text-sm text-slate-400">Price per Additional Door</span>
              <span className="text-sm font-semibold tabular-nums text-white">
                {pricePerAdditional ? fmtCents(pricePerAdditional) : 'N/A'}
              </span>
            </div>
            <div className="flex items-center justify-between px-5 py-3">
              <span className="text-sm text-slate-400">Monthly Base Charge</span>
              <span className="text-sm font-semibold tabular-nums text-white">
                {fmtCents(monthlyCharge)}
              </span>
            </div>
            <div className="flex items-center justify-between px-5 py-3">
              <span className="text-sm text-slate-400">Billing Period</span>
              <span className="text-sm tabular-nums text-white">
                {sub?.current_period_start && sub?.current_period_end
                  ? `${fmtDate(sub.current_period_start)} – ${fmtDate(sub.current_period_end)}`
                  : '—'}
              </span>
            </div>
            {sub?.trial_ends_at && (
              <div className="flex items-center justify-between px-5 py-3">
                <span className="text-sm text-slate-400">Trial Ends</span>
                <span className="text-sm tabular-nums text-amber-300">
                  {fmtDate(sub.trial_ends_at)}
                </span>
              </div>
            )}
            {sub?.canceled_at && (
              <div className="flex items-center justify-between px-5 py-3">
                <span className="text-sm text-slate-400">Canceled</span>
                <span className="text-sm tabular-nums text-red-400">
                  {fmtDate(sub.canceled_at)}
                </span>
              </div>
            )}
            {sub?.cancel_at_period_end && (
              <div className="flex items-center justify-between px-5 py-3">
                <span className="text-sm text-slate-400">Cancel at Period End</span>
                <Badge variant="amber">Scheduled</Badge>
              </div>
            )}
            {sub?.billing_email && (
              <div className="flex items-center justify-between px-5 py-3">
                <span className="text-sm text-slate-400">Billing Email</span>
                <span className="text-sm tabular-nums text-white">{sub.billing_email}</span>
              </div>
            )}
          </div>
        </div>

        {/* Door usage card */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02]">
          <div className="flex items-center gap-2 border-b border-white/[0.04] px-5 py-3">
            <DoorOpen className="h-4 w-4 text-blue-400" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Door Usage
            </h3>
          </div>
          <div className="p-5 space-y-4">
            {/* Usage bar */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-400">Used vs Limit</span>
                <span className="text-sm font-semibold tabular-nums text-white">
                  {activeDoors} / {doorLimit || '—'}
                </span>
              </div>
              <div className="h-3 w-full rounded-full bg-slate-800 overflow-hidden">
                {doorLimit > 0 ? (
                  <div
                    className={`h-full rounded-full transition-all ${
                      additionalDoors > 0
                        ? 'bg-red-500'
                        : activeDoors / doorLimit > 0.8
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                    }`}
                    style={{
                      width: `${Math.min(100, (activeDoors / doorLimit) * 100)}%`,
                    }}
                  />
                ) : (
                  <div className="h-full w-full rounded-full bg-slate-700" />
                )}
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-slate-500">
                  {additionalDoors > 0
                    ? `${additionalDoors} over limit`
                    : `${doorLimit - activeDoors} doors remaining`}
                </span>
                <span className="text-xs text-slate-500">
                  {doorLimit > 0
                    ? `${Math.round((activeDoors / doorLimit) * 100)}% utilized`
                    : 'no limit'}
                </span>
              </div>
            </div>

            {/* Association breakdown */}
            <div className="border-t border-white/[0.04] pt-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
                By Association
              </h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {(associations ?? []).length === 0 ? (
                  <p className="text-sm text-slate-500">No associations found</p>
                ) : (
                  (associations ?? []).map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-slate-400 truncate mr-4">{a.id}</span>
                      <span className="font-semibold tabular-nums text-white">
                        {a.unit_count ?? 0}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Invoice History */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02]">
        <div className="flex items-center gap-2 border-b border-white/[0.04] px-5 py-3">
          <Receipt className="h-4 w-4 text-slate-400" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Invoice History
          </h3>
        </div>
        <div className="px-5 py-8 text-center">
          <Receipt className="h-8 w-8 text-slate-600 mx-auto mb-3" />
          <p className="text-sm text-slate-400">No invoice history available</p>
          <p className="text-xs text-slate-500 mt-1">
            Invoices will appear here once payment processing is configured
          </p>
        </div>
      </div>

      {/* Failed Payments + Payment Method */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Failed Payments */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02]">
          <div className="flex items-center gap-2 border-b border-white/[0.04] px-5 py-3">
            <AlertTriangle className="h-4 w-4 text-red-400" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Failed Payments
            </h3>
          </div>
          <div className="px-5 py-6 text-center">
            <AlertTriangle className="h-8 w-8 text-slate-600 mx-auto mb-3" />
            <p className="text-sm text-slate-400">No failed payments</p>
            <p className="text-xs text-slate-500 mt-1">
              Failed payment records will appear here
            </p>
          </div>
        </div>

        {/* Payment Method */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02]">
          <div className="flex items-center gap-2 border-b border-white/[0.04] px-5 py-3">
            <CreditCard className="h-4 w-4 text-emerald-400" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Payment Method Status
            </h3>
          </div>
          <div className="px-5 py-6 text-center">
            <CreditCard className="h-8 w-8 text-slate-600 mx-auto mb-3" />
            <p className="text-sm text-slate-400">No payment method on file</p>
            <p className="text-xs text-slate-500 mt-1">
              {(sub as any)?.stripe_customer_id
                ? 'Stripe customer connected'
                : 'Not yet configured'}
            </p>
            {(sub as any)?.stripe_customer_id && (
              <p className="text-xs text-slate-600 mt-1 font-mono">
                {(sub as any).stripe_customer_id}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-4">
        <div className="flex items-center gap-2 mb-3">
          <ArrowRight className="h-4 w-4 text-emerald-400" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Billing Actions
          </h3>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/company-admin/platform-requests">
            <Button
              variant="secondary"
              size="sm"
              className="gap-2 border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              <DoorOpen className="h-4 w-4" />
              Request More Doors
            </Button>
          </Link>
          <Link href="/company-admin/platform-requests">
            <Button
              variant="secondary"
              size="sm"
              className="gap-2 border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              <TrendingUp className="h-4 w-4" />
              Upgrade Plan
            </Button>
          </Link>
          <Link href="/company-admin/platform-requests">
            <Button
              variant="secondary"
              size="sm"
              className="gap-2 border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              <TrendingDown className="h-4 w-4" />
              Downgrade Plan
            </Button>
          </Link>
          <Link href="/company-admin/platform-requests">
            <Button
              variant="secondary"
              size="sm"
              className="gap-2 border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              <Receipt className="h-4 w-4" />
              Billing Review
            </Button>
          </Link>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          All billing changes must be submitted through Platform Requests for review.
        </p>
      </div>
    </div>
  );
}
