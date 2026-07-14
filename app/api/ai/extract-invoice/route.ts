/**
 * POST /api/ai/extract-invoice
 *
 * Upload a vendor invoice image/PDF and get a structured vendor-bill draft back.
 * Staff-only. Uses the portfolio's configured AI provider (BYO key),
 * same pattern as /api/ai/extract-certificate.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getAIConfig, visionCompletion, chatCompletion } from '@/lib/ai/service';
import { requireStaff, type MeResult } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  // Require an authenticated staff user (server routes are callable endpoints).
  let me: MeResult;
  try {
    me = await requireStaff();
  } catch {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  try {
    // Resolve the caller's portfolio (fall back to profiles like extract-certificate).
    let portfolioId: string | null = me.portfolio?.id ?? null;
    if (!portfolioId) {
      const supabase = await createClient();
      const { data: profile } = await (supabase as any)
        .from('profiles')
        .select('portfolio_id')
        .eq('id', me.auth_user_id)
        .single();
      portfolioId = profile?.portfolio_id ?? null;
    }
    if (!portfolioId) {
      return NextResponse.json({ error: 'No portfolio found' }, { status: 400 });
    }

    // Get AI config
    const config = await getAIConfig(portfolioId);
    if (!config) {
      return NextResponse.json(
        { error: 'AI not configured. Set up your AI provider in Settings → AI.' },
        { status: 400 },
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Convert file to base64
    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString('base64');

    // Extract using vision AI
    const prompt = `Extract the following from this vendor invoice. Return ONLY valid JSON:
{
  "vendor_name": "string or null (the company that ISSUED the invoice, not the bill-to party)",
  "invoice_number": "string or null",
  "invoice_date": "YYYY-MM-DD or null",
  "due_date": "YYYY-MM-DD or null",
  "total_amount": number or null (the grand total due, after tax),
  "line_items": [{ "description": "string", "amount": number }],
  "suggested_gl_hint": "string or null — a short expense-category guess such as Landscaping, Plumbing, Electrical, Utilities, Insurance, Legal, Janitorial, Repairs & Maintenance",
  "confidence": number 0-100
}`;

    const result = await visionCompletion(config, base64, prompt);

    let extracted;
    try {
      extracted = JSON.parse(result);
    } catch {
      // If vision model doesn't support images, try text-only with description
      const fallback = await chatCompletion(config, [
        { role: 'system', content: 'You extract vendor invoice data. Return ONLY valid JSON.' },
        { role: 'user', content: prompt },
      ], { jsonMode: true });
      extracted = JSON.parse(fallback);
    }

    return NextResponse.json({ success: true, data: extracted });

  } catch (error: any) {
    console.error('Invoice extraction error:', error);
    return NextResponse.json({
      error: error.message || 'Extraction failed',
      hint: 'Check your AI provider settings and API key.',
    }, { status: 500 });
  }
}
