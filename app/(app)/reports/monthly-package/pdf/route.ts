import { NextResponse } from 'next/server';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { generateLiveExportRows } from '@/lib/reports/live-export';
import { generateMonthlyFinancialPackagePdf, prepareMonthlyPackageRows } from '@/lib/reports/monthly-package';

export const dynamic = 'force-dynamic';

const SECTIONS = [
  ['trial_balance', 'Trial Balance'],
  ['balance_sheet', 'Balance Sheet'],
  ['income_statement', 'Income Statement'],
  ['budget_vs_actual', 'Budget vs Actual'],
  ['ar_aging', 'A/R Aging'],
  ['delinquency_summary', 'Delinquency Summary'],
  ['ap_aging', 'A/P Aging'],
  ['bank_reconciliation', 'Bank Reconciliation'],
] as const;

function validDate(value: string | null): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)));
}

export async function GET(request: Request) {
  await requireStaff();
  const url = new URL(request.url);
  const associationId = url.searchParams.get('association_id');
  const dateFrom = url.searchParams.get('date_from');
  const dateTo = url.searchParams.get('date_to');
  if (!associationId || !validDate(dateFrom) || !validDate(dateTo) || dateFrom > dateTo) {
    return NextResponse.json({ error: 'A valid association and reporting period are required.' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: association, error: associationError } = await (supabase as any)
    .from('associations')
    .select('id, name, portfolio_id, portfolios(company_name)')
    .eq('id', associationId)
    .is('archived_at', null)
    .maybeSingle();
  if (associationError || !association) return NextResponse.json({ error: 'Association not found.' }, { status: 404 });

  try {
    const params = { association_id: associationId, date_from: dateFrom, date_to: dateTo, scope: 'association' };
    const sectionRows = await Promise.all(SECTIONS.map(([slug]) =>
      generateLiveExportRows(supabase as any, association.portfolio_id, slug, params),
    ));
    const pdf = generateMonthlyFinancialPackagePdf({
      associationName: association.name,
      companyName: association.portfolios?.company_name,
      dateFrom,
      dateTo,
      sections: SECTIONS.map(([slug, title], index) => ({
        title,
        rows: prepareMonthlyPackageRows(slug, sectionRows[index], dateTo),
      })),
    });
    const safeName = String(association.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'association';
    return new NextResponse(Buffer.from(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${safeName}-financial-package-${dateTo}.pdf"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? 'Monthly package generation failed.' }, { status: 500 });
  }
}
