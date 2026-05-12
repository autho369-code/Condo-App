export type ActivitySource = 'payment' | 'bill' | 'transfer' | 'lockbox' | 'report';

export type ActivityEntry = {
  id: string;
  source: ActivitySource;
  accountId: string;
  occurredOn: string;
  sortAt: string;
  description: string;
  counterparty?: string | null;
  associationName?: string | null;
  reference?: string | null;
  memo?: string | null;
  amount: number;
  signedAmount: number;
  href?: string;
  status?: string | null;
  runningBalance?: number;
};

type ActivityFilters = {
  accountId: string;
  source?: string;
  start?: string;
  end?: string;
  q?: string;
};

function asNumber(value: unknown) {
  if (value === null || value === undefined) return 0;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function firstDate(...values: Array<string | null | undefined>) {
  return values.find(Boolean) ?? new Date(0).toISOString();
}

function accountFromAssociation(association: any) {
  return association?.operating_bank_account_id ?? association?.primary_bank_account_id ?? null;
}

function paymentAssociation(payment: any) {
  return payment?.units?.buildings?.associations ?? null;
}

function containsAccount(value: unknown, accountId: string) {
  if (!value || !accountId) return false;
  return JSON.stringify(value).includes(accountId);
}

export function buildBankActivityEntries({
  accountId,
  payments = [],
  bills = [],
  transfers = [],
  lockboxBatches = [],
  reportRuns = [],
}: {
  accountId: string;
  payments?: any[];
  bills?: any[];
  transfers?: any[];
  lockboxBatches?: any[];
  reportRuns?: any[];
}): ActivityEntry[] {
  const entries: ActivityEntry[] = [];

  for (const payment of payments) {
    const association = paymentAssociation(payment);
    const inferredAccountId = payment.bank_account_id ?? accountFromAssociation(association);
    if (inferredAccountId !== accountId) continue;

    const unitLabel = payment.units?.unit_number ? `Unit ${payment.units.unit_number}` : 'Owner payment';
    entries.push({
      id: `payment-${payment.id}`,
      source: 'payment',
      accountId,
      occurredOn: payment.payment_date,
      sortAt: firstDate(payment.payment_date, payment.created_at),
      description: unitLabel,
      counterparty: payment.method ? `${payment.method} receipt` : 'Receipt',
      associationName: association?.name ?? null,
      reference: payment.reference,
      memo: payment.notes,
      amount: asNumber(payment.amount),
      signedAmount: asNumber(payment.amount),
      href: payment.unit_id ? `/units/${payment.unit_id}` : undefined,
      status: 'deposited',
    });
  }

  for (const bill of bills) {
    if (!bill.paid_at) continue;
    const inferredAccountId = bill.bank_account_id ?? accountFromAssociation(bill.associations);
    if (inferredAccountId !== accountId) continue;

    entries.push({
      id: `bill-${bill.id}`,
      source: 'bill',
      accountId,
      occurredOn: bill.paid_at,
      sortAt: firstDate(bill.paid_at, bill.due_date, bill.created_at),
      description: bill.vendors?.name ?? 'Vendor payment',
      counterparty: bill.vendors?.name ?? null,
      associationName: bill.associations?.name ?? null,
      reference: bill.bill_number,
      memo: bill.memo,
      amount: asNumber(bill.amount),
      signedAmount: -asNumber(bill.amount),
      href: `/bills/${bill.id}`,
      status: bill.status,
    });
  }

  for (const transfer of transfers) {
    if (transfer.from_bank_account_id === accountId) {
      entries.push({
        id: `transfer-out-${transfer.id}`,
        source: 'transfer',
        accountId,
        occurredOn: transfer.transfer_date,
        sortAt: firstDate(transfer.transfer_date, transfer.created_at),
        description: `Transfer to ${transfer.to?.name ?? 'bank account'}`,
        counterparty: transfer.to?.name ?? null,
        reference: transfer.reference_number,
        memo: transfer.memo,
        amount: asNumber(transfer.amount),
        signedAmount: -asNumber(transfer.amount),
        href: '/bank-transfers',
        status: 'posted',
      });
    }
    if (transfer.to_bank_account_id === accountId) {
      entries.push({
        id: `transfer-in-${transfer.id}`,
        source: 'transfer',
        accountId,
        occurredOn: transfer.transfer_date,
        sortAt: firstDate(transfer.transfer_date, transfer.created_at),
        description: `Transfer from ${transfer.from?.name ?? 'bank account'}`,
        counterparty: transfer.from?.name ?? null,
        reference: transfer.reference_number,
        memo: transfer.memo,
        amount: asNumber(transfer.amount),
        signedAmount: asNumber(transfer.amount),
        href: '/bank-transfers',
        status: 'posted',
      });
    }
  }

  for (const batch of lockboxBatches) {
    if (batch.bank_account_id !== accountId) continue;
    const amount = asNumber(batch.total_amount_cents) / 100;
    entries.push({
      id: `lockbox-${batch.id}`,
      source: 'lockbox',
      accountId,
      occurredOn: batch.deposited_at ?? batch.batch_date,
      sortAt: firstDate(batch.deposited_at, batch.batch_date, batch.created_at),
      description: `${batch.provider} lockbox batch`,
      counterparty: batch.provider,
      reference: batch.deposit_reference ?? batch.provider_batch_id,
      memo: batch.notes,
      amount,
      signedAmount: amount,
      status: batch.status,
    });
  }

  for (const run of reportRuns) {
    if (!containsAccount(run.parameters, accountId)) continue;
    entries.push({
      id: `report-${run.id}`,
      source: 'report',
      accountId,
      occurredOn: run.started_at ?? run.created_at,
      sortAt: firstDate(run.started_at, run.created_at),
      description: run.report_definitions?.name ?? 'Report run',
      counterparty: 'Reporting',
      reference: run.output_format,
      memo: run.row_count === null || run.row_count === undefined ? null : `${run.row_count} rows`,
      amount: 0,
      signedAmount: 0,
      href: `/reports/runs/${run.id}`,
      status: run.status,
    });
  }

  return entries;
}

export function filterBankActivityEntries(entries: ActivityEntry[], filters: ActivityFilters) {
  const query = filters.q?.trim().toLowerCase();

  return entries.filter((entry) => {
    if (entry.accountId !== filters.accountId) return false;
    if (filters.source && filters.source !== 'all' && entry.source !== filters.source) return false;
    if (filters.start && entry.occurredOn.slice(0, 10) < filters.start) return false;
    if (filters.end && entry.occurredOn.slice(0, 10) > filters.end) return false;
    if (!query) return true;

    return [
      entry.description,
      entry.counterparty,
      entry.associationName,
      entry.reference,
      entry.memo,
      entry.status,
      entry.source,
    ].some((value) => String(value ?? '').toLowerCase().includes(query));
  });
}

export function withRunningBalances(entries: ActivityEntry[]) {
  const ascending = [...entries].sort((a, b) => {
    const byDate = a.sortAt.localeCompare(b.sortAt);
    return byDate || a.id.localeCompare(b.id);
  });

  let balance = 0;
  const balances = new Map<string, number>();
  for (const entry of ascending) {
    balance += entry.signedAmount;
    balances.set(entry.id, balance);
  }

  return [...ascending]
    .reverse()
    .map((entry) => ({ ...entry, runningBalance: balances.get(entry.id) ?? 0 }));
}

export function summarizeBankActivity(entries: ActivityEntry[]) {
  return entries.reduce(
    (summary, entry) => {
      if (entry.signedAmount > 0) summary.inflow += entry.signedAmount;
      if (entry.signedAmount < 0) summary.outflow += Math.abs(entry.signedAmount);
      summary.net += entry.signedAmount;
      return summary;
    },
    { inflow: 0, outflow: 0, net: 0 },
  );
}
