/**
 * POST /api/ai/vendor-assistant
 *
 * AI Vendor Assistant — answers a vendor's questions from a live, RLS-scoped
 * snapshot of THEIR assigned jobs, schedule, bills, and compliance dates.
 * Same safety model as the other assistants: no NL→SQL, snapshot-only, no
 * invented numbers. BYO AI key read via the service client (vendors cannot
 * read the portfolios row; the key never leaves the server).
 */
import { NextRequest, NextResponse } from 'next/server';
import { chatCompletion, getAIConfig, type AIConfig } from '@/lib/ai/service';
import { requireVendor } from '@/lib/auth/me';
import { buildVendorSnapshot } from '@/lib/ai/vendor-snapshot';
import { createServiceClient } from '@/lib/supabase/server';
import {
  MAX_ASSISTANT_MESSAGE_CHARS,
  boundedAssistantHistory,
  guardAuthenticatedAssistantRequest,
  type AssistantTurn,
} from '@/lib/ai/request-guard';

const SYSTEM_PROMPT =
  'You are the AI Assistant for a contractor/vendor portal in a condominium management platform. ' +
  'You are speaking with a VENDOR. Answer their questions ONLY from the DATA provided below — a live, ' +
  'read-only snapshot of THEIR assigned work orders, schedule, bills, and compliance documents. ' +
  'If the answer is not in the DATA, say so plainly and suggest contacting the property manager. ' +
  'NEVER invent, estimate, or extrapolate numbers, dates, or amounts. ' +
  'Be brief and practical; format money with a dollar sign. Do not output JSON or code unless asked.';

async function getVendorAIConfig(vendorId: string): Promise<AIConfig | null> {
  const svc = createServiceClient() as any;
  const { data: vendor } = await svc.from('vendors').select('portfolio_id').eq('id', vendorId).maybeSingle();
  if (!vendor?.portfolio_id) return null;

  return getAIConfig(vendor.portfolio_id, svc);
}

export async function POST(request: NextRequest) {
  let me;
  try {
    me = await requireVendor();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!me.vendor_id) {
    return NextResponse.json({ error: 'No vendor record linked to your account.' }, { status: 400 });
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

  const config = await getVendorAIConfig(me.vendor_id);
  if (!config) {
    return NextResponse.json(
      { error: 'AI not configured', hint: 'AI is not enabled by the management company yet.' },
      { status: 400 },
    );
  }

  const history: AssistantTurn[] = boundedAssistantHistory(body.history);

  try {
    const snapshot = await buildVendorSnapshot();

    const messages = [
      { role: 'system' as const, content: `${SYSTEM_PROMPT}\n\nDATA:\n${JSON.stringify(snapshot)}` },
      ...history.map((t) => ({ role: t.role, content: t.content })),
      { role: 'user' as const, content: question },
    ];

    const answer = await chatCompletion(config, messages, { temperature: 0.2 });

    return NextResponse.json({ answer: (answer ?? '').trim() });
  } catch (error: any) {
    console.error('Vendor assistant error:', error);
    return NextResponse.json(
      { error: error?.message || 'Assistant failed', hint: 'Please try again or contact the property manager.' },
      { status: 500 },
    );
  }
}
