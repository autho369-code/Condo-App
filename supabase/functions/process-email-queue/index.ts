// process-email-queue — RETIRED 2026-10-26 (Mirsad approved).
// The email queue is sent only by the app's worker (/api/email/process-queue via
// claim_email_queue_snapshot), which applies suppressions, unsubscribes, the
// suspended-company hold and the owner/tenant hold. This old drainer bypassed
// all of them and accepted anon-key callers, so it now refuses every request.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(() => new Response(JSON.stringify({ ok: false, error: "This function is retired." }), {
  status: 410,
  headers: { "Content-Type": "application/json" },
}));
