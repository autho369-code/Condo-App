/**
 * POST /api/ai/assistant
 *
 * Portfolio Assistant — a conversational endpoint that answers natural-language
 * questions about the manager's portfolio.
 *
 * SAFETY MODEL: this does NOT do NL→SQL or run arbitrary queries. The server
 * gathers a fixed, curated, RLS-scoped DATA SNAPSHOT (using the logged-in
 * user's Supabase session, so they only ever see their own data), serializes it
 * compactly, and the AI answers using ONLY that snapshot. The system prompt
 * forbids inventing numbers or facts not present in the snapshot.
 *
 * Mirrors the route style of app/api/ai/draft-communication/route.ts.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getAIConfig, chatCompletion } from '@/lib/ai/service';
import { requireStaff } from '@/lib/auth/me';
import { buildPortfolioSnapshot } from '@/lib/ai/portfolio-snapshot';

const SYSTEM_PROMPT =
  'You are the Portfolio Assistant for a community-association (HOA/condo) property manager. ' +
  'Answer the manager\'s questions ONLY from the DATA provided below, which is a live, ' +
  'read-only snapshot of THEIR portfolio. ' +
  'If the answer is not present in the DATA, say plainly that you don\'t have that information ' +
  'and suggest where in the app they might find it. ' +
  'NEVER invent, estimate, or extrapolate numbers, names, dates, or amounts — only state what is in the DATA. ' +
  'Be concise and conversational. Format money with a dollar sign and use plain language. ' +
  'When listing items, use short bullet points. Do not output JSON or code unless asked.';

type Turn = { role: 'user' | 'assistant'; content: string };

export async function POST(request: NextRequest) {
  let me;
  try {
    me = await requireStaff();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const portfolioId = me.portfolio?.id;
  if (!portfolioId) {
    return NextResponse.json(
      { error: 'AI not configured', hint: 'Set up AI in Settings → AI.' },
      { status: 400 },
    );
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

  const config = await getAIConfig(portfolioId);
  if (!config) {
    return NextResponse.json(
      { error: 'AI not configured', hint: 'Set up AI in Settings → AI.' },
      { status: 400 },
    );
  }

  // Cap prior turns to the last ~6 and keep only well-formed entries.
  const history: Turn[] = Array.isArray(body.history)
    ? body.history
        .filter(
          (t): t is Turn =>
            !!t &&
            (t.role === 'user' || t.role === 'assistant') &&
            typeof t.content === 'string',
        )
        .slice(-6)
    : [];

  try {
    const snapshot = await buildPortfolioSnapshot();

    const messages = [
      {
        role: 'system' as const,
        content: `${SYSTEM_PROMPT}\n\nDATA:\n${JSON.stringify(snapshot)}`,
      },
      ...history.map((t) => ({ role: t.role, content: t.content })),
      { role: 'user' as const, content: question },
    ];

    const answer = await chatCompletion(config, messages, { temperature: 0.2 });

    return NextResponse.json({ answer: (answer ?? '').trim() });
  } catch (error: any) {
    console.error('Portfolio assistant error:', error);
    return NextResponse.json(
      {
        error: error?.message || 'Assistant failed',
        hint: 'Check your AI provider settings and API key.',
      },
      { status: 500 },
    );
  }
}
