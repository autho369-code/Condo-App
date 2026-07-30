import { NextResponse } from 'next/server';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { generateCheckRunPdf, type PrintableCheck } from '@/lib/payments/check-pdf';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  const supabase = await createClient();
  const { data: seed } = await (supabase as any)
    .from('payable_checks')
    .select('run_transaction_id')
    .eq('id', id)
    .maybeSingle();
  if (!seed) return NextResponse.json({ error: 'Check run not found.' }, { status: 404 });

  const { data: checks, error } = await (supabase as any)
    .from('payable_checks')
    .select(`
      id, bill_id, check_number, amount, payment_date, status, void_reason, authorized_signer_label, authorization_acknowledged_at,
      vendors(name, address_street, address_city, address_state, address_zip),
      associations(name),
      bank_accounts(name, bank_name, company_name, company_address),
      payable_bills(bill_number, memo, bill_date, due_date, gl_accounts(number, name))
    `)
    .eq('run_transaction_id', seed.run_transaction_id)
    .order('check_number')
    .limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!checks?.length) return NextResponse.json({ error: 'Check run is empty.' }, { status: 404 });

  const pdf = generateCheckRunPdf(checks as PrintableCheck[]);
  const first = checks[0].check_number;
  const last = checks[checks.length - 1].check_number;
  const range = first === last ? String(first) : `${first}-${last}`;
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="check-run-${range}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
