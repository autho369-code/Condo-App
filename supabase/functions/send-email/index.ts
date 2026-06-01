// send-email — provider-agnostic email sender.
// Reads EMAIL_PROVIDER (resend|sendgrid|postmark|ses|none) and the matching API key.
// POST body: { to: string, to_name?: string, subject: string, html?: string, text?: string,
//              from?: string, reply_to?: string, tags?: Record<string,string> }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const PROVIDER = (Deno.env.get("EMAIL_PROVIDER") ?? "none").toLowerCase();
const DEFAULT_FROM = Deno.env.get("EMAIL_FROM") ?? "no-reply@localhost";
const DEFAULT_FROM_NAME = Deno.env.get("EMAIL_FROM_NAME") ?? "";

interface SendInput {
  to: string;
  to_name?: string;
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  from_name?: string;
  reply_to?: string;
  tags?: Record<string, string>;
}

async function sendResend(input: SendInput) {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) throw new Error("RESEND_API_KEY not configured");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: input.from ?? `${DEFAULT_FROM_NAME} <${DEFAULT_FROM}>`,
      to: [input.to_name ? `${input.to_name} <${input.to}>` : input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
      reply_to: input.reply_to,
      tags: input.tags ? Object.entries(input.tags).map(([name, value]) => ({ name, value })) : undefined,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`resend: ${res.status} ${JSON.stringify(body)}`);
  return { provider: "resend", message_id: body.id };
}

async function sendSendgrid(input: SendInput) {
  const key = Deno.env.get("SENDGRID_API_KEY");
  if (!key) throw new Error("SENDGRID_API_KEY not configured");
  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: input.to, name: input.to_name }] }],
      from: { email: input.from ?? DEFAULT_FROM, name: input.from_name ?? DEFAULT_FROM_NAME },
      subject: input.subject,
      content: [
        input.text ? { type: "text/plain", value: input.text } : null,
        input.html ? { type: "text/html", value: input.html } : null,
      ].filter(Boolean),
      reply_to: input.reply_to ? { email: input.reply_to } : undefined,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`sendgrid: ${res.status} ${body}`);
  }
  const messageId = res.headers.get("x-message-id") ?? null;
  return { provider: "sendgrid", message_id: messageId };
}

async function sendPostmark(input: SendInput) {
  const key = Deno.env.get("POSTMARK_API_KEY");
  if (!key) throw new Error("POSTMARK_API_KEY not configured");
  const res = await fetch("https://api.postmarkapp.com/email", {
    method: "POST",
    headers: { "X-Postmark-Server-Token": key, "Accept": "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      From: input.from ?? DEFAULT_FROM,
      To: input.to,
      Subject: input.subject,
      HtmlBody: input.html,
      TextBody: input.text,
      ReplyTo: input.reply_to,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`postmark: ${res.status} ${JSON.stringify(body)}`);
  return { provider: "postmark", message_id: body.MessageID };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });

  let input: SendInput;
  try { input = await req.json(); }
  catch { return new Response("invalid json", { status: 400 }); }

  if (!input?.to || !input?.subject || (!input.html && !input.text)) {
    return new Response("missing to/subject/body", { status: 400 });
  }

  try {
    let result;
    switch (PROVIDER) {
      case "resend":   result = await sendResend(input); break;
      case "sendgrid": result = await sendSendgrid(input); break;
      case "postmark": result = await sendPostmark(input); break;
      case "none":
        console.log("[send-email dry-run]", { to: input.to, subject: input.subject });
        result = { provider: "none", message_id: "dry-run-" + crypto.randomUUID() };
        break;
      default:
        throw new Error(`unsupported EMAIL_PROVIDER: ${PROVIDER}`);
    }
    return new Response(JSON.stringify({ ok: true, ...result }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: (err as Error).message }),
      { status: 502, headers: { "Content-Type": "application/json" } },
    );
  }
});
