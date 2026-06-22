/**
 * POST /api/ai/draft-violation-letter
 *
 * Generate an AI-drafted violation notice letter for a homeowner.
 * Staff-only. Uses the association's portfolio BYO-key AI config.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getAIConfig, chatCompletion } from '@/lib/ai/service';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  // Require an authenticated staff user.
  try {
    await requireStaff();
  } catch {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const violationId = body?.violation_id as string | undefined;

    if (!violationId) {
      return NextResponse.json({ error: 'No violation_id provided' }, { status: 400 });
    }

    const supabase = await createClient();
    const db = supabase as any;

    // Load the violation with its association, unit, and owner.
    const { data: violation } = await db
      .from('violations')
      .select(
        `id, title, violation_type, description, date_observed, due_date, hearing_date,
         fine_amount, cure_deadline, governing_document_reference, status,
         association_id, unit_id, owner_id,
         associations(name, portfolio_id),
         units(unit_number),
         owners(full_name, address_street, address_city, address_state, address_zip)`
      )
      .eq('id', violationId)
      .maybeSingle();

    if (!violation) {
      return NextResponse.json({ error: 'Violation not found' }, { status: 404 });
    }

    const portfolioId = violation.associations?.portfolio_id;
    if (!portfolioId) {
      return NextResponse.json(
        { error: 'Association has no portfolio' },
        { status: 400 }
      );
    }

    const config = await getAIConfig(portfolioId);
    if (!config) {
      return NextResponse.json(
        { error: 'AI not configured', hint: 'Set up AI in Settings → AI.' },
        { status: 400 }
      );
    }

    const owner = violation.owners ?? {};
    const mailingLines = [
      owner.full_name,
      owner.address_street,
      [owner.address_city, owner.address_state].filter(Boolean).join(', ') +
        (owner.address_zip ? ` ${owner.address_zip}` : ''),
    ]
      .map((l: string) => (l || '').trim())
      .filter(Boolean)
      .join('\n');

    const todayIso = new Date().toISOString().slice(0, 10);

    const fields: Array<[string, unknown]> = [
      ['Today (letter date)', todayIso],
      ['Association name', violation.associations?.name],
      ['Owner name', owner.full_name],
      ['Owner mailing address', mailingLines || '(not on file)'],
      ['Unit number', violation.units?.unit_number],
      ['Violation title', violation.title],
      ['Violation type', violation.violation_type],
      ['What was observed (description)', violation.description],
      ['Date observed', violation.date_observed],
      ['Cure deadline', violation.cure_deadline],
      ['Due date', violation.due_date],
      ['Hearing date', violation.hearing_date],
      ['Fine amount', violation.fine_amount ? `$${violation.fine_amount}` : null],
      ['Governing document reference', violation.governing_document_reference],
      ['Current status', violation.status],
    ];

    const userMessage =
      'Draft a violation notice letter using only these facts. Omit any field marked "(not provided)" rather than inventing it.\n\n' +
      fields
        .map(([label, value]) => `${label}: ${value ?? '(not provided)'}`)
        .join('\n');

    const systemPrompt =
      'You are an assistant to a community-association (HOA/condo) property manager. ' +
      'Draft a professional, firm but courteous violation notice letter to the homeowner. ' +
      'Use formal business-letter structure (date, owner name + mailing address, salutation, ' +
      'body, next steps, signature block for the management company on behalf of the association). ' +
      'Cite the violation type, what was observed, the date, any cure deadline and fine, and ' +
      'reference the governing documents generically if no specific reference is given. ' +
      'Do NOT invent facts not provided. Keep it under ~350 words. Output plain text only.';

    const text = await chatCompletion(
      config,
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      { temperature: 0.4, maxTokens: 900 }
    );

    return NextResponse.json({ text });
  } catch (error: any) {
    console.error('Violation letter draft error:', error);
    return NextResponse.json(
      {
        error: error?.message || 'Draft failed',
        hint: 'Check your AI provider settings and API key.',
      },
      { status: 500 }
    );
  }
}
