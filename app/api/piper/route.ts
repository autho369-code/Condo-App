/**
 * POST /api/piper — Piper, the website chat bot (same brain as the phone line).
 *
 * Public marketing endpoint: answers product/pricing questions from the SAME
 * teachable knowledge base the phone receptionist uses (receptionist_knowledge,
 * edited at /platform-operator/piper), and captures demo requests into
 * phone_messages (provider 'webchat') so web leads land in the same console
 * as phone leads. LLM: DeepSeek (OpenAI-compatible), one tool: take_message.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { queueEmails } from '@/lib/email/queue';

export const dynamic = 'force-dynamic';

const DEEPSEEK_BASE = 'https://api.deepseek.com/v1';
const MODEL = 'deepseek-chat';
const MAX_TURNS = 24; // messages per conversation
const MAX_CHARS = 600; // per visitor message

const BASE_PROMPT = `You are Piper, the assistant on portier369.com — the website of Portier369, \
the operating system for condominium and HOA management companies (Chicago, Illinois).

You are chatting in a small text widget with a website visitor, usually the owner or manager of a \
property management company evaluating software.

STYLE: friendly, professional, concise — 1-3 short sentences per reply, plain text (no markdown, \
no lists unless asked). Ask at most one question per reply.

WHAT YOU DO:
1. Answer questions about Portier369 — features, pricing, onboarding, migration — using ONLY the \
CURRENT KNOWLEDGE below. Never invent capabilities, prices, or policies.
2. Book demos: when a visitor shows buying interest, offer a personal demo. Collect their name, \
company, email or phone, roughly how many doors/units they manage, and what software they use today \
— then call take_message with urgency "lead". Confirm a human will follow up within one business day.
3. If they prefer to talk: they can call you on the phone right now at (872) 269-8818 — the same \
Piper answers. Mention this naturally when relevant; it is a great proof of the product.
4. Existing customers with support questions: take a message (urgency "urgent" if something is broken).

RULES:
- Only discuss Portier369 and community-association management. Politely decline anything else.
- Standard onboarding is included; historical/legacy migration and custom work are professional \
services quoted separately — never promise free unlimited migration.
- Never give legal, tax, or investment advice. Never disclose information about any customer.
- If you don't know: say the team will follow up with the exact answer, and take a message.`;

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'take_message',
      description: 'Record a lead or message for the Portier369 team once you have the visitor details.',
      parameters: {
        type: 'object',
        properties: {
          caller_name: { type: 'string' },
          company: { type: 'string' },
          email: { type: 'string' },
          callback_number: { type: 'string' },
          doors: { type: 'string', description: 'Approximate units/doors managed' },
          current_software: { type: 'string' },
          message: { type: 'string', description: 'What they want / summary of the conversation' },
          urgency: { type: 'string', enum: ['normal', 'urgent', 'lead'] },
        },
        required: ['caller_name', 'message'],
      },
    },
  },
];

async function loadKnowledge(svc: any): Promise<string> {
  const { data } = await svc
    .from('receptionist_knowledge')
    .select('category, title, body')
    .eq('active', true)
    .order('pinned', { ascending: false })
    .order('category');
  const rows = data ?? [];
  if (rows.length === 0) return '';
  return (
    '\n\nCURRENT KNOWLEDGE (maintained by the team — the up-to-date truth):\n\n' +
    rows.map((k: any) => `[${k.category}] ${k.title}:\n${k.body}`).join('\n\n')
  );
}

async function saveWebLead(svc: any, a: any, sessionId: string) {
  const record = {
    caller_name: String(a.caller_name ?? '').slice(0, 200),
    company: String(a.company ?? '').slice(0, 200),
    email: String(a.email ?? '').slice(0, 200),
    callback_number: String(a.callback_number ?? '').slice(0, 50),
    doors: String(a.doors ?? '').slice(0, 50),
    current_software: String(a.current_software ?? '').slice(0, 100),
    message: String(a.message ?? '').slice(0, 2000),
    urgency: ['normal', 'urgent', 'lead'].includes(a.urgency) ? a.urgency : 'lead',
    provider: 'webchat',
    call_id: sessionId,
    from_number: '',
  };
  const { error } = await svc.from('phone_messages').insert(record);
  if (!error) {
    try {
      await queueEmails(svc, [
        {
          to: 'hello@portier369.com',
          subject: `${record.urgency === 'lead' ? 'NEW LEAD' : 'Message'} from Piper web chat — ${record.caller_name || 'visitor'}${record.company ? ` (${record.company})` : ''}`,
          text:
            `Piper took a message on portier369.com:\n\n` +
            `Name: ${record.caller_name}\nCompany: ${record.company || '—'}\nEmail: ${record.email || '—'}\n` +
            `Phone: ${record.callback_number || '—'}\nDoors: ${record.doors || '—'}\nCurrent software: ${record.current_software || '—'}\n\n` +
            `${record.message}\n\nReview: https://portier369.com/platform-operator/piper`,
        },
      ]);
    } catch {}
  }
  return !error;
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'Chat is temporarily unavailable.' }, { status: 503 });

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const sessionId = typeof body.sessionId === 'string' ? body.sessionId.slice(0, 64) : 'web';
  const incoming = Array.isArray(body.messages) ? body.messages.slice(-MAX_TURNS) : [];
  const messages = incoming
    .filter((m: any) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map((m: any) => ({ role: m.role, content: String(m.content).slice(0, MAX_CHARS) }));
  if (messages.length === 0 || messages[messages.length - 1].role !== 'user') {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const svc = createServiceClient() as any;
  const knowledge = await loadKnowledge(svc);
  const chat: any[] = [{ role: 'system', content: BASE_PROMPT + knowledge }, ...messages];

  try {
    for (let round = 0; round < 3; round++) {
      const r = await fetch(`${DEEPSEEK_BASE}/chat/completions`, {
        method: 'POST',
        headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({ model: MODEL, messages: chat, tools: TOOLS, temperature: 0.5, max_tokens: 400 }),
      });
      if (!r.ok) {
        const errBody = await r.text().catch(() => '');
        throw new Error(`llm ${r.status}: ${errBody.slice(0, 300)}`);
      }
      const data = await r.json();
      const msg = data.choices?.[0]?.message;
      if (!msg) throw new Error('empty completion');

      const toolCalls = msg.tool_calls ?? [];
      if (toolCalls.length === 0) {
        return NextResponse.json({ reply: String(msg.content ?? '').slice(0, 2000) });
      }
      chat.push(msg);
      for (const tc of toolCalls) {
        let result = { status: 'failed' };
        if (tc.function?.name === 'take_message') {
          let args = {};
          try { args = JSON.parse(tc.function.arguments || '{}'); } catch {}
          const ok = await saveWebLead(svc, args, sessionId);
          result = ok
            ? ({ status: 'saved', note: 'Confirm a human will follow up within one business day.' } as any)
            : ({ status: 'failed', note: 'Apologize and give them hello@portier369.com and (872) 269-8818.' } as any);
        }
        chat.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result) });
      }
    }
    return NextResponse.json({ reply: 'Thanks — the team will follow up shortly. Anything else I can help with?' });
  } catch (e: any) {
    console.error('piper chat error:', e?.message ?? e);
    return NextResponse.json({
      reply: 'I hit a snag on my end. You can reach the team at hello@portier369.com or call me at (872) 269-8818.',
    });
  }
}

// LLM round-trips (with a tool call) can exceed Vercel's default timeout.
export const maxDuration = 60;
