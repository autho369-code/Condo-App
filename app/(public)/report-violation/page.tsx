import { createServiceClient } from '@/lib/supabase/server';
import ReportViolationForm from './report-violation-form';
import { submitReport } from './actions';

export const dynamic = 'force-dynamic';

export default async function ReportViolationPage({
  searchParams,
}: {
  searchParams: Promise<{ assoc?: string; error?: string }>;
}) {
  // Anonymous visitors have no RLS read access to associations, so this
  // public intake page loads its dropdown data via the service client
  // (server component only; nothing reaches the browser but id + name).
  const supabase = createServiceClient();
  const sp = await searchParams;
  const errorMessage =
    sp.error === 'missing' ? 'Please complete all required fields and sign the report.' :
    sp.error === 'save' ? 'We could not save your report. Please try again, or contact your management office directly.' :
    sp.error === 'rate-limit' ? 'Too many reports were received. Please wait and try again, or contact your management office directly.' :
    sp.error === 'unavailable' ? 'Reporting is temporarily unavailable. Please try again shortly, or contact your management office directly.' :
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
