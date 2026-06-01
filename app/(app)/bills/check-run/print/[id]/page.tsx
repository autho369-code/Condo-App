// Voucher check layout sized for a standard US #10 double-window envelope.
//
// Layout: Letter (8.5" × 11") tri-folded into three equal panels of ~3.67".
//   Panel 1 (top)    = the CHECK itself
//   Panel 2 (middle) = vendor stub (attached to check; recipient keeps)
//   Panel 3 (bottom) = AP stub (we keep a copy in our files)
//
// When the page is tri-folded with panel 1 on the OUTSIDE and inserted into a
// #10 double-window envelope, the return address at the top of panel 1 aligns
// with the envelope's TOP window, and the payee address block at the
// center-left of panel 1 aligns with the BOTTOM window.
//
// Standard #10 double-window envelope windows (from bottom-left of envelope,
// envelope is 4.125" tall × 9.5" wide):
//   Top window (return):  0.375" from left, 2.625" from bottom, 4.125" × 1.0"
//   Bottom window (payee):0.875" from left, 0.5"   from bottom, 4.125" × 1.125"
//
// When letter is tri-folded with check panel out, the check becomes ~3.67" tall.
// Adjusted positions inside the check panel:
//   Return address block: 0.4" from top, 0.5" from left
//   Payee address block:  1.8" from top, 0.9" from left, within a 4"×1" box
//
// These numbers give a clean fit with "Columbian EnvyL 5990" / "Quality Park 90000"
// style #10 double-window envelopes. Most check-stock vendors use similar dims.

import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { PrintButton } from '@/components/ui/print-button';
import { Button } from '@/components/ui/button';
import { money, date } from '@/lib/utils';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

function numberToWords(amount: number): string {
  const dollars = Math.floor(amount);
  const cents = Math.round((amount - dollars) * 100);
  const ones = ['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen'];
  const tens = ['','','twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety'];
  function below1k(n: number): string {
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n/10)] + (n%10 ? '-' + ones[n%10] : '');
    return ones[Math.floor(n/100)] + ' hundred' + (n%100 ? ' ' + below1k(n%100) : '');
  }
  function toWords(n: number): string {
    if (n === 0) return 'zero';
    if (n < 1000) return below1k(n);
    if (n < 1_000_000) return below1k(Math.floor(n/1000)) + ' thousand' + (n%1000 ? ' ' + below1k(n%1000) : '');
    return below1k(Math.floor(n/1_000_000)) + ' million' + (n%1_000_000 ? ' ' + toWords(n%1_000_000) : '');
  }
  const words = toWords(dollars);
  return `${words.charAt(0).toUpperCase() + words.slice(1)} and ${cents.toString().padStart(2, '0')}/100`;
}

export default async function PrintChecksPage({
  params, searchParams,
}: { params: Promise<{ id: string }>; searchParams: Promise<{ count?: string }> }) {
  await requireStaff();
  const { id: seedBillId } = await params;
  const { count } = await searchParams;

  const supabase = await createClient();

  const { data: seed } = await (supabase as any)
    .from('payable_bills')
    .select('paid_at, bank_account_id')
    .eq('id', seedBillId)
    .maybeSingle();

  const { data: checks } = await (supabase as any)
    .from('payable_bills')
    .select(`
      id, bill_number, amount, memo, paid_at, bill_date, due_date,
      vendors(name, address_street, address_city, address_state, address_zip, taxpayer_id),
      associations(name),
      gl_accounts(number, name),
      bank_accounts(name, bank_name, company_name, company_address, routing_number, account_number, check_signature)
    `)
    .eq('paid_at', seed?.paid_at ?? '1970-01-01')
    .eq('bank_account_id', seed?.bank_account_id ?? '00000000-0000-0000-0000-000000000000')
    .order('bill_number');

  return (
    <div className="space-y-4">
      <div className="no-print flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-semibold">Check preview — {count ?? checks?.length ?? 0} check(s)</h1>
          <p className="text-sm text-slate-400">Sized for #10 double-window envelopes. Tri-fold along the perforation lines.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/bills"><Button variant="secondary">Back</Button></Link>
          <PrintButton label="Print" />
        </div>
      </div>

      <div>
        {(checks ?? []).map((c: any) => {
          const bank = c.bank_accounts;
          const v = c.vendors;
          const amt = Number(c.amount);
          const addressLines = [
            v?.name,
            v?.address_street,
            [v?.address_city, v?.address_state].filter(Boolean).join(', ') + (v?.address_zip ? ' ' + v.address_zip : ''),
          ].filter((line) => line && line.trim());

          return (
            <section key={c.id} className="check-sheet">
              {/* ========== PANEL 1: THE CHECK ========== */}
              <div className="panel check-panel">
                {/* Return address (aligns with TOP window of #10 envelope) */}
                <div className="return-addr">
                  <div className="font-semibold">{bank?.company_name ?? 'Your Management Co.'}</div>
                  <div className="whitespace-pre-line">{bank?.company_address ?? ''}</div>
                </div>

                {/* Check number + date, top-right */}
                <div className="check-meta">
                  <div className="check-num">#{c.bill_number ?? '—'}</div>
                  <div>Date: <span className="mono">{date(c.paid_at)}</span></div>
                </div>

                {/* Payee address block (aligns with BOTTOM window of #10 envelope) */}
                <div className="payee-addr">
                  {addressLines.length > 0 ? (
                    addressLines.map((line: string, i: number) => (
                      <div key={i} className={i === 0 ? 'font-semibold' : ''}>{line}</div>
                    ))
                  ) : (
                    <div className="italic text-gray-400">[vendor address missing]</div>
                  )}
                </div>

                {/* Pay to the order of (just below the payee window) */}
                <div className="pay-line">
                  <span className="label">Pay to the order of</span>
                  <span className="payee">{v?.name}</span>
                  <span className="amount-box">${amt.toFixed(2)}</span>
                </div>

                {/* Amount in words */}
                <div className="words-line">
                  <span className="words">{numberToWords(amt)}</span>
                  <span className="dollars-label">DOLLARS</span>
                </div>

                {/* Memo + signature */}
                <div className="memo-sig">
                  <div className="memo">
                    <span className="label">Memo</span>
                    <span className="memo-text">{c.memo ?? c.associations?.name ?? ''}</span>
                  </div>
                  <div className="sig">
                    <div className="sig-line"></div>
                    <div className="sig-label">Authorized signature</div>
                  </div>
                </div>

                {/* MICR line */}
                <div className="micr">
                  ⑆{bank?.routing_number ?? '000000000'}⑆ {bank?.account_number ? '*'.repeat(Math.max(0, bank.account_number.length - 4)) + bank.account_number.slice(-4) : '****'}⑈ {c.bill_number ?? ''}⑈
                </div>
              </div>

              {/* Perforation line — visual cue, real check stock already has it */}
              <div className="perf">— — — — — — — — — — — — — — — — — — — — — — — detach here — — — — — — — — — — — — — — — — — — — — — — —</div>

              {/* ========== PANEL 2: VENDOR STUB ========== */}
              <div className="panel stub-panel">
                <div className="stub-head">
                  <div className="stub-title">Payment advice — for your records</div>
                  <div className="stub-sub">{bank?.company_name ?? ''} · Check #{c.bill_number}</div>
                </div>
                <div className="stub-grid">
                  <div><div className="stub-label">Vendor</div><div>{v?.name}</div></div>
                  <div><div className="stub-label">Date</div><div>{date(c.paid_at)}</div></div>
                  <div><div className="stub-label">Association</div><div>{c.associations?.name ?? '—'}</div></div>
                  <div><div className="stub-label">Invoice / ref</div><div>{c.bill_number ?? '—'}</div></div>
                  <div><div className="stub-label">Bill date</div><div>{date(c.bill_date)}</div></div>
                  <div><div className="stub-label">Due date</div><div>{date(c.due_date)}</div></div>
                  <div className="col-span-2"><div className="stub-label">GL account</div><div>{c.gl_accounts ? `${c.gl_accounts.number} — ${c.gl_accounts.name}` : '—'}</div></div>
                  <div className="col-span-2"><div className="stub-label">Memo</div><div>{c.memo ?? '—'}</div></div>
                </div>
                <div className="stub-total">Total paid: <strong>{money(amt)}</strong></div>
              </div>

              <div className="perf">— — — — — — — — — — — — — — — — — — — — — — — detach here — — — — — — — — — — — — — — — — — — — — — — —</div>

              {/* ========== PANEL 3: AP RECORDS STUB ========== */}
              <div className="panel stub-panel">
                <div className="stub-head">
                  <div className="stub-title">AP file copy</div>
                  <div className="stub-sub">Check #{c.bill_number} · {date(c.paid_at)} · {money(amt)}</div>
                </div>
                <div className="stub-grid">
                  <div><div className="stub-label">Paid to</div><div className="font-medium">{v?.name}</div></div>
                  <div><div className="stub-label">Bank</div><div>{bank?.name ?? '—'} {bank?.bank_name ? `(${bank.bank_name})` : ''}</div></div>
                  <div><div className="stub-label">Association</div><div>{c.associations?.name ?? '—'}</div></div>
                  <div><div className="stub-label">GL</div><div>{c.gl_accounts ? `${c.gl_accounts.number}` : '—'}</div></div>
                  <div className="col-span-2"><div className="stub-label">Memo</div><div>{c.memo ?? '—'}</div></div>
                  {v?.taxpayer_id && <div className="col-span-2"><div className="stub-label">1099 (TIN on file)</div><div className="mono text-xs">ends in {String(v.taxpayer_id).slice(-4)}</div></div>}
                </div>
              </div>
            </section>
          );
        })}

        {!checks?.length && (
          <div className="no-print rounded border border-gray-200 bg-white p-8 text-center text-sm text-slate-400">
            No checks found for this run.
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        /* ============ LAYOUT ============ */
        .check-sheet { width: 8.5in; height: 11in; page-break-after: always; font-family: 'Courier New', ui-monospace, monospace; color: #000; background: white; }
        .panel { width: 8.5in; height: 3.67in; padding: 0.3in 0.5in; box-sizing: border-box; position: relative; overflow: hidden; }
        .perf { width: 8.5in; height: 0; letter-spacing: 0.08em; font-size: 9px; color: #888; text-align: center; line-height: 0; transform: translateY(-0.01in); }

        /* ============ CHECK PANEL ============ */
        .check-panel { border-bottom: 1px dashed #999; }
        .return-addr { position: absolute; top: 0.4in; left: 0.5in; font-size: 10px; line-height: 1.2; }
        .return-addr .font-semibold { font-size: 12px; font-weight: 700; }
        .check-meta { position: absolute; top: 0.35in; right: 0.5in; text-align: right; font-size: 11px; }
        .check-num { font-size: 16px; font-weight: 700; letter-spacing: 1px; margin-bottom: 2px; }
        .mono { font-family: 'Courier New', monospace; }

        /* Payee address positioned for #10 double-window envelope BOTTOM window */
        .payee-addr {
          position: absolute; top: 1.6in; left: 0.9in;
          width: 4.125in; min-height: 1.0in;
          padding: 0.05in 0.1in;
          font-size: 11px; line-height: 1.3;
          /* Box outline shows in preview but vanishes on print */
        }
        .payee-addr .font-semibold { font-size: 13px; font-weight: 700; }

        .pay-line { position: absolute; bottom: 0.9in; left: 0.5in; right: 0.5in; display: flex; align-items: flex-end; gap: 0.15in; }
        .pay-line .label { font-size: 9px; text-transform: uppercase; color: #444; width: 0.85in; line-height: 1.1; }
        .pay-line .payee { flex: 1; border-bottom: 1px solid #000; font-size: 14px; font-weight: 600; padding: 0 0.1in 0.05in; }
        .pay-line .amount-box { border: 1.5px solid #000; padding: 0.05in 0.2in; font-size: 14px; font-weight: 700; text-align: right; min-width: 1.1in; }

        .words-line { position: absolute; bottom: 0.6in; left: 0.5in; right: 0.5in; display: flex; align-items: flex-end; gap: 0.15in; }
        .words-line .words { flex: 1; border-bottom: 1px solid #000; font-size: 12px; font-style: italic; padding: 0 0.1in 0.05in; }
        .words-line .dollars-label { font-size: 9px; font-weight: 700; letter-spacing: 1px; }

        .memo-sig { position: absolute; bottom: 0.3in; left: 0.5in; right: 0.5in; display: flex; gap: 0.3in; }
        .memo { flex: 1; display: flex; align-items: flex-end; gap: 0.1in; border-bottom: 1px solid #000; }
        .memo .label { font-size: 9px; text-transform: uppercase; color: #444; }
        .memo .memo-text { flex: 1; font-size: 10px; padding-bottom: 0.03in; }
        .sig { width: 2.5in; }
        .sig-line { border-bottom: 1px solid #000; height: 0.3in; }
        .sig-label { font-size: 9px; text-transform: uppercase; color: #444; text-align: center; margin-top: 2px; }

        .micr { position: absolute; bottom: 0.1in; left: 0.5in; right: 0.5in; font-family: 'Courier New', monospace; font-size: 12px; letter-spacing: 2px; text-align: center; color: #000; }

        /* ============ STUBS ============ */
        .stub-panel { border-bottom: 1px dashed #999; font-family: -apple-system, Segoe UI, Arial, sans-serif; }
        .stub-head { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 1px solid #ccc; padding-bottom: 0.1in; margin-bottom: 0.15in; }
        .stub-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
        .stub-sub { font-size: 11px; color: #666; }
        .stub-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.15in 0.3in; font-size: 11px; line-height: 1.35; }
        .stub-grid .col-span-2 { grid-column: span 2; }
        .stub-label { font-size: 9px; text-transform: uppercase; color: #888; letter-spacing: 0.3px; margin-bottom: 2px; }
        .stub-total { margin-top: 0.15in; text-align: right; border-top: 1px solid #000; padding-top: 0.1in; font-size: 12px; }

        /* ============ ON-SCREEN PREVIEW ============ */
        @media screen {
          .check-sheet {
            margin: 1in auto 2em;
            box-shadow: 0 4px 24px rgba(0,0,0,0.1);
            background: #fff;
          }
          .panel { border: 1px dashed #ddd; }
          .payee-addr { outline: 1px dotted #60a5fa; outline-offset: -1px; background: rgba(96,165,250,0.04); }
          .return-addr { outline: 1px dotted #60a5fa; outline-offset: -1px; background: rgba(96,165,250,0.04); padding: 0.05in 0.1in; }
        }

        /* ============ PRINT ============ */
        @media print {
          @page { size: letter; margin: 0; }
          body * { visibility: hidden; }
          .check-sheet, .check-sheet * { visibility: visible; }
          .check-sheet { position: relative; margin: 0 !important; box-shadow: none !important; page-break-after: always; }
          .panel { border: none !important; }
          .payee-addr, .return-addr { outline: none !important; background: transparent !important; }
          .no-print, .print\\:hidden { display: none !important; }
        }
      `}} />
    </div>
  );
}
