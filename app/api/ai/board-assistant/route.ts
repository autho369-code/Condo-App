/**
 * POST /api/ai/board-assistant
 *
 * AI Board Assistant — the board-member counterpart to /api/ai/assistant.
 *
 * SAFETY MODEL: identical to the portfolio assistant — no NL→SQL, no arbitrary
 * queries. The server gathers a fixed, curated, RLS-scoped snapshot of the
 * board member's OWN association(s) (their session ⇒ board-read policies
 * apply), and the AI answers ONLY from that snapshot.
 *
 * The portfolio's BYO AI key is read with the service client because board
 * members intentionally cannot SELECT the portfolios row (the key never
 * leaves the server).
 */
import { NextRequest, NextResponse } from 'next/server';
import { chatCompletion, type AIConfig } from '@/lib/ai/service';
import { requireBoard } from '@/lib/auth/me';
import { buildBoardSnapshot } from '@/lib/ai/board-snapshot';
import { createServiceClient } from '@/lib/supabase/server';

const SYSTEM_PROMPT =
  'You are the AI Board Assistant for a condominium/HOA board of directors. ' +
  'You are speaking with a BOARD MEMBER who governs the association but does not run day-to-day operations. ' +
  'Answer their questions ONLY from the DATA provided below — a live, read-only snapshot of THEIR association. ' +
  'If the answer is not in the DATA, say plainly that you don\'t have that information and suggest asking the property manager. ' +
  'NEVER invent, estimate, or extrapolate numbers, names, dates, or amounts. ' +
  'Be concise and conversational; format money with a dollar sign. Use short bullet points for lists. ' +
  'Do not output JSON or code unless asked.';

type Turn = { role: 'user' | 'assistant'; content: string };

async function getBoardAIConfig(associationIds: string[]): Promise<AIConfig | null> {
  const svc = createServiceClient() as any;
  // Resolve the association's portfolio, then its BYO AI settings.
  const { data: assoc } = await svc
    .from('associations')
    .select('portfolio_id')
    .in('id', associationIds)
    .limit(1)
    .maybeSingle();
  if (!assoc?.portfolio_id) return null;

  const { data: portfolio } = await svc
    .from('portfolios')
    .select('ai_provider, ai_model, ai_endpoint, ai_api_key')
    .eq('id', assoc.portfolio_id)
    .maybeSingle();
  if (!portfolio?.ai_provider || !portfolio?.ai_api_key) return null;

  return {
    provider: portfolio.ai_provider,
    model: portfolio.ai_model || 'gpt-4o',
    apiKey: portfolio.ai_api_key,
    endpoint: portfolio.ai_endpoint || undefined,
  };
}

export async function POST(request: NextRequest) {
  let me;
  try {
    me = await requireBoard();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ids: string[] = me.board_association_ids ?? [];
  if (ids.length === 0) {
    return NextResponse.json({ error: 'No associations linked to your board membership.' }, { status: 400 });
  }

  let body: { question?: string; history?: Turn[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const question = (body.question ?? '').trim();
  if (!question) {
    return NextResponse.json({ error: 'Please enter a question.' }, { status: 400 });
  }

  const config = await getBoardAIConfig(ids);
  if (!config) {
    return NextResponse.json(
      { error: 'AI not configured', hint: 'Ask your management company to set up AI for the portfolio.' },
      { status: 400 },
    );
  }

  const history: Turn[] = Array.isArray(body.history)
    ? body.history
        .filter(
          (t): t is Turn =>
            !!t && (t.role === 'user' || t.role === 'assistant') && typeof t.content === 'string',
        )
        .slice(-6)
    : [];

  try {
    const snapshot = await buildBoardSnapshot();

    const messages = [
      { role: 'system' as const, content: `${SYSTEM_PROMPT}\n\nDATA:\n${JSON.stringify(snapshot)}` },
      ...history.map((t) => ({ role: t.role, content: t.content })),
      { role: 'user' as const, content: question },
    ];

    const answer = await chatCompletion(config, messages, { temperature: 0.2 });

    return NextResponse.json({ answer: (answer ?? '').trim() });
  } catch (error: any) {
    console.error('Board assistant error:', error);
    return NextResponse.json(
      { error: error?.message || 'Assistant failed', hint: 'Ask your management company to check the AI settings.' },
      { status: 500 },
    );
  }
}
