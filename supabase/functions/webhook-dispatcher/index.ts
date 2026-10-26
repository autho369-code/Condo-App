// webhook-dispatcher — RETIRED 2026-10-26.
// Company webhooks are delivered only by the app (/api/webhooks/deliver), which
// blocks private-network targets and honours WEBHOOK_DELIVERY_ENABLED and the
// suspended-company hold. This old dispatcher accepted anon-key callers and did
// none of that,
// so it now refuses every request.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(() => new Response(JSON.stringify({ ok: false, error: "This function is retired." }), {
  status: 410,
  headers: { "Content-Type": "application/json" },
}));
