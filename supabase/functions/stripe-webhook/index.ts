// stripe-webhook — RETIRED 2026-10-26.
// Stripe events are handled only by the app (/api/stripe/webhook) with the
// current ledger rules. This old handler wrote payments with outdated logic,
// so it now refuses every request.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(() => new Response(JSON.stringify({ ok: false, error: "This function is retired." }), {
  status: 410,
  headers: { "Content-Type": "application/json" },
}));
