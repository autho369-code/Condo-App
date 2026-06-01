// process-email-queue — cron-driven. Drains pending email_queue rows
// by invoking the send-email function.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BATCH_SIZE = 50;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

async function sendOne(row: any) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${SERVICE_ROLE}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: row.to_email,
      to_name: row.to_name ?? undefined,
      subject: row.subject,
      html: row.body,
      from: row.from_name
        ? `${row.from_name} <${row.from_address}>`
        : row.from_address ?? undefined,
      reply_to: row.reply_to ?? undefined,
      tags: {
        email_queue_id: row.id,
        portfolio_id: row.portfolio_id ?? undefined,
      },
    }),
  });
  const raw = await res.text();
  let body: any = {};
  try { body = JSON.parse(raw); } catch { /* empty body */ }
  return {
    ok: res.ok && body?.ok === true,
    status: res.status,
    message: body?.error ?? (raw ? raw.slice(0, 200) : `http ${res.status}`) ?? null,
    provider_id: body?.message_id
  };
}

Deno.serve(async (_req) => {
  const { data: rows, error } = await supabase
    .from("email_queue")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(BATCH_SIZE);

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  const outcomes = await Promise.all((rows ?? []).map(async (row: any) => {
    try {
      const result = await sendOne(row);
      if (result.ok) {
        await supabase.from("email_queue").update({
          status: "sent",
          sent_at: new Date().toISOString(),
          error_message: null,
        }).eq("id", row.id);
        return { id: row.id, ok: true };
      } else {
        await supabase.from("email_queue").update({
          status: "failed",
          error_message: (result.message ?? `http ${result.status}`).slice(0, 1000),
        }).eq("id", row.id);
        return { id: row.id, ok: false, error: result.message };
      }
    } catch (err) {
      await supabase.from("email_queue").update({
        status: "failed",
        error_message: (err as Error).message.slice(0, 1000),
      }).eq("id", row.id);
      return { id: row.id, ok: false, error: (err as Error).message };
    }
  }));

  return new Response(JSON.stringify({ processed: outcomes.length, outcomes }), {
    headers: { "Content-Type": "application/json" },
  });
});
