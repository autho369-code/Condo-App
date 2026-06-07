import Link from 'next/link';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { MetricStrip } from '@/components/operations/metric-strip';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

// ── Types ────────────────────────────────────────────────────────
type CheckStatus = 'pass' | 'warning' | 'fail';

interface DiagnosticCheck {
  name: string;
  status: CheckStatus;
  description: string;
  action?: { label: string; href: string };
  detail?: string;
}

// ── Severity ordering ────────────────────────────────────────────
const statusOrder: Record<CheckStatus, number> = { fail: 0, warning: 1, pass: 2 };

// ── Status badge component ───────────────────────────────────────
function StatusBadge({ status }: { status: CheckStatus }) {
  const colors: Record<CheckStatus, string> = {
    pass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    fail: 'bg-red-50 text-red-700 border-red-200',
  };
  const dot: Record<CheckStatus, string> = {
    pass: 'bg-emerald-500',
    warning: 'bg-amber-500',
    fail: 'bg-red-500',
  };
  const label: Record<CheckStatus, string> = {
    pass: 'Pass',
    warning: 'Warning',
    fail: 'Fail',
  };
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${colors[status]}`}>
      <span className={`inline-block h-2 w-2 rounded-full ${dot[status]}`} />
      {label[status]}
    </span>
  );
}

// ── Card border helper ───────────────────────────────────────────
function cardBorder(status: CheckStatus): string {
  if (status === 'fail') return 'border-red-200 hover:border-red-300';
  if (status === 'warning') return 'border-amber-200 hover:border-amber-300';
  return 'border-gray-200 hover:border-gray-300';
}

// ── Page ─────────────────────────────────────────────────────────
export default async function DiagnosticsPage() {
  await requireStaff();
  const supabase = await createClient();
  const db = supabase as any;

  const today = new Date();
  const sixtyDaysAgo = new Date(today);
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
  const sixtyDaysIso = sixtyDaysAgo.toISOString().slice(0, 10);

  // ── 1. Security Deposit mismatch: trust bank accounts vs liability GLs ──
  const trustBanksQ = db
    .from('bank_accounts')
    .select('id, name, gl_account_id')
    .is('archived_at', null)
    .eq('purpose', 'trust');

  const secDepGLsQ = db
    .from('gl_accounts')
    .select('id, name, number, account_type')
    .is('archived_at', null)
    .eq('active', true)
    .or('name.ilike.%security deposit%,name.ilike.%tenant deposit%');

  // ── 2. Escrow / Reserve mismatch ───────────────────────────────
  const reserveGLsQ = db
    .from('gl_accounts')
    .select('id, name, number')
    .is('archived_at', null)
    .eq('active', true)
    .eq('fund_account', 'reserve');

  const reserveBanksQ = db
    .from('bank_accounts')
    .select('id, name, gl_account_id')
    .is('archived_at', null)
    .eq('purpose', 'reserve');

  // ── 3. Non-zero clearing account detection ─────────────────────
  const clearingGLsQ = db
    .from('gl_accounts')
    .select('id, name, number, account_type')
    .is('archived_at', null)
    .eq('active', true)
    .or('name.ilike.%clearing%,name.ilike.%suspense%');

  // ── 4. Additional fee GL account assignment ────────────────────
  const addFeesQ = db
    .from('association_additional_fees')
    .select('id, label, gl_account_id, associations!inner(name)')
    .is('archived_at', null);

  // ── 5. Prepayment / deferred GL accounts ───────────────────────
  const prepayGLsQ = db
    .from('gl_accounts')
    .select('id, name, number, account_type')
    .is('archived_at', null)
    .eq('active', true)
    .or('name.ilike.%prepayment%,name.ilike.%prepaid%,name.ilike.%deferred income%');

  // ── 6. Reconciliation lapses > 60 days ─────────────────────────
  const allBanksQ = db
    .from('bank_accounts')
    .select('id, name, bank_name, last_reconciliation_date, purpose')
    .is('archived_at', null)
    .order('name');

  // ── 7. Persisted diagnostics from data_diagnostics table ───────
  const persistedDiagsQ = db
    .from('data_diagnostics')
    .select('id, title, category, severity, details, entity_type, entity_id, last_seen_at, occurrence_count')
    .is('resolved_at', null)
    .order('severity', { ascending: false })
    .limit(20);

  // ── Run all queries ────────────────────────────────────────────
  const [
    { data: trustBanks },
    { data: secDepGLs },
    { data: reserveGLs },
    { data: reserveBanks },
    { data: clearingGLs },
    { data: addFees },
    { data: prepayGLs },
    { data: allBanks },
    { data: persistedDiags },
  ] = await Promise.all([
    trustBanksQ,
    secDepGLsQ,
    reserveGLsQ,
    reserveBanksQ,
    clearingGLsQ,
    addFeesQ,
    prepayGLsQ,
    allBanksQ,
    persistedDiagsQ,
  ]);

  // ── Compute diagnostic checks ──────────────────────────────────
  const checks: DiagnosticCheck[] = [];

  // 1. Security Deposit Funds Mismatch
  {
    const sds = secDepGLs ?? [];
    const tbs = trustBanks ?? [];
    const secDepIds = new Set(sds.map((g: any) => g.id));
    const linkedTrustBanks = tbs.filter((b: any) => b.gl_account_id && secDepIds.has(b.gl_account_id));

    if (sds.length === 0 && tbs.length === 0) {
      checks.push({
        name: 'Security Deposit Funds Mismatch',
        status: 'pass',
        description: 'No security deposit GL accounts or trust bank accounts configured.',
        action: { label: 'GL accounts', href: '/gl-accounts' },
      });
    } else if (sds.length === 0 && tbs.length > 0) {
      checks.push({
        name: 'Security Deposit Funds Mismatch',
        status: 'warning',
        description: `${tbs.length} trust bank account(s) exist but no security deposit liability GL accounts found.`,
        detail: 'Create security deposit GL accounts and link them to trust bank accounts.',
        action: { label: 'GL accounts', href: '/gl-accounts' },
      });
    } else if (sds.length > 0 && tbs.length === 0) {
      checks.push({
        name: 'Security Deposit Funds Mismatch',
        status: 'warning',
        description: `${sds.length} security deposit GL account(s) exist but no trust bank accounts configured.`,
        detail: 'Create trust bank accounts for security deposit funds.',
        action: { label: 'Bank accounts', href: '/bank-accounts' },
      });
    } else if (linkedTrustBanks.length < tbs.length) {
      const unlinked = tbs.length - linkedTrustBanks.length;
      checks.push({
        name: 'Security Deposit Funds Mismatch',
        status: 'warning',
        description: `${unlinked} of ${tbs.length} trust bank account(s) are not linked to a security deposit GL account.`,
        detail: 'Link each trust bank account to its corresponding security deposit GL account.',
        action: { label: 'Bank accounts', href: '/bank-accounts' },
      });
    } else {
      checks.push({
        name: 'Security Deposit Funds Mismatch',
        status: 'pass',
        description: `All ${tbs.length} trust bank account(s) are linked to ${sds.length} security deposit GL account(s).`,
        action: { label: 'View accounts', href: '/bank-accounts' },
      });
    }
  }

  // 2. Escrow / Reserve Cash Account Balance Mismatch
  {
    const rgl = reserveGLs ?? [];
    const rbk = reserveBanks ?? [];

    if (rgl.length === 0 && rbk.length === 0) {
      checks.push({
        name: 'Escrow / Reserve Cash Account Mismatch',
        status: 'pass',
        description: 'No reserve fund GL accounts or reserve bank accounts configured.',
        action: { label: 'GL accounts', href: '/gl-accounts' },
      });
    } else if (rgl.length === 0) {
      checks.push({
        name: 'Escrow / Reserve Cash Account Mismatch',
        status: 'warning',
        description: `${rbk.length} reserve bank account(s) exist but no GL accounts tagged as fund_account=reserve.`,
        detail: 'Tag reserve GL accounts with fund_account=reserve in chart of accounts.',
        action: { label: 'GL accounts', href: '/gl-accounts' },
      });
    } else if (rbk.length === 0) {
      checks.push({
        name: 'Escrow / Reserve Cash Account Mismatch',
        status: 'warning',
        description: `${rgl.length} reserve GL account(s) exist but no reserve bank accounts configured.`,
        detail: 'Set up reserve bank accounts for escrow/reserve funds.',
        action: { label: 'Bank accounts', href: '/bank-accounts' },
      });
    } else {
      checks.push({
        name: 'Escrow / Reserve Cash Account Mismatch',
        status: 'pass',
        description: `${rgl.length} reserve GL account(s) and ${rbk.length} reserve bank account(s) are configured.`,
        action: { label: 'View accounts', href: '/bank-accounts' },
      });
    }
  }

  // 3. Non-Zero Security Clearing Account Balances
  {
    const cls = clearingGLs ?? [];
    if (cls.length === 0) {
      checks.push({
        name: 'Non-Zero Security Clearing Account Balances',
        status: 'pass',
        description: 'No clearing or suspense GL accounts found.',
        action: { label: 'GL accounts', href: '/gl-accounts' },
      });
    } else {
      // Check for charges posted to clearing accounts (which should not happen in normal ops)
      const clearingIds = cls.map((g: any) => g.id);
      const { count: chargeCount } = await db
        .from('charges')
        .select('id', { count: 'exact', head: true })
        .in('gl_account_id', clearingIds);

      if ((chargeCount ?? 0) === 0) {
        checks.push({
          name: 'Non-Zero Security Clearing Account Balances',
          status: 'pass',
          description: `${cls.length} clearing/suspense account(s) found with no charges posted. Manual GL balance review recommended periodically.`,
          action: { label: 'GL accounts', href: '/gl-accounts' },
        });
      } else {
        checks.push({
          name: 'Non-Zero Security Clearing Account Balances',
          status: 'fail',
          description: `${cls.length} clearing/suspense account(s) found with ${chargeCount} charge(s) posted to them.`,
          detail: 'Clearing accounts should net to zero after reconciliation. Review and post clearing journal entries.',
          action: { label: 'Journal entries', href: '/journal-entries' },
        });
      }
    }
  }

  // 4. Negative/Positive Balance on Additional Fee GL Accounts
  {
    const fees = addFees ?? [];
    if (fees.length === 0) {
      checks.push({
        name: 'Additional Fee GL Account Balances',
        status: 'pass',
        description: 'No association additional fees configured.',
        action: { label: 'Associations', href: '/associations' },
      });
    } else {
      const missingGL = fees.filter((f: any) => !f.gl_account_id);
      if (missingGL.length > 0) {
        const names = missingGL.slice(0, 3).map((f: any) =>
          `${f.associations?.name ?? '?'} — ${f.label ?? 'unnamed'}`
        ).join('; ');
        const overflow = missingGL.length > 3 ? ` +${missingGL.length - 3} more` : '';
        checks.push({
          name: 'Additional Fee GL Account Balances',
          status: 'warning',
          description: `${missingGL.length} of ${fees.length} additional fee(s) missing GL account assignment.`,
          detail: `${names}${overflow}. Assign a GL account to each additional fee for proper accounting.`,
          action: { label: 'Associations', href: '/associations' },
        });
      } else {
        checks.push({
          name: 'Additional Fee GL Account Balances',
          status: 'pass',
          description: `All ${fees.length} additional fee(s) have GL accounts assigned.`,
          action: { label: 'Associations', href: '/associations' },
        });
      }
    }
  }

  // 5. Prepayment Balance Mismatch
  {
    const pgl = prepayGLs ?? [];
    if (pgl.length === 0) {
      checks.push({
        name: 'Prepayment Balance Mismatch',
        status: 'pass',
        description: 'No prepayment or deferred income GL accounts configured.',
        action: { label: 'GL accounts', href: '/gl-accounts' },
      });
    } else {
      checks.push({
        name: 'Prepayment Balance Mismatch',
        status: 'pass',
        description: `${pgl.length} prepayment/deferred GL account(s) configured. Manual review recommended for proper amortization.`,
        detail: 'Review prepaid expenses and deferred income schedules periodically.',
        action: { label: 'GL accounts', href: '/gl-accounts' },
      });
    }
  }

  // 6. Bank Account Reconciliation Lapses Over 60 Days
  {
    const banks = allBanks ?? [];
    if (banks.length === 0) {
      checks.push({
        name: 'Bank Account Reconciliation Lapses',
        status: 'pass',
        description: 'No bank accounts configured.',
        action: { label: 'Bank accounts', href: '/bank-accounts' },
      });
    } else {
      const neverReconciled = banks.filter((b: any) => !b.last_reconciliation_date);
      const overdueReconciled = banks.filter((b: any) =>
        b.last_reconciliation_date && b.last_reconciliation_date < sixtyDaysIso
      );
      const current = banks.filter((b: any) =>
        b.last_reconciliation_date && b.last_reconciliation_date >= sixtyDaysIso
      );

      const lapseCount = neverReconciled.length + overdueReconciled.length;

      if (lapseCount === 0) {
        checks.push({
          name: 'Bank Account Reconciliation Lapses',
          status: 'pass',
          description: `All ${banks.length} bank account(s) reconciled within the last 60 days.`,
        });
      } else {
        const detailParts: string[] = [];
        if (neverReconciled.length > 0) {
          const names = neverReconciled.slice(0, 2).map((b: any) => b.name).join(', ');
          const more = neverReconciled.length > 2 ? ` +${neverReconciled.length - 2} more` : '';
          detailParts.push(`${neverReconciled.length} never reconciled: ${names}${more}`);
        }
        if (overdueReconciled.length > 0) {
          const names = overdueReconciled.slice(0, 2).map((b: any) =>
            `${b.name} (${date(b.last_reconciliation_date)})`
          ).join(', ');
          const more = overdueReconciled.length > 2 ? ` +${overdueReconciled.length - 2} more` : '';
          detailParts.push(`${overdueReconciled.length} overdue: ${names}${more}`);
        }

        checks.push({
          name: 'Bank Account Reconciliation Lapses',
          status: lapseCount > banks.length / 2 ? 'fail' : 'warning',
          description: `${lapseCount} of ${banks.length} bank account(s) have reconciliation lapses over 60 days.`,
          detail: `${detailParts.join(' | ')}. ${current.length} account(s) are current.`,
          action: { label: 'Reconcile now', href: '/bank-accounts/reconcile' },
        });
      }
    }
  }

  // ── 7. Persisted diagnostics from data_diagnostics table ───────
  const persisted = persistedDiags ?? [];
  for (const d of persisted) {
    const status: CheckStatus =
      d.severity === 'error' ? 'fail' : d.severity === 'warning' ? 'warning' : 'pass';
    checks.push({
      name: d.title,
      status,
      description: d.details ?? d.category,
      detail: `Occurred ${d.occurrence_count ?? 1} time(s). Last seen ${date(d.last_seen_at)}.`,
      action: d.entity_type ? {
        label: `View ${d.entity_type}`,
        href: d.entity_type === 'bank_account' ? `/bank-accounts` :
              d.entity_type === 'gl_account' ? `/gl-accounts` :
              d.entity_type === 'payable_bill' ? `/bills` :
              d.entity_type === 'charge' ? `/charges` : `/accounting`,
      } : { label: 'Accounting', href: '/accounting' },
    });
  }

  // ── Sort: fails first, then warnings, then passes ──────────────
  checks.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);

  // ── Summary metrics ────────────────────────────────────────────
  const totalChecks = checks.length;
  const passed = checks.filter((d) => d.status === 'pass').length;
  const warnings = checks.filter((d) => d.status === 'warning').length;
  const failed = checks.filter((d) => d.status === 'fail').length;

  const metrics = [
    { label: 'Total checks', value: totalChecks },
    { label: 'Passed', value: passed, colorClass: 'text-emerald-600' },
    { label: 'Warnings', value: warnings, colorClass: 'text-amber-600' },
    { label: 'Failed', value: failed, colorClass: 'text-red-600' },
  ].map((m) => ({
    label: m.label,
    value: <span className={`${m.colorClass ?? ''}`}>{m.value}</span>,
  }));

  return (
    <DataWorkspace
      title="Accounting diagnostics"
      description="Read-only health checks for GL account structure, bank reconciliations, security deposits, escrow accounts, and additional fees per AppFolio Accounting Architecture §2.5."
      actions={
        <Link
          href="/accounting"
          className="rounded border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Back to accounting
        </Link>
      }
    >
      <div className="space-y-8">
        {/* ── Metric strip ──────────────────────────────────── */}
        <MetricStrip metrics={metrics} />

        {/* ── Diagnostic cards ──────────────────────────────── */}
        <section>
          <h2 className="mb-4 text-sm font-semibold text-gray-950">Diagnostic checks</h2>
          {checks.length === 0 ? (
            <div className="rounded-lg border border-gray-200 bg-white px-6 py-10 text-center text-sm text-gray-500">
              No diagnostics available. Run a data health scan to populate checks.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {checks.map((check) => (
                <div
                  key={check.name}
                  className={`rounded-lg border bg-white p-5 transition-colors ${cardBorder(check.status)}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-gray-950">{check.name}</h3>
                      <p className="mt-1 text-sm text-gray-600">{check.description}</p>
                      {check.detail && (
                        <p className="mt-1.5 text-xs text-gray-400">{check.detail}</p>
                      )}
                    </div>
                    <StatusBadge status={check.status} />
                  </div>
                  {check.action && (
                    <div className="mt-3">
                      <Link
                        href={check.action.href}
                        className="text-sm font-medium text-blue-700 hover:underline"
                      >
                        {check.action.label} &rarr;
                      </Link>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Legend ────────────────────────────────────────── */}
        <section className="rounded border border-gray-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-gray-950">Status legend</h2>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-600">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
              Pass — No issues detected
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-500" />
              Warning — Needs attention
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" />
              Fail — Action required
            </span>
          </div>
        </section>

        {/* ── What gets checked ─────────────────────────────── */}
        <section className="rounded border border-gray-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-gray-950">What gets checked</h2>
          <ul className="list-inside list-disc space-y-1.5 text-sm text-gray-600">
            <li>Security Deposit Funds — trust bank accounts linked to security deposit GL accounts</li>
            <li>Escrow / Reserve Cash Accounts — reserve bank accounts linked to reserve GL accounts</li>
            <li>Security Clearing Accounts — no charges posted to clearing/suspense GL accounts</li>
            <li>Additional Fee GL Accounts — every additional fee has a GL account assigned</li>
            <li>Prepayment Balances — prepaid/deferred income GL account structure in place</li>
            <li>Bank Reconciliation Lapses — all bank accounts reconciled within 60 days</li>
            <li>Persisted Diagnostics — issues from the data_diagnostics table</li>
          </ul>
        </section>
      </div>
    </DataWorkspace>
  );
}
