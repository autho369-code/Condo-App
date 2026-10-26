// invite-user — RETIRED 2026-10-26.
// Invitations are sent only through the app's email queue (owner hold, logging,
// white-label sender). This old function sent them through Supabase's own mail,
// so it now refuses every request.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(() => new Response(JSON.stringify({ ok: false, error: "This function is retired." }), {
  status: 410,
  headers: { "Content-Type": "application/json" },
}));
