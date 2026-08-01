import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { generateCheckRunPdf, type PrintableCheck } from '../lib/payments/check-pdf';

const STAGING_REF = 'zalfkrtjeswvfmucicea';
const billId = '36900000-0000-4000-8100-000000000081';
const url = process.env.STAGING_SUPABASE_URL;
const key = process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key || new URL(url).hostname.split('.')[0] !== STAGING_REF) {
  throw new Error('Exact staging credentials are required');
}

const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

async function main() {
  const { data: seed, error: seedError } = await db
    .from('payable_checks')
    .select('run_transaction_id, check_number')
    .eq('bill_id', billId)
    .eq('status', 'issued')
    .order('check_number', { ascending: false })
    .limit(1)
    .single();
  if (seedError || !seed) throw seedError ?? new Error('No issued staging check found');

  const { data: checks, error } = await db
    .from('payable_checks')
    .select(`
      id, check_number, amount, payment_date, status, void_reason, authorized_signer_label,
      vendors(name, address_street, address_city, address_state, address_zip),
      associations(name),
      bank_accounts(name, bank_name, company_name, company_address),
      payable_bills(bill_number, memo, bill_date, due_date, gl_accounts(number, name))
    `)
    .eq('run_transaction_id', seed.run_transaction_id)
    .order('check_number')
    .limit(100);
  if (error || !checks?.length) throw error ?? new Error('Issued check run is empty');

  const pdf = generateCheckRunPdf(checks as unknown as PrintableCheck[]);
  if (Buffer.from(pdf.subarray(0, 4)).toString() !== '%PDF') throw new Error('Generated output is not a PDF');
  if (pdf.byteLength < 3_000) throw new Error(`Generated check PDF is unexpectedly small (${pdf.byteLength} bytes)`);

  const outputDir = resolve('tmp', 'pdfs');
  const outputPath = resolve(outputDir, `staging-check-run-${seed.check_number}.pdf`);
  await mkdir(outputDir, { recursive: true });
  await writeFile(outputPath, pdf);
  console.log(`Immutable staging check run PDF (${checks.length} check): PASS`);
  console.log(outputPath);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
