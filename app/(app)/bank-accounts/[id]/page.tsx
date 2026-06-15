import * as React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Landmark } from 'lucide-react';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { MetricStrip } from '@/components/operations/metric-strip';
import { StatusChip } from '@/components/operations/status-chip';
import { Button } from '@/components/ui/button';
import { EmptyState, Surface } from '@/components/ui/shell';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { requireStaff } from '@/lib/auth/me';
import { maskBankNumber } from '@/lib/banking/bank-format';
import { toActivityRows, type BankActivitySourceRow } from '@/lib/banking/activity';
import { createClient } from '@/lib/supabase/server';
import { date, money } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function BankAccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireStaff();
  const { id } = await params;
  const supabase = await createClient();
  const db = supabase as any;

  const { data: account } = await db
    .from('bank_accounts')
    .select(
      'id, name, bank_name, description, account_number, routing_number, account_type, purpose, gl_account_id, payments_enabled, auto_reconciliation, last_reconciliation_date, next_check_number, associations(name)',
    )
    .eq('id', id)
    .is('archived_at', null)
    .maybeSingle();

  if (!account) notFound();

  // GL account linked to this bank account.
  let glAccount: any = null;
  if (account.gl_account_id) {
    const { data: gl } = await db
      .from('gl_accounts')
      .select('id, number, name, account_type')
      .eq('id', account.gl_account_id)
      .maybeSingle();
    glAccount = gl;
  }

  // Most recent reconciliation for status display.
  const { data: lastRecon } = await db
    .from('bank_reconciliations')
    .select('id, status, statement_date, statement_balance')
    .eq('bank_account_id', id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Recent ledger activity from journal lines posting to the bank account's GL account.
  let sourceRows: BankActivitySourceRow[] = [];
  if (account.gl_account_id) {
    const { data: lines } = await db
      .from('journal_lines')
      .select(
        'id, debit_amount, credit_amount, memo, journal_entries!inner(entry_date, reference_number, description)',
      )
      .eq('gl_account_id', account.gl_account_id)
      .limit(50);

    sourceRows = ((lines ?? []) as any[]).map((line) => {
      const debit = Number(line.debit_amount ?? 0);
      const credit = Number(line.credit_amount ?? 0);
      const je = line.journal_entries;
      return {
        id: line.id,
        date: je?.entry_date ?? '',
        payee: je?.description ?? line.memo ?? 'Journal entry',
        transactionType: debit >= credit ? 'deposit' : 'withdrawal',
        reference: je?.reference_number ?? '—',
        cleared: true,
        cashIn: debit,
        cashOut: credit,
        description: je?.description ?? line.memo ?? '',
      } satisfies BankActivitySourceRow;
    });
  }

  const activity = toActivityRows(sourceRows, 0);
  const reconStatus = lastRecon?.status === 'completed'
    ? 'Reconciled'
    : lastRecon?.status === 'in_progress'
      ? 'In progress'
      : 'Not reconciled';

  return (
    <DataWorkspace
      title={account.name}
      description={`${account.bank_name ?? 'Bank account'}${account.associations?.name ? ` · ${account.associations.name}` : ''}`}
      actions={
        <>
          <Link href={`/bank-accounts/activity?bank_account_id=${account.id}`}>
            <Button variant="secondary">View full activity</Button>
          </Link>
          <Link href={`/bank-accounts/reconcile?account_id=${account.id}`}>
            <Button>Reconcile</Button>
          </Link>
        </>
      }
    >
      <div className="space-y-6">
        <MetricStrip
          metrics={[
            {
              label: 'Account type',
              value: account.account_type?.replace(/_/g, ' ') ?? '—',
              sublabel: account.purpose ? String(account.purpose).replace(/_/g, ' ') : 'Bank account',
            },
            {
              label: 'Payments',
              value: account.payments_enabled ? 'Enabled' : 'Not enabled',
              sublabel: account.auto_reconciliation ? 'Auto-reconciliation on' : 'Manual reconciliation',
            },
            {
              label: 'Last reconciled',
              value: account.last_reconciliation_date ? date(account.last_reconciliation_date) : 'Never',
              sublabel: reconStatus,
            },
            {
              label: 'Next check #',
              value: account.next_check_number ?? '—',
              sublabel: 'Check sequence',
            },
          ]}
        />

        {/* Account details */}
        <Surface padded={false}>
          <div className="border-b border-gray-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">Account details</h2>
          </div>
          <dl className="grid grid-cols-1 gap-x-8 gap-y-4 px-5 py-4 sm:grid-cols-2">
            <Detail label="Bank" value={account.bank_name ?? 'Not provided'} />
            <Detail
              label="Account type"
              value={<span className="capitalize">{account.account_type?.replace(/_/g, ' ') ?? '—'}</span>}
            />
            <Detail
              label="Account number"
              value={<span className="font-mono">{account.account_number ? maskBankNumber(account.account_number) : 'Not provided'}</span>}
            />
            <Detail
              label="Routing number"
              value={<span className="font-mono">{account.routing_number ? maskBankNumber(account.routing_number) : 'Not provided'}</span>}
            />
            <Detail
              label="GL account"
              value={glAccount ? `${glAccount.number} — ${glAccount.name}` : 'Not linked'}
            />
            <Detail label="Association" value={account.associations?.name ?? 'Portfolio-wide'} />
            {account.description && (
              <div className="sm:col-span-2">
                <Detail label="Description" value={account.description} />
              </div>
            )}
          </dl>
        </Surface>

        {/* Reconciliation status */}
        <Surface padded={false}>
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">Reconciliation</h2>
            <StatusChip tone={lastRecon?.status === 'completed' ? 'success' : lastRecon?.status === 'in_progress' ? 'warning' : 'neutral'}>
              {reconStatus}
            </StatusChip>
          </div>
          <div className="px-5 py-4 text-sm text-gray-600">
            {lastRecon ? (
              <span>
                Last statement {date(lastRecon.statement_date)} · balance {money(lastRecon.statement_balance)}.{' '}
                <Link href={`/bank-accounts/reconcile?account_id=${account.id}`} className="font-medium text-gray-900 hover:underline">
                  Go to reconciliation →
                </Link>
              </span>
            ) : (
              <span>
                No reconciliation has been started for this account.{' '}
                <Link href={`/bank-accounts/reconcile/new?account_id=${account.id}`} className="font-medium text-gray-900 hover:underline">
                  Start reconciliation →
                </Link>
              </span>
            )}
          </div>
        </Surface>

        {/* Recent activity */}
        <Surface padded={false}>
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">Recent activity</h2>
            <Link href={`/bank-accounts/activity?bank_account_id=${account.id}`} className="text-sm font-medium text-gray-600 hover:text-gray-950">
              View all →
            </Link>
          </div>
          {activity.length > 0 ? (
            <Table>
              <THead>
                <TR>
                  <TH>Date</TH>
                  <TH>Payee</TH>
                  <TH>Reference</TH>
                  <TH className="text-right">Cash in</TH>
                  <TH className="text-right">Cash out</TH>
                  <TH className="text-right">Balance</TH>
                </TR>
              </THead>
              <tbody>
                {activity.map((row) => (
                  <TR key={row.id}>
                    <TD className="whitespace-nowrap text-sm">{date(row.date)}</TD>
                    <TD>{row.payee ?? row.description}</TD>
                    <TD className="font-mono text-xs text-gray-500">{row.reference}</TD>
                    <TD className="text-right tabular-nums">{row.cashIn ? money(row.cashIn) : '—'}</TD>
                    <TD className="text-right tabular-nums">{row.cashOut ? money(row.cashOut) : '—'}</TD>
                    <TD className="text-right tabular-nums font-medium">{money(row.runningBalance)}</TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          ) : (
            <EmptyState
              icon={Landmark}
              title="No activity yet"
              description={
                account.gl_account_id
                  ? 'No general ledger entries have posted to this account.'
                  : 'This account is not linked to a general ledger account, so activity cannot be shown.'
              }
            />
          )}
        </Surface>
      </div>
    </DataWorkspace>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wider text-gray-500">{label}</dt>
      <dd className="mt-1 text-sm text-gray-900">{value}</dd>
    </div>
  );
}
