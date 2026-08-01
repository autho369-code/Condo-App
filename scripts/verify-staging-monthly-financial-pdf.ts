import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { generateLiveExportRows } from '../lib/reports/live-export';
import { generateMonthlyFinancialPackagePdf, prepareMonthlyPackageRows } from '../lib/reports/monthly-package';

const STAGING_REF = 'zalfkrtjeswvfmucicea';
const portfolioId = '36900000-0000-4000-8000-000000000001';
const associationId = '36900000-0000-4000-8000-000000000011';
const dateFrom = '2026-01-01';
const dateTo = '2026-07-28';
const url = process.env.STAGING_SUPABASE_URL;
const key = process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key || new URL(url).hostname.split('.')[0] !== STAGING_REF) {
  throw new Error('Exact staging credentials are required');
}

const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
const sections = [
  ['trial_balance', 'Trial Balance'],
  ['balance_sheet', 'Balance Sheet'],
  ['income_statement', 'Income Statement'],
  ['budget_vs_actual', 'Budget vs Actual'],
  ['ar_aging', 'A/R Aging'],
  ['delinquency_summary', 'Delinquency Summary'],
  ['ap_aging', 'A/P Aging'],
  ['bank_reconciliation', 'Bank Reconciliation'],
] as const;

async function main() {
  const { data: association, error } = await db
    .from('associations')
    .select('name, portfolios(company_name)')
    .eq('id', associationId)
    .eq('portfolio_id', portfolioId)
    .single();
  if (error || !association) throw error ?? new Error('Staging association not found');

  const params = { association_id: associationId, date_from: dateFrom, date_to: dateTo, scope: 'association' };
  const rows = await Promise.all(sections.map(([slug]) => generateLiveExportRows(db, portfolioId, slug, params)));
  const pdf = generateMonthlyFinancialPackagePdf({
    associationName: association.name,
    companyName: (association.portfolios as any)?.company_name,
    dateFrom,
    dateTo,
    sections: sections.map(([slug, title], index) => ({
      title,
      rows: prepareMonthlyPackageRows(slug, rows[index], dateTo),
    })),
  });
  if (Buffer.from(pdf.subarray(0, 4)).toString() !== '%PDF') throw new Error('Generated output is not a PDF');
  if (pdf.byteLength < 10_000) throw new Error(`Generated PDF is unexpectedly small (${pdf.byteLength} bytes)`);

  const outputDir = resolve('tmp', 'pdfs');
  const outputPath = resolve(outputDir, `staging-monthly-financial-package-${dateTo}.pdf`);
  await mkdir(outputDir, { recursive: true });
  await writeFile(outputPath, pdf);
  console.log(`Monthly financial PDF generated from all ${sections.length} live staging reports: PASS`);
  console.log(outputPath);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
