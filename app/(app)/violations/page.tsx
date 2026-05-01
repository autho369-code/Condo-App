import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { date, money } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function ViolationsPage() {
  await requireStaff();
  const supabase = await createClient();
  const db = supabase as any;
  const { data: violations } = await db
    .from('violations')
    .select('id, title, violation_type, status, date_observed, due_date, cure_deadline, hearing_required, hearing_at, notice_sent_at, fine_amount, governing_document_reference, associations(name), units(unit_number), owners(full_name)')
    .is('archived_at', null)
    .order('date_observed', { ascending: false })
    .limit(200);

  const rows = violations ?? [];
  const open = rows.filter((violation: any) => !['closed', 'resolved'].includes(violation.status)).length;
  const hearings = rows.filter((violation: any) => violation.hearing_required && !violation.hearing_at).length;

  return (
    <div className="h-full overflow-y-auto bg-gray-50 px-8 py-6">
      <div className="mb-6 flex items-start justify-between gap-6">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Violations</div>
          <h1 className="mt-1 text-2xl font-semibold text-gray-900">Compliance and violation tracking</h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-500">
            Track notices, cure deadlines, hearings, fines, board decisions, disputes, attachments, and owner-facing history for Illinois association due-process workflows.
          </p>
        </div>
        <Link href="/calendar/new?type=board_meeting">
          <Button variant="secondary">Schedule hearing</Button>
        </Link>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <Metric label="Open violations" value={open} tone="text-amber-700" />
        <Metric label="Total tracked" value={rows.length} />
        <Metric label="Hearings to schedule" value={hearings} tone="text-red-700" />
        <Metric label="Notice sent" value={rows.filter((violation: any) => violation.notice_sent_at).length} tone="text-green-700" />
      </div>

      {rows.length ? (
        <Table>
          <THead>
            <TR>
              <TH>Violation</TH>
              <TH>Association / Unit</TH>
              <TH>Observed</TH>
              <TH>Cure / Hearing</TH>
              <TH>Fine</TH>
              <TH>Status</TH>
            </TR>
          </THead>
          <tbody>
            {rows.map((violation: any) => (
              <TR key={violation.id}>
                <TD>
                  <div className="font-medium text-gray-900">{violation.title}</div>
                  <div className="text-xs text-gray-500">{violation.violation_type}</div>
                  {violation.governing_document_reference && (
                    <div className="mt-1 text-xs text-gray-500">{violation.governing_document_reference}</div>
                  )}
                </TD>
                <TD>
                  <div className="text-sm text-gray-900">{violation.associations?.name ?? '-'}</div>
                  <div className="text-xs text-gray-500">
                    {violation.units?.unit_number ? `Unit ${violation.units.unit_number}` : 'No unit'}{violation.owners?.full_name ? ` - ${violation.owners.full_name}` : ''}
                  </div>
                </TD>
                <TD className="whitespace-nowrap text-sm">{date(violation.date_observed)}</TD>
                <TD className="text-sm">
                  <div>Cure: {date(violation.cure_deadline ?? violation.due_date)}</div>
                  <div className="text-xs text-gray-500">Hearing: {violation.hearing_at ? date(violation.hearing_at) : violation.hearing_required ? 'Required' : 'Not required'}</div>
                </TD>
                <TD className="whitespace-nowrap text-sm tabular-nums">{violation.fine_amount ? money(violation.fine_amount) : '-'}</TD>
                <TD>
                  <span className={`rounded px-2 py-0.5 text-xs capitalize ${
                    violation.status === 'resolved' || violation.status === 'closed' ? 'bg-green-100 text-green-700' :
                    violation.status === 'escalated' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {violation.status}
                  </span>
                </TD>
              </TR>
            ))}
          </tbody>
        </Table>
      ) : (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
          <h2 className="text-base font-semibold text-gray-900">No violations on file</h2>
          <p className="mt-1 text-sm text-gray-500">The module is ready for notices, cure deadlines, hearings, and communication history.</p>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, tone = 'text-gray-900' }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
      <div className="text-xs font-medium uppercase tracking-wider text-gray-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${tone}`}>{value}</div>
    </div>
  );
}
