// send-email — RETIRED 2026-10-26 (Mirsad approved).
// Email is sent only by the app's queue worker (/api/email/process-queue via
// claim_email_queue_snapshot). This old function accepted any signed-in or
// anon-key caller and sent any message through the platform's email account,
// so it now refuses every request.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(() => new Response(JSON.stringify({ ok: false, error: "This function is retired." }), {
  status: 410,
  headers: { "Content-Type": "application/json" },
}));
