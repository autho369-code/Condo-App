// =============================================================================
// AI manager copilot — server-only Claude proxy
// =============================================================================
// Streams tokens from Anthropic's Messages API to the staff UI. Never returns
// user content unsanitised — system prompt enforces "Portier-aware association
// management assistant" persona.
//
// Required env vars:
//   ANTHROPIC_API_KEY     — your key (server-only)
//   PORTIER_AI_MODEL      — optional override; defaults to claude-sonnet-4-6
//
// Body shape (POST):
//   { mode: 'draft_board' | 'summarize_financials' | 'classify_maintenance'
//          | 'draft_violation' | 'free',
//     context: string,        // contextual data to ground the response
//     instruction?: string }  // user's free-form ask (only required for 'free')
// =============================================================================
import { NextResponse } from 'next/server';
import { requireStaff } from '@/lib/auth/me';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MODEL  = process.env.PORTIER_AI_MODEL  ?? 'claude-sonnet-4-6';
const APIKEY = process.env.ANTHROPIC_API_KEY ?? '';

const SYSTEM_PROMPT = `
You are Portier, an executive assistant embedded in a association management
operating platform. The user is a staff member at a management company.

Voice: confident, concise, editorial. Short sentences. Use measured
language. Never use exclamation marks. Never apologize. Never call yourself
"AI" — refer to yourself as Portier when needed.

Output rules:
- Keep responses under 200 words unless the user asks for longer
- For drafted text (board responses, violation letters), produce only the
  body of the message — no preamble, no commentary, no "Here's a draft:"
- For summaries, lead with a single-sentence headline, then 3 bullets max
- For classification, return JSON only when the user asks for it; otherwise
  one short paragraph
- Defer to the user's data over your assumptions; if you're guessing, say so
- Never invent fees, dates, dollar amounts, or names. If the context doesn't
  include them, write "[insert ___]" so the user fills it in
`.trim();

const MODES: Record<string, { system: string; userTemplate: (ctx: string, ins?: string) => string }> = {
  draft_board: {
    system: SYSTEM_PROMPT,
    userTemplate: (ctx, ins) =>
      `Draft a polished response to this board question. Use the financial / operational context provided.\n\n` +
      `BOARD QUESTION:\n${ins ?? '(none provided)'}\n\nCONTEXT:\n${ctx}`,
  },
  summarize_financials: {
    system: SYSTEM_PROMPT + '\n\nThis is a financial summary task. Focus on what the board chair will care about: cash position, delinquency trend, upcoming obligations.',
    userTemplate: (ctx) =>
      `Summarize this association's financials in a board-ready paragraph plus 3 bullets:\n\n${ctx}`,
  },
  classify_maintenance: {
    system: SYSTEM_PROMPT + '\n\nReturn JSON with fields: category, priority (low|medium|high|emergency), estimated_response_hours, suggested_vendor_type, draft_response.',
    userTemplate: (ctx, ins) =>
      `Classify this maintenance request and draft an acknowledgement to the resident.\n\nREQUEST:\n${ins ?? ctx}\n\nUNIT CONTEXT:\n${ctx}`,
  },
  draft_violation: {
    system: SYSTEM_PROMPT,
    userTemplate: (ctx, ins) =>
      `Draft a measured violation notice (no inflammatory language). Reference the rule and cure period.\n\nVIOLATION:\n${ins ?? '(none)'}\n\nCONTEXT:\n${ctx}`,
  },
  free: {
    system: SYSTEM_PROMPT,
    userTemplate: (ctx, ins) =>
      `${ins ?? 'How can I help?'}\n\nWORKING CONTEXT (may be empty):\n${ctx}`,
  },
};

export async function POST(req: Request) {
  // Gate behind staff auth
  await requireStaff();

  if (!APIKEY) {
    return NextResponse.json(
      { error: 'AI copilot is not configured. Set ANTHROPIC_API_KEY in your environment.' },
      { status: 503 },
    );
  }

  let body: any;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 }); }

  const mode = (body.mode as string) ?? 'free';
  const m = MODES[mode] ?? MODES.free;
  const context = String(body.context ?? '').slice(0, 8000);
  const instruction = body.instruction ? String(body.instruction).slice(0, 2000) : undefined;

  const userMessage = m.userTemplate(context, instruction);

  // Stream from Anthropic
  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': APIKEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      stream: true,
      system: m.system,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => '');
    return NextResponse.json(
      { error: 'AI service responded with ' + upstream.status, detail: detail.slice(0, 500) },
      { status: 502 },
    );
  }

  // Pipe Anthropic's SSE stream straight to the client. The client component
  // parses `data:` lines and accumulates text deltas.
  return new Response(upstream.body, {
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache, no-transform',
      'x-portier-ai-model': MODEL,
    },
  });
}
