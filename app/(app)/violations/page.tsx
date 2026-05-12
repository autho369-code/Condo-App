import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { date, money } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const STATUS_TABS = [
  { key: 'all', label: 'All Violations' },
  { key: 'open', label: 'Open' },
  { key: 'notice_sent', label: 'Notice Sent' },
  { key: 'hearing_pending', label: 'Hearing Pending' },
  { key: 'fined', label: 'Fined' },
  { key: 'cured', label: 'Cured' },
];

export default async function ViolationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; association?: string; q?: string }>;
}) {
  await requireStaff();
  const { status = 'all', association = 'all', q = '' } = await searchParams;
  const supabase = await createClient();

  const [{ data: violations }, { data: associations }] = await Promise.all([
    supabase
      .from('violations')
      .select('id, title, description, violation_type, status, date_observed, reported_date, due_date, hearing_date, fine_amount, attachments, associations(id, name), units(id, unit_number), owners(id, full_name)')
      .is('archived_at', null)
      .order('date_observed', { ascending: false })
      .limit(200),
    supabase
      .from('associations')
      .select('id, name')
      .is('archived_at', null)
      .order('name'),
  ]);

  const term = q.trim().toLowerCase();
  const rows = (violations ?? []).filter((violation: any) => {
    if (status !== 'all' && violation.status !== status) return false;
    if (association !== 'all' && violation.associations?.id !== association) return false;
    if (!term) return true;
    return [
      violation.title,
      violation.description,
      violation.violation_type,
      violation.status,
      violation.associations?.name,
      violation.units?.unit_number,
      violation.owners?.full_name,
    ].some((value) => String(value ?? '').toLowerCase().includes(term));
  });

  const count = (key: string) =>
    key === 'all'
      ? (violations ?? []).length
      : (violations ?? []).filter((violation: any) => violation.status === key).length;

  return (
    <div className="mx-auto h-full max-w-5xl overflow-y-auto px-8 py-6">
      <nav className="mb-3 flex gap-4 text-xs font-semibold">
        {[
          ['Violations', '/violations'],
          ['Architectural Reviews', '/associations'],
          ['Compliance', '/compliance'],
          ['Violation Log', '/reports/violation_log'],
        ].map(([label, href]) => (
          <Link key={href} href={href} className={href === '/violations' ? 'text-brand-700 underline' : 'text-gray-600 hover:text-brand-700'}>
            {label}
          </Link>
        ))}
      </nav>

      <div className="mb-4">
        <h1 className="text-2xl font-semibold text-gray-900">Violations</h1>
      </div>

      <form action="/violations" className="mb-4 rounded border border-gray-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_180px_auto_auto]">
          <label className="text-xs font-medium uppercase tracking-wider text-gray-500">
            Association
            <select name="association" defaultValue={association} className="mt-1 h-9 w-full rounded border border-gray-300 bg-white px-2 text-sm normal-case tracking-normal text-gray-900">
              <option value="all">Select Legal to Search</option>
              {(associations ?? []).map((item: any) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium uppercase tracking-wider text-gray-500">
            Text Search
            <input name="q" defaultValue={q} className="mt-1 h-9 w-full rounded border border-gray-300 bg-white px-2 text-sm normal-case tracking-normal text-gray-900" />
          </label>
          <input type="hidden" name="status" value={status} />
          <div className="flex items-end gap-2">
            <button className="h-9 rounded border border-gray-900 bg-white px-4 text-sm font-medium text-gray-900" type="submit">Search</button>
            <Link href="/violations" className="inline-flex h-9 items-center rounded border border-gray-300 px-4 text-sm font-medium text-gray-900">Clear Filters</Link>
          </div>
        </div>
      </form>

      <div className="mb-3 border-b border-gray-200">
        <nav className="flex flex-wrap gap-1">
          {STATUS_TABS.map((tab) => (
            <Link
              key={tab.key}
              href={`/violations?status=${tab.key}${association !== 'all' ? `&association=${association}` : ''}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
              className={`border-b-2 px-3 py-2 text-sm font-medium ${status === tab.key ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-600 hover:text-gray-900'}`}
            >
              {tab.label} <span className="ml-1 text-xs text-gray-400">({count(tab.key)})</span>
            </Link>
          ))}
        </nav>
      </div>

      <div className="overflow-hidden rounded border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-600">
            <tr>
              <th className="w-8 px-3 py-2"><input type="checkbox" aria-label="Select all violations" /></th>
              <th className="px-3 py-2 text-left font-semibold">Report Date</th>
              <th className="px-3 py-2 text-left font-semibold">Due Date</th>
              <th className="px-3 py-2 text-left font-semibold">Hearing Date</th>
              <th className="px-3 py-2 text-left font-semibold">Attachments</th>
              <th className="px-3 py-2 text-left font-semibold">Association</th>
              <th className="px-3 py-2 text-left font-semibold">Unit</th>
              <th className="px-3 py-2 text-left font-semibold">Rule</th>
              <th className="px-3 py-2 text-left font-semibold">Source</th>
              <th className="px-3 py-2 text-left font-semibold">Status</th>
              <th className="px-3 py-2 text-left font-semibold">Most Recent Activity</th>
              <th className="px-3 py-2 text-left font-semibold">To Do Task</th>
              <th className="px-3 py-2 text-left font-semibold">Fine Followup</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((violation: any) => (
              <tr key={violation.id} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="px-3 py-2"><input type="checkbox" aria-label={`Select ${violation.title}`} /></td>
                <td className="whitespace-nowrap px-3 py-2 text-gray-700">{date(violation.reported_date ?? violation.date_observed)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-gray-700">{date(violation.due_date)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-gray-700">{date(violation.hearing_date)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-gray-700">
                  {attachmentCount(violation.attachments) > 0 ? (
                    <span className="font-medium text-blue-700">{attachmentCount(violation.attachments)} file{attachmentCount(violation.attachments) === 1 ? '' : 's'}</span>
                  ) : '-'}
                </td>
                <td className="px-3 py-2 text-gray-900">{violation.associations?.name ?? '-'}</td>
                <td className="whitespace-nowrap px-3 py-2">{violation.units?.unit_number ?? '-'}</td>
                <td className="px-3 py-2">
                  <Link href={`/violations?status=${violation.status}`} className="font-medium text-blue-700 hover:underline">
                    {violation.title}
                  </Link>
                  <div className="text-xs text-gray-500">{String(violation.violation_type ?? '').replace(/_/g, ' ')}</div>
                </td>
                <td className="px-3 py-2 text-gray-700">{violation.owners?.full_name ?? 'In Progress'}</td>
                <td className="px-3 py-2"><StatusPill status={violation.status} /></td>
                <td className="px-3 py-2 text-gray-700">
                  {violation.description ?? 'Violation created'}
                  <div className="text-xs text-gray-500">{date(violation.date_observed)}</div>
                </td>
                <td className="px-3 py-2">{taskLabel(violation.status)}</td>
                <td className="px-3 py-2">{violation.fine_amount ? money(violation.fine_amount) : '-'}</td>
                <td className="px-3 py-2 text-right text-blue-700">⌄</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <div className="px-6 py-10 text-center text-sm text-gray-500">No violations match this view.</div>
        )}
        <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 text-xs text-gray-600">
          <span>Displaying 1-{rows.length} of {(violations ?? []).length}</span>
          <div className="flex gap-2 text-blue-700">
            <span>«</span><span>‹</span><span className="font-semibold text-gray-900">1</span><span>›</span><span>»</span>
          </div>
        </div>
      </div>

      <div className="mt-4 text-xs font-semibold">
        <Link href="/settings" className="text-brand-700 hover:underline">Privacy</Link>
        <span className="mx-1 text-gray-400">|</span>
        <Link href="/letters" className="text-brand-700 hover:underline">Help & Training</Link>
        <span className="mx-1 text-gray-400">|</span>
        <Link href="/reports/violation_log" className="text-brand-700 hover:underline">Notice Suggestions</Link>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const cls: Record<string, string> = {
    open: 'bg-amber-100 text-amber-800',
    notice_sent: 'bg-blue-100 text-blue-700',
    hearing_pending: 'bg-purple-100 text-purple-700',
    fined: 'bg-red-100 text-red-700',
    cured: 'bg-green-100 text-green-700',
    closed: 'bg-gray-100 text-gray-600',
  };
  return (
    <span className={`rounded px-2 py-0.5 text-xs font-medium capitalize ${cls[status] ?? 'bg-gray-100 text-gray-700'}`}>
      {String(status ?? 'open').replace(/_/g, ' ')}
    </span>
  );
}

function attachmentCount(attachments: unknown) {
  if (!attachments) return 0;
  if (Array.isArray(attachments)) return attachments.length;
  if (typeof attachments === 'object') return Object.keys(attachments).length;
  return 0;
}

function taskLabel(status: string | null) {
  if (status === 'hearing_pending') return 'Schedule hearing';
  if (status === 'notice_sent') return 'Monitor cure date';
  if (status === 'fined') return 'Review fine';
  if (status === 'cured') return 'Confirm closeout';
  if (status === 'closed') return '-';
  return 'Send notice';
}
