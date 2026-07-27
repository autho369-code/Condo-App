import { createServiceClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import ReportViolationForm from './report-violation-form';

export const dynamic = 'force-dynamic';

const VIOLATION_TYPES = new Set([
  'noise', 'construction', 'pet', 'parking', 'harassment', 'smoking',
  'waste', 'subletting', 'balcony', 'other',
]);
const REQUESTED_ACTIONS = new Set(['warning', 'fine', 'hearing']);
const AI_SEVERITIES = new Set(['low', 'medium', 'high', 'critical']);

function field(formData: FormData, name: string, maxLength: number): string | null {
  const value = formData.get(name);
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

async function submitReport(formData: FormData) {
  'use server';
  const violationType = field(formData, 'violation_type', 40);
  const requestedAction = field(formData, 'requested_action', 40) ?? 'warning';
  const report = {
    association_id: field(formData, 'association_id', 64),
    reporter_name: field(formData, 'reporter_name', 200),
    reporter_unit: field(formData, 'reporter_unit', 100),
    reporter_contact: field(formData, 'reporter_contact', 320),
    reporter_is_owner: formData.get('reporter_is_owner') === 'yes',
    violator_name: field(formData, 'violator_name', 200),
    violator_unit: field(formData, 'violator_unit', 100),
    house_rule_id: field(formData, 'house_rule_id', 64),
    violation_type: violationType,
    violation_description: field(formData, 'violation_description', 5000),
    dates_times: field(formData, 'dates_times', 1000),
    witnesses: field(formData, 'witnesses', 2000),
    previously_reported: formData.get('previously_reported') === 'yes',
    requested_action: requestedAction,
    reporter_signature: field(formData, 'reporter_signature', 300),
    ack_share_info: formData.get('ack_share_info') === 'on',
    ack_true_accurate: formData.get('ack_true_accurate') === 'on',
    ack_may_contact: formData.get('ack_may_contact') === 'on',
  };

  // Save AI analysis data if provided
  const aiSeverity = field(formData, 'ai_severity', 20);
  const aiConfidence = Number.parseInt(field(formData, 'ai_confidence', 3) ?? '', 10);
  if (aiSeverity && AI_SEVERITIES.has(aiSeverity)) (report as any).ai_severity = aiSeverity;
  if (Number.isFinite(aiConfidence)) (report as any).ai_confidence = Math.max(0, Math.min(100, aiConfidence));

  // Server-side required-field validation (the client form also enforces these,
  // but a public endpoint must not rely on that).
  if (!report.association_id || !report.reporter_name || !report.reporter_contact ||
      !report.violation_description || !report.reporter_signature ||
      !violationType || !VIOLATION_TYPES.has(violationType) ||
      !REQUESTED_ACTIONS.has(requestedAction) ||
      !report.ack_share_info || !report.ack_true_accurate || !report.ack_may_contact) {
    redirect(`/report-violation?error=missing${report.association_id ? `&assoc=${report.association_id}` : ''}`);
  }

  // Public (anonymous) reporters have no violation_cases INSERT policy under
  // RLS, so this controlled, validated insert runs with the service client —
  // server action only; nothing is exposed to the browser.
  const service = createServiceClient();
  const { data: association } = await (service as any)
    .from('associations')
    .select('id')
    .eq('id', report.association_id)
    .is('archived_at', null)
    .maybeSingle();
  if (!association) redirect('/report-violation?error=missing');

  if (report.house_rule_id) {
    const { data: rule } = await (service as any)
      .from('house_rules')
      .select('id')
      .eq('id', report.house_rule_id)
      .eq('association_id', report.association_id)
      .eq('active', true)
      .maybeSingle();
    if (!rule) report.house_rule_id = null;
  }

  const { error } = await (service as any).from('violation_cases').insert(report);
  if (error) {
    console.error('report-violation insert failed:', error.message);
    redirect(`/report-violation?error=save&assoc=${report.association_id}`);
  }
  redirect('/report-violation/confirmation');
}

export default async function ReportViolationPage({ searchParams }: { searchParams: Promise<{ assoc?: string; error?: string }> }) {
  // Anonymous visitors have no RLS read access to associations, so this
  // public intake page loads its dropdown data via the service client
  // (server component only; nothing reaches the browser but id + name).
  const supabase = createServiceClient();
  const sp = await searchParams;
  const errorMessage =
    sp.error === 'missing' ? 'Please complete all required fields and sign the report.' :
    sp.error === 'save' ? 'We could not save your report. Please try again, or contact your management office directly.' :
    null;

  const { data: associations } = await (supabase as any)
    .from('associations')
    .select('id,name')
    .is('archived_at', null)
    .order('name');

  const assocId = sp.assoc;
  const { data: rules } = assocId ? await (supabase as any)
    .from('house_rules')
    .select('*')
    .eq('association_id', assocId)
    .eq('active', true)
    .order('sort_order') : { data: [] };

  return (
    <>
      {errorMessage && (
        <div className="mx-auto mt-6 max-w-3xl rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {errorMessage}
        </div>
      )}
      <ReportViolationForm
        associations={associations ?? []}
        rules={rules ?? []}
        assocId={assocId}
        submitReport={submitReport}
      />
    </>
  );
}
