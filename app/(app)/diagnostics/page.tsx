import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { ModulePage } from '@/components/workspace/module-page';

export const dynamic = 'force-dynamic';

// The financial / data diagnostic scanners write into multiple tables; this page
// surfaces the high-level counts and links to the reports that break them down.
export default async function DiagnosticsPage() {
  const me = await requireStaff();
  const supabase = await createClient();

  const [{ count: invalidPhone }, { count: noOwner }, { count: noEmail }, { data: summary }] = await Promise.all([
    supabase.from('owners').select('*', { count: 'exact', head: true }).or('phone.is.null,phone.eq.'),
    supabase.from('units').select('*', { count: 'exact', head: true }).not('id', 'in', '(SELECT unit_id FROM occupancies WHERE status=\'current\')'),
    supabase.from('owners').select('*', { count: 'exact', head: true }).or('email.is.null,email.eq.'),
    supabase.from('v_dashboard_summary').select('open_diagnostics, portal_not_activated_count, insurance_expirations_60d').eq('portfolio_id', me.portfolio?.id ?? '00000000-0000-0000-0000-000000000000').maybeSingle(),
  ]);

  const tiles = [
    { label: 'Owners missing phone', value: invalidPhone ?? 0 },
    { label: 'Owners missing email', value: noEmail ?? 0 },
    { label: 'Units without current occupancy', value: noOwner ?? 0 },
    { label: 'Portal not activated',    value: summary?.portal_not_activated_count ?? 0 },
    { label: 'Insurance expiring (60d)', value: summary?.insurance_expirations_60d ?? 0 },
    { label: 'Other diagnostics',        value: summary?.open_diagnostics ?? 0 },
  ];

  return (
    <ModulePage title="Diagnostics" description="Data-quality and financial-health issues found by nightly scans. Resolve directly from the linked records.">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {tiles.map((t) => (
          <div key={t.label} className="rounded border border-gray-200 bg-white p-4">
            <div className="text-xs font-medium uppercase tracking-wider text-gray-500">{t.label}</div>
            <div className={'mt-1 text-2xl font-semibold tabular-nums ' + (Number(t.value) > 0 ? 'text-red-700' : 'text-gray-900')}>{t.value}</div>
          </div>
        ))}
      </div>

      <div className="rounded border border-gray-200 bg-white px-5 py-4 text-sm">
        <div className="font-medium text-gray-900">Detailed scans</div>
        <ul className="mt-2 space-y-1 text-sm">
          <li><Link href="/reports/data_diagnostics_summary" className="text-brand-600 hover:underline">Data diagnostics summary →</Link></li>
          <li><Link href="/reports/email_delivery_errors" className="text-brand-600 hover:underline">Email delivery errors →</Link></li>
          <li><Link href="/reports/users_and_permissions" className="text-brand-600 hover:underline">User roles &amp; permissions →</Link></li>
        </ul>
        <p className="mt-3 text-xs text-gray-500">
          Scans run via the <code className="rounded bg-gray-100 px-1">scan_data_diagnostics</code> and <code className="rounded bg-gray-100 px-1">scan_financial_diagnostics</code> functions on a nightly cron.
        </p>
      </div>
    </ModulePage>
  );
}
