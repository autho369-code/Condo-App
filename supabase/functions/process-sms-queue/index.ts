// process-sms-queue — RETIRED 2026-10-26.
// Texts are sent only by the app (/api/sms/deliver), which checks consent and
// opt-outs. This old drainer accepted anon-key callers and sent any queued text,
// so it now refuses every request.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(() => new Response(JSON.stringify({ ok: false, error: "This function is retired." }), {
  status: 410,
  headers: { "Content-Type": "application/json" },
}));
