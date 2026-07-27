/**
 * POST /api/ai/owner-assistant
 *
 * AI Owner Assistant — answers a homeowner's routine questions from a live,
 * RLS-scoped snapshot of THEIR OWN account (balance, charges, payments,
 * requests, violations, events). Same safety model as the other assistants:
 * no NL→SQL, no data outside the snapshot, no invented numbers.
 *
 * The portfolio's BYO AI key is read with the service client (owners cannot
 * read the portfolios row; the key never leaves the server).
 */
import { NextRequest, NextResponse } from 'next/server';
import { chatCompletion, getAIConfig, type AIConfig } from '@/lib/ai/service';
import { requireOwner } from '@/lib/auth/me';
import { buildOwnerSnapshot } from '@/lib/ai/owner-snapshot';
import { createServiceClient } from '@/lib/supabase/server';
import {
  MAX_ASSISTANT_MESSAGE_CHARS,
  boundedAssistantHistory,
  guardAuthenticatedAssistantRequest,
  type AssistantTurn,
} from '@/lib/ai/request-guard';

const SYSTEM_PROMPT =
  'You are the AI Assistant for a condominium/HOA OWNER portal. You are speaking with a homeowner. ' +
  'Answer their questions ONLY from the DATA provided below — a live, read-only snapshot of THEIR OWN account. ' +
  'If the answer is not in the DATA, say so plainly and point them to the right portal page ' +
  '(How to Pay, Maintenance Requests, Documents, Insurance, Amenities, Calendar) or suggest contacting their management company. ' +
  'NEVER invent, estimate, or extrapolate numbers, dates, or amounts. ' +
  'Be warm, concise, and plain-spoken; format money with a dollar sign. ' +
  'Do not output JSON or code unless asked.';

async function getOwnerAIConfig(ownerId: string): Promise<AIConfig | null> {
  const svc = createServiceClient() as any;
  const { data: owner } = await svc.from('owners').select('portfolio_id').eq('id', ownerId).maybeSingle();
  if (!owner?.portfolio_id) return null;

  return getAIConfig(owner.portfolio_id, svc);
}

export async function POST(request: NextRequest) {
  let me;
  try {
    me = await requireOwner();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const guarded = await guardAuthenticatedAssistantRequest<{
    question?: unknown;
    history?: unknown;
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

  if (!me.owner_id) {
    return NextResponse.json({ error: 'No owner record linked to your account.' }, { status: 400 });
  }
  const config = await getOwnerAIConfig(me.owner_id);
  if (!config) {
    return NextResponse.json(
      { error: 'AI not configured', hint: 'AI is not enabled for your community yet.' },
      { status: 400 },
    );
  }

  const history: AssistantTurn[] = boundedAssistantHistory(body.history);

  try {
    const snapshot = await buildOwnerSnapshot();

    const messages = [
      { role: 'system' as const, content: `${SYSTEM_PROMPT}\n\nDATA:\n${JSON.stringify(snapshot)}` },
      ...history.map((t) => ({ role: t.role, content: t.content })),
      { role: 'user' as const, content: question },
    ];

    const answer = await chatCompletion(config, messages, { temperature: 0.2 });

    return NextResponse.json({ answer: (answer ?? '').trim() });
  } catch (error: any) {
    console.error('Owner assistant error:', error);
    return NextResponse.json(
      { error: error?.message || 'Assistant failed', hint: 'Please try again or contact your management company.' },
      { status: 500 },
    );
  }
}
