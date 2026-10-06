/**
 * POST /api/ai/assistant
 *
 * Portfolio Assistant — a conversational endpoint that answers natural-language
 * questions about the manager's portfolio.
 *
 * SAFETY MODEL: this does NOT do NL→SQL or run arbitrary queries. The server
 * gathers a fixed, curated, RLS-scoped DATA SNAPSHOT (portfolio totals), and
 * the model may call a fixed set of read-only lookups (`PORTFOLIO_TOOLS`: an
 * owner, a unit, delinquencies, open work orders, violations, bills). Both use
 * the logged-in user's Supabase session, so they only ever see their own data.
 * The system prompt forbids inventing numbers or facts not returned by either.
 *
 * Mirrors the route style of app/api/ai/draft-communication/route.ts.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getAIConfig, toolCompletion } from '@/lib/ai/service';
import { portfolioToolsFor, runPortfolioTool } from '@/lib/ai/portfolio-tools';
import { requireStaff } from '@/lib/auth/me';
import { buildPortfolioSnapshot } from '@/lib/ai/portfolio-snapshot';
import {
  MAX_ASSISTANT_MESSAGE_CHARS,
  boundedAssistantHistory,
  guardAuthenticatedAssistantRequest,
  type AssistantTurn,
} from '@/lib/ai/request-guard';

const SYSTEM_PROMPT =
  'You are the Portfolio Assistant for a community-association (HOA/condo) property manager. ' +
  'Answer the manager\'s questions ONLY from (a) the DATA snapshot below, which has portfolio-wide totals, ' +
  'and (b) the lookup tools, which return live, read-only details of THEIR portfolio: a homeowner, a unit, ' +
  'delinquent units, open work orders, open violations and vendor bills. ' +
  'Use a tool whenever the question is about a specific owner, unit, association or list that the DATA does not cover. ' +
  'If a lookup is ambiguous (several matches), ask which one. ' +
  'If neither the DATA nor a tool has the answer, say plainly that you don\'t have that information ' +
  'and suggest where in the app they might find it. ' +
  'NEVER invent, estimate, or extrapolate numbers, names, dates, or amounts — only state what the DATA or a tool returned. ' +
  'You can only read; you cannot change anything, so never claim to have done something. ' +
  'If financial figures are marked as not available to the user\'s role, say so; never report them as $0. ' +
  'Be concise and conversational. Format money with a dollar sign and use plain language. ' +
  'List lookups return a total and may be truncated: give the total, never just the rows you were shown. ' +
  'When listing items, use short bullet points. Do not output JSON or code unless asked.';

// Up to 4 lookup rounds; toolCompletion keeps all provider calls within 45s.
export const maxDuration = 60;

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

  const config = await getAIConfig(portfolioId);
  if (!config) {
    return NextResponse.json(
      { error: 'AI not configured', hint: 'Set up AI in Settings → AI.' },
      { status: 400 },
    );
  }

  // Cap prior turns to the last ~6 and keep only well-formed entries.
  const history: AssistantTurn[] = boundedAssistantHistory(body.history);

  try {
    // Staff without finance access can't see charges, payments, bills or bank
    // accounts (RLS),
    // so those figures would read as $0: leave them out instead.
    const canSeeFinance = !!(me.is_finance_staff || me.is_company_admin || me.is_platform_operator);
    const fullSnapshot = await buildPortfolioSnapshot();
    const snapshot = canSeeFinance
      ? fullSnapshot
      : { ...fullSnapshot, receivables: undefined, bills: undefined, recentPayments: undefined, banking: undefined,
          note: 'Financial figures are not available to this user\'s role.' };

    const answer = await toolCompletion(
      config,
      `${SYSTEM_PROMPT}\n\nDATA:\n${JSON.stringify(snapshot)}`,
      [
        ...history.map((t) => ({ role: t.role, content: t.content })),
        { role: 'user' as const, content: question },
      ],
      portfolioToolsFor(canSeeFinance),
      (name, input) => runPortfolioTool(name, input, canSeeFinance, portfolioId),
      { temperature: 0.2, maxRounds: 4, timeBudgetMs: 45_000 },
    );

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
