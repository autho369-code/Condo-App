// CSV export of the chart of accounts with posted balances, matching the
// GL Accounts list filters.
import { NextResponse, type NextRequest } from 'next/server';
import { getMe } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { fetchAllRows } from '@/lib/supabase/fetch-all';
import { csvCell } from '@/lib/csv/cell';
import { glBalances, normalBalance } from '@/lib/gl/accounts';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  const me = await getMe();
  if (!me.auth_user_id || (!me.is_staff && !me.is_platform_operator)) {
    return new NextResponse('Forbidden', { status: 403 });
  }
  const sp = request.nextUrl.searchParams;
  const q = (sp.get('q') ?? '').trim().toLowerCase();
  const status = sp.get('status') ?? '';
  const assoc = UUID.test(sp.get('association_id') ?? '') ? sp.get('association_id')! : '';

  const db = (await createClient()) as any;
  const { rows, error } = await fetchAllRows<any>(() => db
    .from('gl_accounts')
    .select('id, number, name, account_type, fund_account, active, association_id, sub_account_of_id, description, associations(name)')
    .order('number')
    .order('id'));
  if (error) return new NextResponse(`Export failed: ${error}`, { status: 500 });
  const accounts = rows.filter((a: any) =>
    (!q || String(a.name ?? '').toLowerCase().includes(q) || String(a.number ?? '').includes(q))
    && (status !== 'active' || a.active)
    && (status !== 'inactive' || !a.active)
    && (!assoc || a.association_id === assoc || a.association_id == null));
  const numberById = new Map(rows.map((a: any) => [a.id, a.number]));
  // Balances for finance staff only: other staff can't read the ledger.
  const isFinance = me.is_finance_staff || me.is_platform_operator;
  let balances: Map<string, number> | null = null;
  if (isFinance) {
    try {
      balances = await glBalances(db, accounts.map((a: any) => a.id), assoc || null);
    } catch (e) {
      return new NextResponse(`Export failed: ${(e as Error).message}`, { status: 500 });
    }
  }

  const header = ['Number', 'Name', 'Type', 'Association', 'Sub-account of', 'Fund', ...(balances ? ['Balance'] : []), 'Status', 'Description'];
  const lines = [header.join(',')];
  for (const a of accounts) {
    lines.push([
      a.number,
      a.name,
      String(a.account_type ?? '').replace(/_/g, ' '),
      a.associations?.name ?? 'Portfolio-wide',
      a.sub_account_of_id ? numberById.get(a.sub_account_of_id) ?? '' : '',
      a.fund_account ?? '',
      ...(balances ? [normalBalance(a.account_type, balances.get(a.id) ?? 0).toFixed(2)] : []),
      a.active ? 'Active' : 'Inactive',
      a.description ?? '',
    ].map(csvCell).join(','));
  }
  return new NextResponse(lines.join('\r\n') + '\r\n', {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="gl-accounts.csv"',
      'Cache-Control': 'no-store',
    },
  });
}
