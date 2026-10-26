// generate-report — RETIRED 2026-10-26.
// Reports are run only by the app (/api/reports/run-scheduled), which re-checks
// the requester's access and links outputs behind sign-in. This old runner
// accepted anon-key callers, skipped the access check and made 7-day public links,
// so it now refuses every request.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(() => new Response(JSON.stringify({ ok: false, error: "This function is retired." }), {
  status: 410,
  headers: { "Content-Type": "application/json" },
}));
