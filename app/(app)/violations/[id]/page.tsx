import Link from 'next/link';
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { MetricStrip } from '@/components/operations/metric-strip';
import { StatusChip } from '@/components/operations/status-chip';
import { ViolationLetterDrafter } from '@/components/ai/violation-letter-drafter';
import { Button } from '@/components/ui/button';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { date, money } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function ViolationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  const supabase = await createClient();
  const db = supabase as any;

  const [{ data: violation }, { data: updates }] = await Promise.all([
    db.from('violations')
      .select('id, title, description, violation_type, status, date_observed, due_date, hearing_date, reported_date, fine_amount, fine_assessed_at, closed_at, cured_at, attachments, associations(name), units(unit_number), owners(full_name)')
      .eq('id', id)
      .maybeSingle(),
    db.from('violation_updates')
      .select('id, note, new_status, created_at, profiles(full_name)')
      .eq('violation_id', id)
      .order('created_at', { ascending: false }),
  ]);

  if (!violation) notFound();
  const attachmentCount = Array.isArray(violation.attachments) ? violation.attachments.length : 0;

  return (
    <DataWorkspace
      title={violation.title}
      description={`${violation.associations?.name ?? 'Association'}${violation.units?.unit_number ? ` - Unit ${violation.units.unit_number}` : ''}${violation.owners?.full_name ? ` - ${violation.owners.full_name}` : ''}`}
      actions={<><Link href="/violations"><Button variant="secondary">Back</Button></Link><Button>Preview notice</Button></>}
      rail={<DetailRail />}
    >
      <div className="space-y-6">
        <MetricStrip metrics={[
          { label: 'Status', value: <StatusChip tone={violation.status === 'closed' || violation.status === 'cured' ? 'success' : 'warning'}>{formatStatus(violation.status)}</StatusChip> },
          { label: 'Observed', value: date(violation.date_observed) },
          { label: 'Due date', value: date(violation.due_date) },
          { label: 'Fine', value: violation.fine_amount ? money(violation.fine_amount) : '-' },
        ]} />

        <section className="rounded-2xl border border-gray-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <h2 className="text-sm font-semibold text-gray-950">Violation details</h2>
          <div className="mt-4 grid gap-4 text-sm md:grid-cols-2">
            <Info label="Type" value={formatStatus(violation.violation_type)} />
            <Info label="Reported" value={date(violation.reported_date)} />
            <Info label="Hearing" value={date(violation.hearing_date)} />
            <Info label="Fine assessed" value={date(violation.fine_assessed_at)} />
          </div>
          <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-gray-700">{violation.description ?? 'No description provided.'}</p>
        </section>

        <section className="rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <div className="border-b border-gray-100 px-5 py-3"><h2 className="text-sm font-semibold text-gray-950">Timeline</h2></div>
          {(updates ?? []).length > 0 ? (
            <div className="divide-y divide-gray-100">
              {(updates ?? []).map((update: any) => (
                <div key={update.id} className="px-5 py-4">
                  <div className="flex items-center justify-between text-xs text-gray-500"><span>{update.profiles?.full_name ?? 'Staff'}</span><span>{date(update.created_at)}</span></div>
                  <p className="mt-2 text-sm text-gray-700">{update.note}</p>
                  {update.new_status && <div className="mt-2"><StatusChip tone="info">{formatStatus(update.new_status)}</StatusChip></div>}
                </div>
              ))}
            </div>
          ) : (
            <div className="px-5 py-8 text-center text-sm text-gray-500">No updates recorded yet.</div>
          )}
        </section>

        <ViolationLetterDrafter violationId={violation.id} />

        <section className="rounded-2xl border border-gray-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <h2 className="text-sm font-semibold text-gray-950">Evidence and documents</h2>
          <p className="mt-2 text-sm text-gray-500">{attachmentCount} attachment records on file. Upload and outbound delivery controls should require confirmation.</p>
        </section>
      </div>
    </DataWorkspace>
  );
}

function DetailRail() {
  return <div className="space-y-3 text-sm text-gray-600"><h2 className="text-sm font-semibold text-gray-950">Next steps</h2><p>Review evidence, preview owner notice, confirm hearing date, then record follow-up updates.</p><Link href="/reports/violation_log" className="block rounded border border-gray-200 px-3 py-2 font-medium text-gray-700 hover:bg-gray-50">Violation log report</Link></div>;
}

function Info({ label, value }: { label: string; value: ReactNode }) {
  return <div><div className="text-xs font-medium uppercase text-gray-500">{label}</div><div className="mt-1 text-gray-900">{value}</div></div>;
}

function formatStatus(value: string | null | undefined) {
  return value ? value.replace(/_/g, ' ') : 'Not set';
}
