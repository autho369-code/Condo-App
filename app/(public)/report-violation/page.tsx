import { createServiceClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import ReportViolationForm from './report-violation-form';

export const dynamic = 'force-dynamic';

async function submitReport(formData: FormData) {
  'use server';
  const report = {
    association_id: formData.get('association_id') as string,
    reporter_name: formData.get('reporter_name') as string,
    reporter_unit: formData.get('reporter_unit') as string || null,
    reporter_contact: formData.get('reporter_contact') as string,
    reporter_is_owner: formData.get('reporter_is_owner') === 'yes',
    violator_name: formData.get('violator_name') as string || null,
    violator_unit: formData.get('violator_unit') as string || null,
    house_rule_id: (formData.get('house_rule_id') as string) || null,
    violation_type: formData.get('violation_type') as string,
    violation_description: formData.get('violation_description') as string,
    dates_times: formData.get('dates_times') as string || null,
    witnesses: formData.get('witnesses') as string || null,
    previously_reported: formData.get('previously_reported') === 'yes',
    requested_action: formData.get('requested_action') as string || 'warning',
    reporter_signature: formData.get('reporter_signature') as string,
    ack_share_info: formData.get('ack_share_info') === 'on',
    ack_true_accurate: formData.get('ack_true_accurate') === 'on',
    ack_may_contact: formData.get('ack_may_contact') === 'on',
  };

  // Save AI analysis data if provided
  const aiSeverity = formData.get('ai_severity') as string || null;
  const aiConfidence = formData.get('ai_confidence') as string || null;
  if (aiSeverity) (report as any).ai_severity = aiSeverity;
  if (aiConfidence) (report as any).ai_confidence = parseInt(aiConfidence, 10);

  // Server-side required-field validation (the client form also enforces these,
  // but a public endpoint must not rely on that).
  if (!report.association_id || !report.reporter_name || !report.reporter_contact ||
      !report.violation_description || !report.reporter_signature) {
    redirect(`/report-violation?error=missing${report.association_id ? `&assoc=${report.association_id}` : ''}`);
  }

  // Public (anonymous) reporters have no violation_cases INSERT policy under
  // RLS, so this controlled, validated insert runs with the service client —
  // server action only; nothing is exposed to the browser.
  const service = createServiceClient();
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
