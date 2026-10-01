// CSV export of the Receipts register for the filtered date range.
import { NextResponse, type NextRequest } from 'next/server';
import { getMe } from '@/lib/auth/me';
import { receiptMethodLabel, RECEIPT_METHODS } from '@/lib/payments/methods';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f-]{36}$/i;

function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`; // spreadsheet formula injection
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(request: NextRequest) {
  const me = await getMe();
  if (!me.auth_user_id || (!me.is_finance_staff && !me.is_platform_operator)) {
    return new NextResponse('Forbidden', { status: 403 });
  }
  const sp = request.nextUrl.searchParams;
  const from = ISO.test(sp.get('from') ?? '') ? sp.get('from')! : '1900-01-01';
  const to = ISO.test(sp.get('to') ?? '') ? sp.get('to')! : '2999-12-31';
  const assoc = UUID.test(sp.get('assoc') ?? '') ? sp.get('assoc')! : '';
  const methodParam = sp.get('method') ?? '';
  const method = methodParam === 'credit' || RECEIPT_METHODS.some((m) => m.value === methodParam) ? methodParam : '';
  const includeCredits = sp.get('credits') === '1' || method === 'credit';
  const q = (sp.get('q') ?? '').trim().toLowerCase();

  const db = (await createClient()) as any;
  const unitSelect = assoc
    ? 'units!inner(unit_number, buildings!inner(association_id, associations(name)))'
    : 'units(unit_number, buildings(association_id, associations(name)))';
  const rows: any[] = [];
  for (let offset = 0; offset < 50000; offset += 1000) {
    let query = db.from('payments')
      .select(`id, amount, payment_date, method, reference, notes, created_at, bank_accounts(name), ${unitSelect}`)
      .gte('payment_date', from).lte('payment_date', to)
      .order('payment_date', { ascending: false }).order('id', { ascending: false })
      .range(offset, offset + 999);
    if (assoc) query = query.eq('units.buildings.association_id', assoc);
    if (method) query = query.eq('method', method);
    else if (!includeCredits) query = query.neq('method', 'credit');
    const { data, error } = await query;
    if (error) return new NextResponse(`Export failed: ${error.message}`, { status: 500 });
    rows.push(...(data ?? []));
    if ((data ?? []).length < 1000) break;
  }

  const lines = [['Date', 'Association', 'Unit', 'Method', 'Reference', 'Deposited to', 'Amount', 'Memo'].join(',')];
  // Same text search as the register, so the export matches what is on screen.
  const visible = q
    ? rows.filter((r) =>
        [r.reference, r.notes, r.units?.unit_number, r.units?.buildings?.associations?.name, receiptMethodLabel(r.method)]
          .some((v) => String(v ?? '').toLowerCase().includes(q)))
    : rows;
  for (const r of visible) {
    lines.push([
      r.payment_date,
      r.units?.buildings?.associations?.name,
      r.units?.unit_number,
      receiptMethodLabel(r.method),
      r.reference,
      r.method === 'credit' ? '' : r.bank_accounts?.name ?? 'Operating',
      Number(r.amount).toFixed(2),
      r.notes,
    ].map(csvCell).join(','));
  }
  return new NextResponse(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="receipts-${from}-to-${to}.csv"`,
    },
  });
}
