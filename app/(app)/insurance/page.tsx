import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function InsurancePage() {
  const me = await requireStaff();
  const supabase = await createClient();

  const { data: policies } = await (supabase as any)
    .from('v_upcoming_expirations')
    .select('*')
    .order('expiration_date', { ascending: true });

  const rows = policies ?? [];
  const expiring30 = rows.filter((r: any) => r.days_remaining <= 30 && r.days_remaining > 0).length;
  const expired = rows.filter((r: any) => r.days_remaining < 0).length;
  const active = rows.filter((r: any) => r.days_remaining > 30).length;

  return (
    <div className="mx-auto h-full max-w-7xl overflow-y-auto px-8 py-6">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink-900">Insurance policies</h1>
          <p className="mt-1 text-sm text-ink-500">
            Track HO6 certificates, coverage amounts, and expiration dates. Policies are auto-flagged 30 days before expiry.
          </p>
        </div>
        <Link href="/insurance/new">
          <Button>+ Add policy</Button>
        </Link>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <Metric label="Active policies" value={active} tone="text-emerald-700" />
        <Metric label="Expiring soon (30d)" value={expiring30} tone="text-amber-700" />
        <Metric label="Expired" value={expired} tone="text-bordeaux-700" />
        <Metric label="Total tracked" value={rows.length} tone="text-ink-700" />
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-ink-200 bg-white px-6 py-12 text-center">
          <h2 className="text-base font-semibold text-ink-900">No insurance policies yet</h2>
          <p className="mt-1 text-sm text-ink-500">
            Add your first HO6 policy to start tracking coverage and expiration dates.
          </p>
          <div className="mt-4">
            <Link href="/insurance/new"><Button>Add first policy</Button></Link>
          </div>
        </div>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Owner</TH>
              <TH>Association</TH>
              <TH>Policy #</TH>
              <TH>Insurance Co.</TH>
              <TH>Coverage</TH>
              <TH>Expires</TH>
              <TH>Status</TH>
            </TR>
          </THead>
          <tbody>
            {rows.map((p: any) => (
              <TR key={p.id} className="hover:bg-cream-50">
                <TD className="font-medium text-ink-900">{p.owner_name}</TD>
                <TD className="text-ink-600">{p.association_name ?? '—'}</TD>
                <TD className="font-mono text-xs text-ink-600">{p.policy_number}</TD>
                <TD>{p.insurance_company}</TD>
                <TD className="text-ink-700">{p.coverage_amount ? `$${Number(p.coverage_amount).toLocaleString()}` : '—'}</TD>
                <TD>
                  <span className={p.days_remaining <= 30 ? 'text-bordeaux-700 font-medium' : 'text-ink-700'}>
                    {date(p.expiration_date)}
                  </span>
                  <div className="text-xs text-ink-500">
                    {p.days_remaining > 0 ? `${p.days_remaining} days` : p.days_remaining === 0 ? 'Today' : 'Expired'}
                  </div>
                </TD>
                <TD>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    p.status === 'expired' ? 'bg-bordeaux-100 text-bordeaux-700' :
                    p.status === 'expiring_soon' ? 'bg-amber-100 text-amber-700' :
                    'bg-emerald-100 text-emerald-700'
                  }`}>
                    {p.status === 'expiring_soon' ? 'Expiring' : p.status}
                  </span>
                </TD>
              </TR>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-lg border border-ink-100 bg-white px-4 py-3">
      <div className="text-xs font-medium uppercase tracking-wider text-ink-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${tone}`}>{value}</div>
    </div>
  );
}
