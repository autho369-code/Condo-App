import { headers } from 'next/headers';
import { createServiceClient } from '@/lib/supabase/server';
import { tenantFromHeaders } from '@/lib/tenant/resolve';
import { Alert } from '@/components/ui/shell';
import ReportViolationForm from './report-violation-form';
import { submitReport } from './actions';

export const dynamic = 'force-dynamic';

function UnavailableReport({ children }: { children?: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <Alert tone="warning">
        {children ?? 'Public violation reporting is not configured for this environment. Please contact your management office directly.'}
      </Alert>
    </div>
  );
}

export default async function ReportViolationPage({
  searchParams,
}: {
  searchParams: Promise<{ assoc?: string; error?: string }>;
}) {
  const sp = await searchParams;

  // Reports go to one management company: the one whose address this is
  // (its <slug>.portier369.com workspace or custom domain). Without a company
  // host there is nothing to list - never every company's associations.
  const tenant = tenantFromHeaders(await headers());
  if (!tenant) {
    return (
      <UnavailableReport>
        To report a violation, use the reporting link from your management company. Please contact your management office if you do not have it.
      </UnavailableReport>
    );
  }

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
    .eq('portfolio_id', tenant.portfolioId)
    .is('archived_at', null)
    .order('name');

  if (associationsError) {
    console.error('public violation association lookup failed:', associationsError.message);
    return <UnavailableReport />;
  }

  // Only an association of this company can be preselected.
  const assocId = (associations ?? []).some((a: { id: string }) => a.id === sp.assoc) ? sp.assoc : undefined;
  let rules: any[] = [];
  if (assocId) {
    const { data, error } = await (supabase as any)
      .from('house_rules')
      .select('id, rule_number, title, description, category, penalty_type, fine_amount')
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
    sp.error === 'association' ? 'That association is not managed here. Choose your association from the list.' :
    sp.error === 'save' ? 'We could not save your report. Please try again, or contact your management office directly.' :
    sp.error === 'rate-limit' ? 'Too many reports were received. Please wait and try again, or contact your management office directly.' :
    sp.error === 'unavailable' ? 'Reporting is temporarily unavailable. Please try again shortly, or contact your management office directly.' :
    null;

  return (
    <>
      {errorMessage && (
        <div className="mx-auto mt-6 max-w-3xl px-4">
          <Alert tone="danger">{errorMessage}</Alert>
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
