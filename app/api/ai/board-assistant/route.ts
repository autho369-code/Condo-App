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
import { chatCompletion, getAIConfig, type AIConfig } from '@/lib/ai/service';
import { requireBoard } from '@/lib/auth/me';
import { buildBoardSnapshot } from '@/lib/ai/board-snapshot';
import { createServiceClient } from '@/lib/supabase/server';
import {
  MAX_ASSISTANT_MESSAGE_CHARS,
  boundedAssistantHistory,
  guardAuthenticatedAssistantRequest,
  type AssistantTurn,
} from '@/lib/ai/request-guard';

const SYSTEM_PROMPT =
  'You are the AI Board Assistant for a condominium/HOA board of directors. ' +
  'You are speaking with a BOARD MEMBER who governs the association but does not run day-to-day operations. ' +
  'Answer their questions ONLY from the DATA provided below — a live, read-only snapshot of THEIR association. ' +
  'If the answer is not in the DATA, say plainly that you don\'t have that information and suggest asking the property manager. ' +
  'NEVER invent, estimate, or extrapolate numbers, names, dates, or amounts. ' +
  'Be concise and conversational; format money with a dollar sign. Use short bullet points for lists. ' +
  'Do not output JSON or code unless asked.';

async function getBoardAIConfig(associationId: string): Promise<AIConfig | null> {
  const svc = createServiceClient() as any;
  const { data: assoc } = await svc
    .from('associations')
    .select('portfolio_id')
    .eq('id', associationId)
    .maybeSingle();
  if (!assoc?.portfolio_id) return null;
  return getAIConfig(assoc.portfolio_id, svc);
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

  const guarded = await guardAuthenticatedAssistantRequest<{
    question?: unknown;
    history?: unknown;
    associationId?: unknown;
  }>(request, me.auth_user_id);
  if (!guarded.ok) return guarded.response;
  const body = guarded.body;

  const question = typeof body.question === 'string' ? body.question.trim() : '';
  if (!question) {
    return NextResponse.json({ error: 'Please enter a question.' }, { status: 400 });
  }
  if (question.length > MAX_ASSISTANT_MESSAGE_CHARS) {
    return NextResponse.json({ error: `Question must be ${MAX_ASSISTANT_MESSAGE_CHARS} characters or fewer.` }, { status: 400 });
  }
  const associationId = String(body.associationId ?? '');
  if (!ids.includes(associationId)) {
    return NextResponse.json({ error: 'Choose an association linked to your board account.' }, { status: 403 });
  }

  const config = await getBoardAIConfig(associationId);
  if (!config) {
    return NextResponse.json(
      { error: 'AI not configured', hint: 'Ask your management company to set up AI for the portfolio.' },
      { status: 400 },
    );
  }

  const history: AssistantTurn[] = boundedAssistantHistory(body.history);

  try {
    const snapshot = await buildBoardSnapshot(associationId);

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
