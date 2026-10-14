import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ownerTenureCutoffs, ownerVisibleCharge, type TenureCutoffs } from '@/app/portal/_lib/tenure';
import { groupByAssociation, isLateFeeRemoval, ownerPaymentMethodLabel } from '@/lib/portal/ledger-rows';
import { pageCount, pageHref, pageRange, parsePage } from '@/lib/portal/paging';
import { paymentNotCompleted } from '@/lib/portal/payment-outcome';

// Owner portal fixes: tenure-scoped charges, AutoPay respecting "online
// payments off", hearing dates and fines, paging, loud read errors, failed
// payments, the shared Textarea, a Unit column, and removed late fees.

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');

const U1 = '11111111-1111-4111-8111-111111111111';
const U2 = '22222222-2222-4222-8222-222222222222';

describe('ownerVisibleCharge', () => {
  const cutoffs: TenureCutoffs = new Map([[U1, '2026-03-01'], [U2, null]]);

  it('keeps charges dated in the owner tenure', () => {
    expect(ownerVisibleCharge(cutoffs, { unit_id: U1, due_date: '2026-03-01', balance_due: 0 })).toBe(true);
    expect(ownerVisibleCharge(cutoffs, { unit_id: U2, due_date: '2001-01-01', balance_due: '0' })).toBe(true);
  });

  it('hides a paid charge from before the move-in', () => {
    expect(ownerVisibleCharge(cutoffs, { unit_id: U1, due_date: '2026-02-28', balance_due: '0.00' })).toBe(false);
  });

  it('keeps an open charge from before the move-in (the debt is real)', () => {
    expect(ownerVisibleCharge(cutoffs, { unit_id: U1, due_date: '2025-12-01', balance_due: '12.50' })).toBe(true);
  });

  it('hides a paid charge on a unit outside the owner tenure', () => {
    expect(ownerVisibleCharge(new Map(), { unit_id: U1, due_date: '2026-05-01', balance_due: 0 })).toBe(false);
  });
});

describe('ownerTenureCutoffs read errors', () => {
  const db = (result: { data: unknown; error: unknown }) => ({
    from: () => ({ select: () => ({ in: () => ({ eq: async () => result }) }) }),
  });

  it('returns the error instead of a silent empty map', async () => {
    const cutoffs = await ownerTenureCutoffs(db({ data: null, error: { message: 'boom' } }), [U1]);
    expect(cutoffs.size).toBe(0);
    expect(cutoffs.error).toContain('boom');
  });

  it('has no error on a good read', async () => {
    const cutoffs = await ownerTenureCutoffs(db({ data: [{ unit_id: U1, move_in_date: '2026-03-01' }], error: null }), [U1]);
    expect(cutoffs.get(U1)).toBe('2026-03-01');
    expect(cutoffs.error ?? null).toBeNull();
  });
});

describe('removed late fees', () => {
  it('recognises the credit a removed late fee posts', () => {
    expect(isLateFeeRemoval({ method: 'credit', reference: 'Late fee removed' })).toBe(true);
    expect(isLateFeeRemoval({ method: 'credit', reference: 'Goodwill credit' })).toBe(false);
    expect(isLateFeeRemoval({ method: 'ach', reference: 'Late fee removed' })).toBe(false);
  });

  it('labels it "Late fee removed", never as the method', () => {
    expect(ownerPaymentMethodLabel({ method: 'credit', reference: 'Late fee removed' })).toBe('Late fee removed');
    expect(ownerPaymentMethodLabel({ method: 'bank_transfer', reference: null })).toBe('bank transfer');
    expect(ownerPaymentMethodLabel({ method: null, reference: null })).toBe('payment');
  });

  it('is labelled on the ledger, the dashboard, the timeline and the AI snapshot', () => {
    const ledger = read('app/portal/ledger/page.tsx');
    expect(ledger).toContain('isLateFeeRemoval(p)');
    expect(ledger).toContain("'Late fee removed'");
    const dashboard = read('app/portal/page.tsx');
    expect(dashboard).toContain('ownerPaymentMethodLabel(p)');
    expect(dashboard).toContain("select('id, amount, payment_date, method, reference, reversed_at')");
    const timeline = read('app/portal/timeline/page.tsx');
    expect(timeline).toContain("title: 'Late fee removed'");
    expect(timeline).toContain("select('amount, payment_date, method, reference')");
    expect(read('lib/ai/owner-snapshot.ts')).toContain('isLateFeeRemoval(p)');
  });
});

describe('ledger export by association', () => {
  it('groups rows under one header per association, in order', () => {
    const groups = groupByAssociation(
      [{ association: 'Oak', id: 1 }, { association: 'Elm', id: 2 }, { association: '', id: 3 }],
      [{ association: 'Elm', id: 4 }],
      'Association',
    );
    expect(groups.map((g) => g.association)).toEqual(['Oak', 'Elm', 'Association']);
    expect(groups[1].charges.map((c) => c.id)).toEqual([2]);
    expect(groups[1].payments.map((p) => p.id)).toEqual([4]);
  });

  it('keeps two associations with the same name apart (grouped by id)', () => {
    const groups = groupByAssociation(
      [{ association: 'Oak', associationId: 'a1', id: 1 }, { association: 'Oak', associationId: 'a2', id: 2 }],
      [],
      'Association',
    );
    expect(groups.length).toBe(2);
    expect(groups.map((g) => g.association)).toEqual(['Oak', 'Oak']);
  });

  it('a chargeback never claims the whole payment was taken back', () => {
    const body = paymentNotCompleted('chargeback')!.body('$100.00');
    expect(body).not.toContain('no longer counts');
    expect(body).toContain('Your ledger shows any amount taken back');
  });

  it('still has one section when there are no rows', () => {
    expect(groupByAssociation([], [], 'Oak')).toEqual([{ association: 'Oak', charges: [], payments: [] }]);
  });

  it('ledger hides out-of-tenure paid charges, adds a Unit column and per-association export headers', () => {
    const ledger = read('app/portal/ledger/page.tsx');
    expect(ledger).toContain('.filter((c) => ownerVisibleCharge(tenure, c))');
    expect(ledger).toContain('const exportCharges: LedgerChargeRow[] = charges.map(');
    expect(ledger).toContain('<TH>Date</TH><TH>Unit</TH><TH>Description</TH>');
    expect(ledger).toContain('<TH>Date</TH><TH>Unit</TH><TH>Method</TH>');
    expect(ledger).toContain("units(unit_number)')");
    expect(ledger).toContain('tenure.error');
    const actions = read('components/portal/ledger-actions.tsx');
    expect(actions).toContain('groupByAssociation(charges, payments, associationName)');
    expect(actions).toContain("['Date', 'Unit', 'Description', 'Amount', 'Paid', 'Balance', 'Status']");
    expect(actions).toContain("['Date', 'Unit', 'Method', 'Reference', 'Amount', 'Status']");
  });
});

describe('paging helpers', () => {
  it('parses the page number', () => {
    expect(parsePage(undefined)).toBe(1);
    expect(parsePage('0')).toBe(1);
    expect(parsePage('-3')).toBe(1);
    expect(parsePage('abc')).toBe(1);
    expect(parsePage('3')).toBe(3);
    expect(parsePage(['2', '5'])).toBe(2);
  });

  it('computes ranges, page counts and links', () => {
    expect(pageRange(1, 50)).toEqual({ from: 0, to: 49 });
    expect(pageRange(3, 50)).toEqual({ from: 100, to: 149 });
    expect(pageCount(0, 50)).toBe(1);
    expect(pageCount(101, 50)).toBe(3);
    expect(pageHref('/portal/violations', 1)).toBe('/portal/violations');
    expect(pageHref('/portal/violations', 2)).toBe('/portal/violations?page=2');
  });

  it('work orders and violations are paged; violation tiles come from their own counts', () => {
    const wo = read('app/portal/work-orders/page.tsx');
    expect(wo).not.toContain('.limit(100)');
    expect(wo).toContain('.range(from, to)');
    expect(wo).toContain("{ count: 'exact' }");
    const viol = read('app/portal/violations/page.tsx');
    expect(viol).not.toContain('.limit(100)');
    expect(viol).toContain('.range(from, to)');
    expect(viol).toContain("{ count: 'exact', head: true }).not('status', 'in', '(\"closed\",\"cured\")')");
    expect(viol).toContain("{ count: 'exact', head: true }).or('hearing_at.not.is.null,hearing_date.not.is.null')");
    expect(viol).toContain('finesRes.rows.reduce(');
    expect(viol).not.toContain('all.filter((v: any) => v.hearing_at || v.hearing_date).length');
  });
});

describe('work orders page shows action errors', () => {
  it('renders ?error= from the message action', () => {
    const wo = read('app/portal/work-orders/page.tsx');
    expect(wo).toContain('searchParams: Promise<{ error?: string; page?: string }>');
    expect(wo).toContain('{sp.error && <Alert tone="danger">{sp.error}</Alert>}');
    expect(read('lib/rpcs/work-orders-messages.ts')).toContain("redirect(`/portal/work-orders?error=");
  });
});

describe('AutoPay respects "online payments off"', () => {
  const page = read('app/portal/autopay/page.tsx');

  it('the setup action refuses such an account', () => {
    expect(page).toContain("select('owner_id, unit_id, association_id, allow_online_payments, associations(");
    expect(page).toContain('if (occ.allow_online_payments === false) {');
  });

  it('does not offer such units and shows existing enrollments as paused', () => {
    expect(page).toContain('&& o.allow_online_payments !== false');
    expect(page).toContain('<StatusChip tone="warning">Paused</StatusChip>');
    expect(page).toContain('Online payments are off for this account.</p>}');
    expect(page).toContain('Please contact your management company.');
    expect(page).not.toContain('management office');
    expect(page).toContain("onlineOff.has(`${m.owner_id}:${m.unit_id}`)");
  });

  it('shows a read error instead of an empty page', () => {
    expect(page).toContain('const loadError = mandatesError ?? occsError;');
    expect(page).toContain('{loadError && <Alert tone="danger"');
  });
});

describe('hearings', () => {
  const page = read('app/portal/hearings/page.tsx');
  it('prefers hearing_at and the accumulated fines', () => {
    expect(page).toContain('const hearingOn = v.hearing_at ?? v.hearing_date');
    expect(page).toContain('const fine = Number(v.fines_total) > 0 ? v.fines_total : v.fine_amount');
    expect(page).toContain('board_decision, fine_amount, fines_total');
  });
  it('renders a read error', () => {
    expect(page).toContain('{violsError && <Alert tone="danger"');
  });
});

describe('silent read errors are shown', () => {
  it.each([
    ['app/portal/home/page.tsx', 'const loadError = occupanciesError ?? parkingError ?? petsError'],
    ['app/portal/meetings/page.tsx', '{meetingsError && <Alert tone="danger"'],
    ['app/portal/vehicles/page.tsx', '{assignmentsError && <Alert tone="danger"'],
    ['app/portal/amenities/page.tsx', 'const loadError = amenitiesError ?? reservationsError ?? zonesError'],
    ['app/portal/page.tsx', "track('ownership dates', tenure.error"],
    ['app/portal/timeline/page.tsx', 'tenure.error'],
    ['app/portal/service-requests/page.tsx', 'tenure.error'],
  ])('%s', (file, needle) => {
    expect(read(file)).toContain(needle);
  });

  it('messages: the loaders return their errors and compose does not open on a failed read', () => {
    const loaders = read('lib/messages/resident-loaders.ts');
    expect(loaders).toContain('Promise<{ threads: ResidentThreadRow[]; error: string | null }>');
    expect(loaders).toContain("if (error) return { threads: [], error: `Could not load your messages:");
    for (const file of ['app/portal/messages/page.tsx', 'app/resident/messages/page.tsx']) {
      const page = read(file);
      expect(page, file).toContain("compose={!loadError && (sp.compose === '1' || threads.length === 0)}");
      expect(page, file).toContain('loadError={loadError}');
    }
    // No doubled period when the error text already ends in one.
    expect(read('components/messages/resident-messages.tsx')).toContain("{loadError.replace(/\\.\\s*$/, '')}. Please refresh.");
  });
});

describe('payment result page', () => {
  const page = read('app/portal/pay/success/page.tsx');
  it('a payment that did not end up paid never reads as submitted', () => {
    expect(page).toContain('const notCompleted = paymentNotCompleted(intent?.status)');
    expect(page).toContain('{notCompleted.title}');
    expect(page).toContain('<Link href="/portal/pay" className={buttonClass()}>Back to Pay</Link>');
  });

  it('the lookup warning sits under the heading text, above the buttons', () => {
    const main = page.slice(page.lastIndexOf('  return ('));
    const heading = main.indexOf("'Your payment was submitted. It will appear on your ledger once confirmed.'");
    const warning = main.indexOf('{intentError && (');
    const buttons = main.indexOf('<Link href="/portal/ledger"');
    expect(heading).toBeGreaterThan(0);
    expect(warning).toBeGreaterThan(heading);
    expect(buttons).toBeGreaterThan(warning);
  });

  it.each([
    ['failed', 'Payment did not go through'],
    ['canceled', 'Payment canceled'],
    ['returned', 'This payment was returned'],
    ['refunded', 'This payment was refunded'],
    ['chargeback', 'This payment was disputed'],
  ])('%s gets its own wording', (status, title) => {
    const outcome = paymentNotCompleted(status);
    expect(outcome?.title).toBe(title);
    expect(outcome?.body('$10.00')).toContain('$10.00');
  });

  it.each(['succeeded', 'pending', 'processing', null, undefined])('%s is not a not-completed payment', (status) => {
    expect(paymentNotCompleted(status as string | null | undefined)).toBeNull();
  });
});

describe('communications uses the shared form components', () => {
  it('has no hand-styled fields or button', () => {
    const page = read('app/portal/communications/page.tsx');
    expect(page).toContain("import { Field, Input, Select, Textarea } from '@/components/ui/input'");
    expect(page).toContain('<Field label="Subject" required><Input name="subject"');
    expect(page).toContain('<Field label="Message" required><Textarea name="body"');
    expect(page).toContain('<PendingSubmit pendingLabel="Sending…">Send Message</PendingSubmit>');
    expect(page).not.toContain('<textarea');
    expect(page).not.toContain('<input name="subject"');
    expect(page).not.toContain('<button type="submit"');
  });
});

describe('shared cards and banners', () => {
  it.each([
    'app/portal/hearings/page.tsx',
    'app/portal/violations/page.tsx',
    'app/portal/autopay/page.tsx',
    'app/portal/meetings/page.tsx',
  ])('%s uses Surface, not hand-rolled cards', (file) => {
    const page = read(file);
    expect(page).toContain('<Surface');
    expect(page).not.toContain('rounded-2xl border border-line bg-white');
  });

  it('violations: success banner is an Alert; totals error only when the list loaded', () => {
    const page = read('app/portal/violations/page.tsx');
    expect(page).not.toContain('border-emerald-200 bg-emerald-50');
    expect(page).toContain('<Alert tone="success">');
    expect(page).toContain('{!violsError && tilesError && <Alert');
  });
});

describe('hearing dates in the association time zone', () => {
  it('the hearings list formats with the association zone', () => {
    const page = read('app/portal/hearings/page.tsx');
    expect(page).toContain('fines_total, associations(timezone)');
    expect(page).toContain('const zone = associationZone(v.associations?.timezone)');
    expect(page).toContain("date(hearingOn, 'short', zone)");
  });

  it('the violation detail page formats every hearing date with it', () => {
    const page = read('app/portal/violations/[id]/page.tsx');
    expect(page).toContain('units!inner(unit_number), associations(timezone)');
    expect(page).toContain('const zone = associationZone(v.associations?.timezone)');
    expect(page).not.toContain('date(hearingOn)');
    expect(page.match(/date\(hearingOn, 'short', zone\)/g)?.length).toBe(4);
  });
});
