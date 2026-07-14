import Link from 'next/link';
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { FileText, MapPin } from 'lucide-react';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { MetricStrip } from '@/components/operations/metric-strip';
import { StatusChip } from '@/components/operations/status-chip';
import { ViolationLetterDrafter } from '@/components/ai/violation-letter-drafter';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/shell';
import { requireStaff } from '@/lib/auth/me';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { date, money } from '@/lib/utils';

export const dynamic = 'force-dynamic';

// Photos/evidence live in the private records bucket (same one the
// architectural attachments use); links are signed at render time.
const ATTACH_BUCKET = 'association-documents';

export default async function ViolationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  await requireStaff();
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();
  const db = supabase as any;

  const [{ data: violation }, { data: updates }] = await Promise.all([
    db.from('violations')
      // '*' so the page keeps working whether or not the field-capture GPS
      // migration (location_lat/lng/accuracy) has been applied yet.
      .select('*, associations(name), units(unit_number), owners(full_name)')
      .eq('id', id)
      .maybeSingle(),
    db.from('violation_updates')
      .select('id, note, new_status, created_at, profiles(full_name)')
      .eq('violation_id', id)
      .order('created_at', { ascending: false }),
  ]);

  if (!violation) notFound();

  // Attachments: written by the field-capture flow as
  // [{ name, path, size, uploaded_at, ... }] (same shape as
  // architectural_requests.attachments); tolerate legacy string/url entries.
  const rawAttachments: any[] = Array.isArray(violation.attachments) ? violation.attachments : [];
  const attachments = rawAttachments
    .map((a: any, idx: number) => {
      if (typeof a === 'string') return { name: `File ${idx + 1}`, path: a, size: undefined as number | undefined };
      const path = a?.path ?? a?.url ?? '';
      return path ? { name: a?.name ?? a?.label ?? `File ${idx + 1}`, path, size: a?.size as number | undefined } : null;
    })
    .filter(Boolean) as Array<{ name: string; path: string; size?: number }>;

  // Sign viewing links for storage paths (http(s) entries pass through as-is).
  const linkByPath = new Map<string, string>();
  const pathsToSign = attachments.map((a) => a.path).filter((p) => !/^https?:\/\//i.test(p));
  if (pathsToSign.length > 0) {
    try {
      const svc = createServiceClient() as any;
      const { data: signed } = await svc.storage.from(ATTACH_BUCKET).createSignedUrls(pathsToSign, 3600);
      for (const s of signed ?? []) if (s?.path && s?.signedUrl) linkByPath.set(s.path, s.signedUrl);
    } catch {}
  }
  const hrefFor = (path: string) => (/^https?:\/\//i.test(path) ? path : linkByPath.get(path) ?? null);
  const isImage = (name: string, path: string) => /\.(jpg|jpeg|png|gif|webp|heic)$/i.test(name) || /\.(jpg|jpeg|png|gif|webp|heic)$/i.test(path);

  const lat = typeof violation.location_lat === 'number' ? violation.location_lat : null;
  const lng = typeof violation.location_lng === 'number' ? violation.location_lng : null;
  const hasGps = lat !== null && lng !== null;

  return (
    <DataWorkspace
      title={violation.title}
      description={`${violation.associations?.name ?? 'Association'}${violation.units?.unit_number ? ` - Unit ${violation.units.unit_number}` : ''}${violation.owners?.full_name ? ` - ${violation.owners.full_name}` : ''}`}
      actions={<><Link href="/violations"><Button variant="secondary">Back</Button></Link><Link href="/documents/generate?type=violation_notice"><Button>Generate notice</Button></Link></>}
      rail={<DetailRail />}
    >
      <div className="space-y-6">
        {sp.error && <Alert tone="danger" title="Heads up">{sp.error}</Alert>}
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
            {hasGps && (
              <Info
                label="Location"
                value={
                  <a
                    href={`https://www.google.com/maps?q=${lat},${lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 font-medium text-gray-900 hover:text-gray-950 hover:underline"
                  >
                    <MapPin className="h-4 w-4 text-gray-400" /> View on map
                    {typeof violation.location_accuracy_m === 'number' && (
                      <span className="font-normal text-gray-400">±{Math.round(violation.location_accuracy_m)} m</span>
                    )}
                  </a>
                }
              />
            )}
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
          {attachments.length === 0 ? (
            <p className="mt-2 text-sm text-gray-500">No photos or documents on file. Use <Link href="/violations/field" className="font-medium text-gray-700 hover:text-gray-950 hover:underline">field capture</Link> to attach photos from the property.</p>
          ) : (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {attachments.map((att, idx) => {
                const href = hrefFor(att.path);
                const body = isImage(att.name, att.path) && href ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={href} alt={att.name} className="h-28 w-full object-cover transition-opacity hover:opacity-80" />
                ) : (
                  <div className="flex h-28 w-full flex-col items-center justify-center gap-1.5 px-2 text-center">
                    <FileText className="h-6 w-6 text-gray-400" />
                    <span className="line-clamp-2 text-xs text-gray-600">{att.name}</span>
                  </div>
                );
                return (
                  <div key={`${att.path}-${idx}`} className="overflow-hidden rounded-xl border border-gray-200/70 bg-gray-50/60">
                    {href ? (
                      <a href={href} target="_blank" rel="noopener noreferrer" className="block">{body}</a>
                    ) : (
                      body
                    )}
                    <div className="truncate border-t border-gray-200/70 bg-white px-2.5 py-1.5 text-xs text-gray-500" title={att.name}>{att.name}</div>
                  </div>
                );
              })}
            </div>
          )}
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
