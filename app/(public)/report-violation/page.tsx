import { createServiceClient } from '@/lib/supabase/server';
import ReportViolationForm from './report-violation-form';
import { submitReport } from './actions';

export const dynamic = 'force-dynamic';

function UnavailableReport() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900" role="alert">
        Public violation reporting is not configured for this environment. Please contact your management office directly.
      </div>
    </main>
  );
}

export default async function ReportViolationPage({
  searchParams,
}: {
  searchParams: Promise<{ assoc?: string; error?: string }>;
}) {
  const sp = await searchParams;

  // Anonymous visitors have no RLS read access to associations, so this public
  // page uses a server-only service client. Preview environments intentionally
  // fail closed rather than inheriting production administrator credentials.
  let supabase: ReturnType<typeof createServiceClient>;
  try {
    supabase = createServiceClient();
  } catch (error) {
    console.error('public violation reporting is unavailable:', error instanceof Error ? error.message : 'configuration error');
    return <UnavailableReport />;
  }

  const { data: associations, error: associationsError } = await (supabase as any)
    .from('associations')
    .select('id,name')
    .is('archived_at', null)
    .order('name');

  if (associationsError) {
    console.error('public violation association lookup failed:', associationsError.message);
    return <UnavailableReport />;
  }

  const assocId = sp.assoc;
  let rules: any[] = [];
  if (assocId) {
    const { data, error } = await (supabase as any)
      .from('house_rules')
      .select('*')
      .eq('association_id', assocId)
      .eq('active', true)
      .order('sort_order');

    if (error) {
      console.error('public violation rule lookup failed:', error.message);
      return <UnavailableReport />;
    }
    rules = data ?? [];
  }

  const errorMessage =
    sp.error === 'missing' ? 'Please complete all required fields and sign the report.' :
    sp.error === 'save' ? 'We could not save your report. Please try again, or contact your management office directly.' :
    sp.error === 'rate-limit' ? 'Too many reports were received. Please wait and try again, or contact your management office directly.' :
    sp.error === 'unavailable' ? 'Reporting is temporarily unavailable. Please try again shortly, or contact your management office directly.' :
    null;

  return (
    <>
      {errorMessage && (
        <div className="mx-auto mt-6 max-w-3xl rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {errorMessage}
        </div>
      )}
      <ReportViolationForm
        associations={associations ?? []}
        rules={rules}
        assocId={assocId}
        submitReport={submitReport}
      />
    </>
  );
}
