import { revalidatePath } from 'next/cache';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requirePlatformOperator } from '@/lib/auth/me';
import { WorkspaceHeader } from '@/components/workspace/shell';
import {
  Shield,
  Building2,
  AlertTriangle,
  CheckCircle2,
  PauseCircle,
  PlayCircle,
  Key,
  CreditCard,
  StickyNote,
  Star,
  ShieldAlert,
  Search,
  RefreshCw,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

/* -------------------------------------------------------------------------- */
/*  Server Actions                                                            */
/* -------------------------------------------------------------------------- */

async function suspendCompany(formData: FormData) {
  'use server';
  const portfolioId = formData.get('portfolio_id') as string;
  const reason = (formData.get('reason') as string) || 'Manual suspension by platform operator';
  if (!portfolioId) return;

  const supabase = await createClient();
  await (supabase as any)
    .from('portfolios')
    .update({
      suspended_at: new Date().toISOString(),
      suspension_reason: reason,
    })
    .eq('id', portfolioId);

  revalidatePath('/platform/controls');
}

async function reactivateCompany(formData: FormData) {
  'use server';
  const portfolioId = formData.get('portfolio_id') as string;
  if (!portfolioId) return;

  const supabase = await createClient();
  await (supabase as any)
    .from('portfolios')
    .update({
      suspended_at: null,
      suspension_reason: null,
    })
    .eq('id', portfolioId);

  revalidatePath('/platform/controls');
}

async function forcePasswordReset(formData: FormData) {
  'use server';
  const email = formData.get('email') as string;
  if (!email) return;

  const serviceClient = await createServiceClient();
  const { error } = await serviceClient.auth.admin.generateLink({
    type: 'recovery',
    email,
  });
  if (error) {
    console.error('Failed to send password reset:', error.message);
  }

  revalidatePath('/platform/controls');
}

async function changeBillingTier(formData: FormData) {
  'use server';
  const portfolioId = formData.get('portfolio_id') as string;
  const tier = formData.get('tier') as string;
  if (!portfolioId || !tier) return;

  const supabase = await createClient();
  // Update tier on portfolio and latest subscription
  await (supabase as any)
    .from('portfolios')
    .update({ tier })
    .eq('id', portfolioId);

  revalidatePath('/platform/controls');
}

async function addInternalNote(formData: FormData) {
  'use server';
  const portfolioId = formData.get('portfolio_id') as string;
  const noteText = formData.get('note') as string;
  if (!portfolioId || !noteText?.trim()) return;

  const supabase = await createClient();
  // Use superadmin_notes if it exists; fallback gracefully
  const { error } = await (supabase as any)
    .from('superadmin_notes')
    .insert({
      portfolio_id: portfolioId,
      note: noteText.trim(),
      created_by: 'platform_operator',
    });

  if (error) {
    // If superadmin_notes table doesn't exist, log to activity as fallback
    console.warn('superadmin_notes table may not exist:', error.message);
    try {
      await (supabase as any).from('activity').insert({
        action: 'internal_note',
        agent: 'Platform Operator',
        details: `[${portfolioId}] ${noteText.trim()}`,
        user_id: null,
      });
    } catch {
      // silent fallback
    }
  }

  revalidatePath('/platform/controls');
}

async function toggleVip(formData: FormData) {
  'use server';
  const portfolioId = formData.get('portfolio_id') as string;
  const isVip = formData.get('is_vip') === '1';
  if (!portfolioId) return;

  const supabase = await createClient();
  await (supabase as any)
    .from('portfolios')
    .update({
      tier: isVip ? 'vip' : 'starter',
    })
    .eq('id', portfolioId);

  revalidatePath('/platform/controls');
}

async function toggleHighRisk(formData: FormData) {
  'use server';
  const portfolioId = formData.get('portfolio_id') as string;
  const isHighRisk = formData.get('is_high_risk') === '1';
  if (!portfolioId) return;

  const supabase = await createClient();
  // Store high-risk flag via suspension_reason field as a marker
  // (using existing fields since we don't have a dedicated high_risk column)
  if (isHighRisk) {
    await (supabase as any)
      .from('portfolios')
      .update({ suspension_reason: 'HIGH_RISK_FLAG' })
      .eq('id', portfolioId);
  } else {
    // Only clear if it was our flag
    const { data: portfolio } = await (supabase as any)
      .from('portfolios')
      .select('suspension_reason')
      .eq('id', portfolioId)
      .single();
    if (portfolio?.suspension_reason === 'HIGH_RISK_FLAG') {
      await (supabase as any)
        .from('portfolios')
        .update({ suspension_reason: null })
        .eq('id', portfolioId);
    }
  }

  revalidatePath('/platform/controls');
}

/* -------------------------------------------------------------------------- */
/*  Types & Helpers                                                           */
/* -------------------------------------------------------------------------- */

type PortfolioRow = {
  id: string;
  company_name: string;
  tier: string;
  suspended_at: string | null;
  suspension_reason: string | null;
  created_at: string;
};

const BILLING_TIERS = ['starter', 'pro', 'enterprise', 'vip'] as const;

function statusLabel(portfolio: PortfolioRow): { label: string; color: string; bg: string } {
  if (portfolio.suspended_at) {
    return { label: 'Suspended', color: 'text-rose-400', bg: 'bg-rose-400/10' };
  }
  if (portfolio.tier === 'vip') {
    return { label: 'VIP', color: 'text-amber-400', bg: 'bg-amber-400/10' };
  }
  if (portfolio.suspension_reason === 'HIGH_RISK_FLAG') {
    return { label: 'High Risk', color: 'text-orange-400', bg: 'bg-orange-400/10' };
  }
  return { label: 'Active', color: 'text-emerald-400', bg: 'bg-emerald-400/10' };
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                      */
/* -------------------------------------------------------------------------- */

export default async function SystemControlsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const me = await requirePlatformOperator();
  const sp = await searchParams;
  const supabase = await createClient();

  const search = typeof sp.search === 'string' ? sp.search.trim() : '';

  /* --- Fetch portfolios ------------------------------------------------- */

  const { data: portfolios } = await (supabase as any)
    .from('portfolios')
    .select('id, company_name, tier, suspended_at, suspension_reason, created_at')
    .is('archived_at', null)
    .order('company_name');

  const allPortfolios: PortfolioRow[] = portfolios ?? [];

  /* --- Compute system health -------------------------------------------- */

  const totalCompanies = allPortfolios.length;
  const suspendedCount = allPortfolios.filter((p) => p.suspended_at).length;
  const vipCount = allPortfolios.filter((p) => p.tier === 'vip').length;
  const highRiskCount = allPortfolios.filter(
    (p) => p.suspension_reason === 'HIGH_RISK_FLAG',
  ).length;
  const activeCount = totalCompanies - suspendedCount;

  const healthIssues = suspendedCount + highRiskCount;
  const systemHealthy = healthIssues === 0;

  /* --- Apply search filter ---------------------------------------------- */

  let filteredPortfolios = allPortfolios;
  if (search) {
    const q = search.toLowerCase();
    filteredPortfolios = allPortfolios.filter(
      (p) => p.company_name.toLowerCase().includes(q),
    );
  }

  /* ---------------------------------------------------------------------- */
  /*  Render                                                                 */
  /* ---------------------------------------------------------------------- */

  return (
    <div className="-mx-8 -my-8 min-h-[calc(100vh-64px)] bg-[#060B18]">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="border-b border-white/[0.06] px-8 py-6">
        <div className="[&_h1]:text-white [&_.text-slate-400]:text-slate-400 [&_.text-gray-900]:text-white">
          <WorkspaceHeader
            eyebrow="Platform Operator"
            title="System Controls"
            subtitle="Manage companies, enforce policies, reset credentials, and apply administrative actions across the entire platform."
          />
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div className="px-8 py-6 space-y-6">
        {/* ── System Status Banner ──────────────────────────────────────── */}
        <div
          className={`flex items-center gap-4 rounded-xl border ${
            systemHealthy
              ? 'border-emerald-500/20 bg-emerald-500/5'
              : 'border-amber-500/20 bg-amber-500/5'
          } px-6 py-4`}
        >
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-full ${
              systemHealthy ? 'bg-emerald-400/10' : 'bg-amber-400/10'
            }`}
          >
            {systemHealthy ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-amber-400" />
            )}
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-white">
              System Status: {systemHealthy ? 'Healthy' : 'Needs Attention'}
            </p>
            <p className="text-xs text-slate-400">
              {systemHealthy
                ? `${activeCount} companies active. All systems operational — no suspended or high-risk flags active.`
                : `${healthIssues} issue${healthIssues > 1 ? 's' : ''} detected — ${suspendedCount} suspended, ${highRiskCount} high-risk flagged. ${activeCount} companies currently active.`}
            </p>
          </div>
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
              systemHealthy
                ? 'bg-emerald-400/10 text-emerald-400'
                : 'bg-amber-400/10 text-amber-400'
            }`}
          >
            {systemHealthy ? 'ALL CLEAR' : 'WARNING'}
          </span>
        </div>

        {/* ── Stats Row ─────────────────────────────────────────────────── */}
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4 lg:grid-cols-5">
          <StatDark label="Total Companies" value={totalCompanies} accent="slate" />
          <StatDark label="Active" value={activeCount} accent="emerald" />
          <StatDark label="Suspended" value={suspendedCount} accent={suspendedCount > 0 ? 'rose' : 'slate'} />
          <StatDark label="VIP" value={vipCount} accent="amber" />
          <StatDark label="High Risk" value={highRiskCount} accent={highRiskCount > 0 ? 'rose' : 'slate'} />
        </div>

        {/* ── Quick Actions Panel ───────────────────────────────────────── */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="h-4 w-4 text-slate-400" />
            <h2 className="text-sm font-semibold text-white">Administrative Actions</h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {/* Suspend Company */}
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
              <div className="flex items-center gap-2 mb-3">
                <PauseCircle className="h-4 w-4 text-rose-400" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Suspend Company
                </h3>
              </div>
              <form action={suspendCompany} className="space-y-2">
                <select
                  name="portfolio_id"
                  required
                  className="w-full h-9 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 text-sm text-slate-200 focus:border-rose-500/50 focus:outline-none focus:ring-1 focus:ring-rose-500/50"
                >
                  <option value="">Select company…</option>
                  {allPortfolios
                    .filter((p) => !p.suspended_at)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.company_name}
                      </option>
                    ))}
                </select>
                <input
                  name="reason"
                  type="text"
                  placeholder="Reason (optional)"
                  className="w-full h-9 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 text-sm text-slate-200 placeholder:text-slate-400 focus:border-rose-500/50 focus:outline-none focus:ring-1 focus:ring-rose-500/50"
                />
                <button
                  type="submit"
                  className="w-full h-9 rounded-lg bg-rose-600 text-sm font-medium text-white hover:bg-rose-500 transition"
                >
                  Suspend
                </button>
              </form>
            </div>

            {/* Reactivate Company */}
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
              <div className="flex items-center gap-2 mb-3">
                <PlayCircle className="h-4 w-4 text-emerald-400" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Reactivate Company
                </h3>
              </div>
              <form action={reactivateCompany} className="space-y-2">
                <select
                  name="portfolio_id"
                  required
                  className="w-full h-9 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 text-sm text-slate-200 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                >
                  <option value="">Select company…</option>
                  {allPortfolios
                    .filter((p) => p.suspended_at)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.company_name}
                      </option>
                    ))}
                </select>
                <button
                  type="submit"
                  className="w-full h-9 rounded-lg bg-emerald-600 text-sm font-medium text-white hover:bg-emerald-500 transition"
                >
                  Reactivate
                </button>
              </form>
            </div>

            {/* Force Password Reset */}
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
              <div className="flex items-center gap-2 mb-3">
                <Key className="h-4 w-4 text-amber-400" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Force Password Reset
                </h3>
              </div>
              <form action={forcePasswordReset} className="space-y-2">
                <input
                  name="email"
                  type="email"
                  required
                  placeholder="user@company.com"
                  className="w-full h-9 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 text-sm text-slate-200 placeholder:text-slate-400 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                />
                <button
                  type="submit"
                  className="w-full h-9 rounded-lg bg-amber-600 text-sm font-medium text-white hover:bg-amber-500 transition"
                >
                  Send Reset Link
                </button>
              </form>
            </div>

            {/* Change Billing Tier */}
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
              <div className="flex items-center gap-2 mb-3">
                <CreditCard className="h-4 w-4 text-blue-400" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Change Billing Tier
                </h3>
              </div>
              <form action={changeBillingTier} className="space-y-2">
                <select
                  name="portfolio_id"
                  required
                  className="w-full h-9 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 text-sm text-slate-200 focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                >
                  <option value="">Select company…</option>
                  {allPortfolios.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.company_name} ({p.tier ?? 'starter'})
                    </option>
                  ))}
                </select>
                <select
                  name="tier"
                  required
                  className="w-full h-9 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 text-sm text-slate-200 focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                >
                  <option value="">Select tier…</option>
                  {BILLING_TIERS.map((t) => (
                    <option key={t} value={t}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="w-full h-9 rounded-lg bg-blue-600 text-sm font-medium text-white hover:bg-blue-500 transition"
                >
                  Update Tier
                </button>
              </form>
            </div>

            {/* Add Internal Note */}
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
              <div className="flex items-center gap-2 mb-3">
                <StickyNote className="h-4 w-4 text-slate-400" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Add Internal Note
                </h3>
              </div>
              <form action={addInternalNote} className="space-y-2">
                <select
                  name="portfolio_id"
                  required
                  className="w-full h-9 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 text-sm text-slate-200 focus:border-slate-500/50 focus:outline-none focus:ring-1 focus:ring-slate-500/50"
                >
                  <option value="">Select company…</option>
                  {allPortfolios.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.company_name}
                    </option>
                  ))}
                </select>
                <textarea
                  name="note"
                  required
                  rows={3}
                  placeholder="Internal note text…"
                  className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-slate-200 placeholder:text-slate-400 focus:border-slate-500/50 focus:outline-none focus:ring-1 focus:ring-slate-500/50 resize-none"
                />
                <button
                  type="submit"
                  className="w-full h-9 rounded-lg bg-slate-700 text-sm font-medium text-white hover:bg-slate-600 transition"
                >
                  Save Note
                </button>
              </form>
            </div>

            {/* Toggle VIP / High-Risk */}
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
              <div className="flex items-center gap-2 mb-3">
                <Star className="h-4 w-4 text-amber-400" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Mark Company
                </h3>
              </div>
              <div className="space-y-3">
                {/* VIP Toggle */}
                <form action={toggleVip} className="space-y-2">
                  <select
                    name="portfolio_id"
                    required
                    className="w-full h-9 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 text-sm text-slate-200 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                  >
                    <option value="">Select company…</option>
                    {allPortfolios.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.company_name} {p.tier === 'vip' ? '(VIP)' : ''}
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      name="is_vip"
                      value="1"
                      className="flex-1 h-9 rounded-lg bg-amber-600/80 text-sm font-medium text-white hover:bg-amber-500 transition"
                    >
                      <Star className="inline h-3.5 w-3.5 mr-1" />
                      Set VIP
                    </button>
                    <button
                      type="submit"
                      name="is_vip"
                      value="0"
                      className="flex-1 h-9 rounded-lg border border-white/[0.08] bg-white/[0.04] text-sm font-medium text-slate-300 hover:bg-white/[0.06] transition"
                    >
                      Unset VIP
                    </button>
                  </div>
                </form>

                <div className="border-t border-white/[0.06]" />

                {/* High-Risk Toggle */}
                <form action={toggleHighRisk}>
                  <input type="hidden" name="portfolio_id" value="" id="highrisk-portfolio" />
                  <div className="flex gap-2">
                    <select
                      name="portfolio_id"
                      required
                      className="flex-1 h-9 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 text-sm text-slate-200 focus:border-orange-500/50 focus:outline-none focus:ring-1 focus:ring-orange-500/50"
                    >
                      <option value="">Select company…</option>
                      {allPortfolios.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.company_name}{' '}
                          {p.suspension_reason === 'HIGH_RISK_FLAG' ? '(HIGH RISK)' : ''}
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      name="is_high_risk"
                      value="1"
                      className="h-9 rounded-lg bg-orange-600/80 px-3 text-sm font-medium text-white hover:bg-orange-500 transition"
                    >
                      <ShieldAlert className="inline h-3.5 w-3.5 mr-1" />
                      Flag HR
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>

        {/* ── All Companies Quick-Action List ────────────────────────────── */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02]">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-slate-400" />
              <h2 className="text-sm font-semibold text-white">All Companies</h2>
              <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-slate-400">
                {filteredPortfolios.length}
              </span>
            </div>
            <form className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                name="search"
                defaultValue={search}
                placeholder="Search companies…"
                className="h-8 w-56 rounded-lg border border-white/[0.08] bg-white/[0.04] pl-9 pr-3 text-sm text-slate-200 placeholder:text-slate-400 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
              />
            </form>
          </div>

          {/* List */}
          <div className="divide-y divide-white/[0.04]">
            {filteredPortfolios.length === 0 ? (
              <div className="py-14 text-center">
                <Building2 className="mx-auto h-6 w-6 text-slate-400" />
                <p className="mt-3 text-sm text-slate-400">
                  {search ? 'No companies match your search.' : 'No companies exist yet.'}
                </p>
              </div>
            ) : (
              filteredPortfolios.map((p) => {
                const status = statusLabel(p);
                const isVip = p.tier === 'vip';
                const isHighRisk = p.suspension_reason === 'HIGH_RISK_FLAG';

                return (
                  <div
                    key={p.id}
                    className="flex items-center justify-between px-5 py-3 transition hover:bg-white/[0.02]"
                  >
                    {/* Info */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                          isVip
                            ? 'bg-amber-400/10 text-amber-400'
                            : isHighRisk
                              ? 'bg-orange-400/10 text-orange-400'
                              : 'bg-white/5 text-slate-400'
                        }`}
                      >
                        {isVip ? (
                          <Star className="h-4 w-4" />
                        ) : isHighRisk ? (
                          <ShieldAlert className="h-4 w-4" />
                        ) : (
                          <Building2 className="h-4 w-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white truncate">
                          {p.company_name}
                        </p>
                        <p className="text-xs text-slate-400">
                          Tier: {p.tier ?? 'starter'} · Created{' '}
                          {new Date(p.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </p>
                      </div>
                    </div>

                    {/* Status Badges */}
                    <div className="flex items-center gap-2">
                      {p.suspended_at && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-400/10 px-2.5 py-0.5 text-xs font-semibold text-rose-400 ring-1 ring-inset ring-rose-400/30">
                          <PauseCircle className="h-3 w-3" />
                          Suspended
                        </span>
                      )}
                      {isVip && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/10 px-2.5 py-0.5 text-xs font-semibold text-amber-400 ring-1 ring-inset ring-amber-400/30">
                          <Star className="h-3 w-3" />
                          VIP
                        </span>
                      )}
                      {isHighRisk && !p.suspended_at && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-orange-400/10 px-2.5 py-0.5 text-xs font-semibold text-orange-400 ring-1 ring-inset ring-orange-400/30">
                          <ShieldAlert className="h-3 w-3" />
                          High Risk
                        </span>
                      )}
                      {!p.suspended_at && !isVip && !isHighRisk && (
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${status.bg} ${status.color}`}
                        >
                          {status.label}
                        </span>
                      )}

                      {/* Quick Actions */}
                      <div className="flex items-center gap-1 ml-2">
                        {p.suspended_at ? (
                          <form action={reactivateCompany}>
                            <input type="hidden" name="portfolio_id" value={p.id} />
                            <button
                              type="submit"
                              title="Reactivate"
                              className="inline-flex h-7 w-7 items-center justify-center rounded text-slate-400 hover:bg-emerald-400/10 hover:text-emerald-400 transition"
                            >
                              <PlayCircle className="h-4 w-4" />
                            </button>
                          </form>
                        ) : (
                          <details className="relative">
                            <summary className="inline-flex h-7 w-7 cursor-pointer list-none items-center justify-center rounded text-slate-400 hover:bg-white/[0.06] hover:text-slate-300 transition">
                              <RefreshCw className="h-3.5 w-3.5" />
                            </summary>
                            <div className="absolute right-0 z-20 mt-1 w-36 rounded-lg border border-white/[0.08] bg-[#111827] py-1 shadow-xl">
                              <form action={suspendCompany}>
                                <input type="hidden" name="portfolio_id" value={p.id} />
                                <input type="hidden" name="reason" value="Quick suspension" />
                                <button className="block w-full px-4 py-2 text-left text-sm text-rose-400 hover:bg-rose-400/10 transition">
                                  Suspend
                                </button>
                              </form>
                              {!isVip && (
                                <form action={toggleVip}>
                                  <input type="hidden" name="portfolio_id" value={p.id} />
                                  <input type="hidden" name="is_vip" value="1" />
                                  <button className="block w-full px-4 py-2 text-left text-sm text-amber-400 hover:bg-amber-400/10 transition">
                                    Set VIP
                                  </button>
                                </form>
                              )}
                              {!isHighRisk && (
                                <form action={toggleHighRisk}>
                                  <input type="hidden" name="portfolio_id" value={p.id} />
                                  <input type="hidden" name="is_high_risk" value="1" />
                                  <button className="block w-full px-4 py-2 text-left text-sm text-orange-400 hover:bg-orange-400/10 transition">
                                    Flag High Risk
                                  </button>
                                </form>
                              )}
                            </div>
                          </details>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-white/[0.04] px-4 py-2 text-xs text-slate-400">
            Showing {filteredPortfolios.length} of {totalCompanies} companies
            {search && ' (filtered)'}
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Dark-themed Stat                                                          */
/* -------------------------------------------------------------------------- */

function StatDark({
  label,
  value,
  accent = 'slate',
}: {
  label: string;
  value: React.ReactNode;
  accent?: 'slate' | 'emerald' | 'blue' | 'amber' | 'rose';
}) {
  const borderMap: Record<string, string> = {
    slate: 'border-slate-700/40',
    emerald: 'border-emerald-500/30',
    blue: 'border-blue-500/30',
    amber: 'border-amber-500/30',
    rose: 'border-rose-500/30',
  };
  const bgMap: Record<string, string> = {
    slate: 'bg-white/[0.02]',
    emerald: 'bg-emerald-500/5',
    blue: 'bg-blue-500/5',
    amber: 'bg-amber-500/5',
    rose: 'bg-rose-500/5',
  };
  const valueMap: Record<string, string> = {
    slate: 'text-slate-100',
    emerald: 'text-emerald-300',
    blue: 'text-blue-300',
    amber: 'text-amber-300',
    rose: 'text-rose-300',
  };

  return (
    <div className={`rounded-lg border ${borderMap[accent]} ${bgMap[accent]} p-4`}>
      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${valueMap[accent]}`}>
        {value}
      </div>
    </div>
  );
}
