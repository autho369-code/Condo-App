/**
 * POST /api/ai/draft-communication
 *
 * Communications copilot — given a short instruction and a tone, draft a
 * ready-to-send email (subject + body) for homeowners/residents. Uses the
 * staff member's portfolio BYO AI config.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getAIConfig, chatCompletion } from '@/lib/ai/service';
import { requireStaff } from '@/lib/auth/me';

type Tone = 'professional' | 'friendly' | 'urgent' | 'formal';
const VALID_TONES: Tone[] = ['professional', 'friendly', 'urgent', 'formal'];

const SYSTEM_PROMPT =
  'You are an assistant to a community-association property manager writing an email to homeowners/residents. ' +
  'Given a short instruction and a tone, produce a clear, well-structured email. ' +
  'Return JSON: {"subject": string, "body": string}. ' +
  "The body should be plain text with paragraph breaks, ready to send, signed generically as 'Your Management Team'. " +
  'Keep it concise and on-topic; do not invent specific dates/amounts not given.';

export async function POST(request: NextRequest) {
  // Require staff
  let me;
  try {
    me = await requireStaff();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const portfolioId = me.portfolio?.id;
  if (!portfolioId) {
    return NextResponse.json({
      error: 'AI not configured',
      hint: 'Set up AI in Settings → AI.',
    }, { status: 400 });
  }

  let body: { prompt?: string; tone?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const prompt = (body.prompt ?? '').trim();
  if (!prompt) {
    return NextResponse.json({ error: 'Please describe what you want to say.' }, { status: 400 });
  }

  const tone: Tone = VALID_TONES.includes(body.tone as Tone) ? (body.tone as Tone) : 'professional';

  const config = await getAIConfig(portfolioId);
  if (!config) {
    return NextResponse.json({
      error: 'AI not configured',
      hint: 'Set up AI in Settings → AI.',
    }, { status: 400 });
  }

  try {
    const result = await chatCompletion(
      config,
      [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Tone: ${tone}\nInstruction: ${prompt}` },
      ],
      { jsonMode: true },
    );

    let parsed: { subject?: string; body?: string };
    try {
      parsed = JSON.parse(result);
    } catch {
      return NextResponse.json({
        error: 'AI returned an unexpected response',
        hint: 'Try rephrasing your instruction.',
      }, { status: 500 });
    }

    return NextResponse.json({
      subject: parsed.subject ?? '',
      body: parsed.body ?? '',
    });
  } catch (error: any) {
    console.error('Draft communication error:', error);
    return NextResponse.json({
      error: error?.message || 'Draft failed',
      hint: 'Check your AI provider settings and API key.',
    }, { status: 500 });
  }
}
