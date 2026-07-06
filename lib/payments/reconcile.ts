/**
 * Payout reconciliation engine — server-only.
 *
 * Matching layer between Stripe payouts (payout_batches) and the Plaid bank
 * feed (bank_transactions). Rules, in order:
 *   1. Reference match — bank transaction name contains the Stripe payout id
 *      (rare, but definitive).
 *   2. Exact amount match — |bank amount| equals the payout amount, the bank
 *      date is within ±5 days of the arrival date, and the description looks
 *      like a processor deposit.
 * A payout with no candidate stays 'paid' (waiting for the feed); one with
 * MULTIPLE ambiguous candidates is flagged 'needs_review' for the exception
 * queue rather than guessed at.
 */
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface ReconcileSummary {
  examined: number;
  reconciled: number;
  needsReview: number;
}

export async function reconcilePayouts(svc: SupabaseClient): Promise<ReconcileSummary> {
  const db = svc as any;
  const summary: ReconcileSummary = { examined: 0, reconciled: 0, needsReview: 0 };

  const { data: payouts } = await db
    .from('payout_batches')
    .select('id, portfolio_id, processor_payout_id, amount, arrival_date, status')
    .in('status', ['pending', 'paid', 'needs_review'])
    .is('bank_transaction_id', null);

  for (const payout of payouts ?? []) {
    summary.examined++;
    const arrival = payout.arrival_date ? new Date(payout.arrival_date) : new Date();
    const from = new Date(arrival.getTime() - 5 * 86400000).toISOString().slice(0, 10);
    const to = new Date(arrival.getTime() + 5 * 86400000).toISOString().slice(0, 10);

    // Candidate deposits in the window with matching magnitude.
    const { data: candidates } = await db
      .from('bank_transactions')
      .select('id, amount, date, name, matched_at')
      .eq('portfolio_id', payout.portfolio_id)
      .gte('date', from)
      .lte('date', to)
      .is('matched_at', null);

    const amountMatches = (candidates ?? []).filter(
      (t: any) => Math.abs(Math.abs(Number(t.amount)) - Number(payout.amount)) < 0.005,
    );

    // Rule 1: reference in the descriptor.
    const refMatch = amountMatches.find((t: any) =>
      (t.name ?? '').toLowerCase().includes(String(payout.processor_payout_id).toLowerCase()),
    );
    // Rule 2: single unambiguous amount match (prefer processor-looking descriptors).
    const processorLooking = amountMatches.filter((t: any) => /stripe|payout|transfer|deposit/i.test(t.name ?? ''));
    const pick = refMatch
      ?? (amountMatches.length === 1 ? amountMatches[0] : undefined)
      ?? (processorLooking.length === 1 ? processorLooking[0] : undefined);

    if (pick) {
      await db.from('payout_batches').update({
        bank_transaction_id: pick.id,
        status: 'reconciled',
        matched_at: new Date().toISOString(),
        match_method: refMatch ? 'reference' : 'exact_amount',
        updated_at: new Date().toISOString(),
      }).eq('id', payout.id);
      await db.from('bank_transactions').update({
        matched_at: new Date().toISOString(),
        match_method: 'stripe_payout',
        match_confidence: refMatch ? 1 : 0.9,
      }).eq('id', pick.id);
      summary.reconciled++;
    } else if (amountMatches.length > 1) {
      await db.from('payout_batches').update({
        status: 'needs_review',
        notes: `${amountMatches.length} bank deposits match this amount — pick one manually.`,
        updated_at: new Date().toISOString(),
      }).eq('id', payout.id);
      summary.needsReview++;
    }
  }

  return summary;
}
