import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireOwner } from '@/lib/auth/me';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { StatusChip, type Tone } from '@/components/operations/status-chip';
import { date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export const ARC_STATUS_TONE: Record<string, Tone> = {
  submitted:    'info',
  under_review: 'warning',
  more_info:    'warning',
  approved:     'success',
  denied:       'danger',
  withdrawn:    'neutral',
};

export function arcStatusLabel(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

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
  await requireOwner();
  const { error } = await searchParams;
  const supabase = await createClient();

  const { data: rows } = await (supabase as any)
    .from('architectural_requests')
    .select('id, title, category, status, created_at, units(unit_number)')
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950 sm:text-[26px]">Architectural requests</h1>
          <p className="mt-1.5 text-sm leading-6 text-gray-500">Request approval before modifying the exterior of your home, and track the review.</p>
        </div>
        <Link href="/portal/architectural/new"><Button size="lg">+ New request</Button></Link>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          <span className="font-semibold">Something went wrong:</span> {error}
        </div>
      )}

      <Card>
        <CardHeader><CardTitle>Your requests</CardTitle></CardHeader>
        <CardBody>
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
              <Link href="/portal/architectural/new" className="mt-2 inline-block text-sm font-medium text-gray-700 hover:text-gray-950 hover:underline">
                Submit your first request →
              </Link>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
