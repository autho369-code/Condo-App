import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireOwner } from '@/lib/auth/me';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/card';
import { buttonClass } from '@/components/ui/button';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { StatusChip } from '@/components/operations/status-chip';
import { ARC_STATUS_TONE, arcStatusLabel } from '@/components/architectural/status';
import { date } from '@/lib/utils';
import { Alert } from '@/components/ui/shell';
import { loadOwnArcContext } from '@/lib/portal/arc-context';

export const dynamic = 'force-dynamic';

const LIST_LIMIT = 500;

const CATEGORY_LABEL: Record<string, string> = {
  exterior_paint: 'Exterior paint',
  fence: 'Fence',
  landscaping: 'Landscaping',
  roof: 'Roof',
  addition: 'Addition',
  deck_patio: 'Deck / patio',
  windows_doors: 'Windows / doors',
  solar: 'Solar',
  pool: 'Pool',
  other: 'Other',
};

export default async function OwnerArchitecturalList({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const me = await requireOwner();
  const { error } = await searchParams;
  const supabase = await createClient();

  const [{ data: rows, error: rowsError, count: total }, context] = await Promise.all([
    (supabase as any)
      .from('architectural_requests')
      .select('id, title, category, status, created_at, units(unit_number)', { count: 'exact' })
      .in('owner_id', me.owner_ids) // board members can read every request; show only mine
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(LIST_LIMIT),
    loadOwnArcContext(supabase, me.owner_ids),
  ]);
  // Submitting online is offered when at least one of the owner's
  // associations takes requests online.
  const canSubmit = context.associations.some((a) => !a.instructions.online_requests_disabled);
  const notes = context.associations.filter((a) => a.instructions.portal_homepage_html);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-[26px] font-bold leading-[1.12] tracking-[-0.025em] text-ink [text-wrap:balance] sm:text-[30px]">Architectural requests</h1>
          <p className="mt-2 max-w-3xl text-[15px] leading-6 text-gray-500">Request approval before modifying the exterior of your home, and track the review.</p>
        </div>
        {canSubmit && <Link href="/portal/architectural/new" className={buttonClass('primary', 'lg')}>+ New request</Link>}
      </div>

      {error && <Alert tone="danger" title="Something went wrong.">{error}</Alert>}
      {rowsError && <Alert tone="danger" title="Could not load your requests.">{rowsError.message ?? String(rowsError)}</Alert>}
      {context.error && <Alert tone="danger" title="Could not load your association's settings.">{context.error}</Alert>}
      {!context.error && context.associations.length > 0 && !canSubmit && (
        <Alert tone="info">Your association doesn&apos;t take architectural requests online. Contact your management office to submit one.</Alert>
      )}
      {notes.map((a) => (
        <Card key={a.id}>
          <CardBody>
            {notes.length > 1 && <div className="mb-1 text-[13px] font-medium text-gray-500">{a.name}</div>}
            <p className="whitespace-pre-wrap text-sm leading-6 text-gray-700">{a.instructions.portal_homepage_html}</p>
          </CardBody>
        </Card>
      ))}

      <Card>
        <CardHeader><CardTitle>Your requests</CardTitle></CardHeader>
        <CardBody>
          {(total ?? 0) > (rows?.length ?? 0) && (
            <p className="mb-3 text-[13px] text-gray-500">Showing the newest {(rows?.length ?? 0).toLocaleString()} of {(total ?? 0).toLocaleString()} requests.</p>
          )}
          {rows && rows.length > 0 ? (
            <Table>
              <THead>
                <TR>
                  <TH>Request</TH>
                  <TH>Type</TH>
                  <TH>Unit</TH>
                  <TH>Status</TH>
                  <TH>Submitted</TH>
                </TR>
              </THead>
              <tbody>
                {rows.map((r: any) => (
                  <TR key={r.id}>
                    <TD className="max-w-xs">
                      <Link href={`/portal/architectural/${r.id}`} className="font-medium text-gray-900 hover:text-gray-950 hover:underline">
                        {r.title}
                      </Link>
                    </TD>
                    <TD className="whitespace-nowrap text-sm text-gray-600">{CATEGORY_LABEL[r.category] ?? 'Other'}</TD>
                    <TD className="whitespace-nowrap text-sm text-gray-600">Unit {r.units?.unit_number ?? '—'}</TD>
                    <TD><StatusChip tone={ARC_STATUS_TONE[r.status] ?? 'neutral'}>{arcStatusLabel(r.status)}</StatusChip></TD>
                    <TD className="whitespace-nowrap text-sm text-gray-600">{date(r.created_at)}</TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          ) : (
            <div className="py-8 text-center">
              <p className="text-sm text-gray-500">You haven&apos;t submitted any architectural requests yet.</p>
              {canSubmit && (
                <Link href="/portal/architectural/new" className="mt-2 inline-block text-sm font-medium text-gray-700 hover:text-gray-950 hover:underline">
                  Submit your first request →
                </Link>
              )}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
