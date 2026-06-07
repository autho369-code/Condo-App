/**
 * POST /api/ai/analyze-violation-photo
 * 
 * Upload a photo of a potential rule violation and get AI analysis back.
 * No auth required — this is a public endpoint for the violation report form.
 * Uses the association's portfolio AI config.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getAIConfig, visionCompletion } from '@/lib/ai/service';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const associationId = formData.get('association_id') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No photo provided' }, { status: 400 });
    }
    if (!associationId) {
      return NextResponse.json({ error: 'No association_id provided' }, { status: 400 });
    }

    const supabase = await createClient();
    const db = supabase as any;

    // Get the portfolio_id for this association
    const { data: association } = await db
      .from('associations')
      .select('portfolio_id')
      .eq('id', associationId)
      .single();

    if (!association?.portfolio_id) {
      return NextResponse.json({ error: 'Association not found or has no portfolio' }, { status: 400 });
    }

    // Get AI config for this portfolio
    const config = await getAIConfig(association.portfolio_id);
    if (!config) {
      return NextResponse.json({
        error: 'AI not configured for this association',
        hint: 'The property manager has not set up AI features yet.',
      }, { status: 400 });
    }

    // Fetch the house rules for the association (to include in prompt)
    const { data: rules } = await db
      .from('house_rules')
      .select('id, rule_number, title, description, category, penalty_type, fine_amount')
      .eq('association_id', associationId)
      .eq('active', true)
      .order('sort_order');

    // Convert file to base64
    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString('base64');

    // Build the rules context for the prompt
    const rulesContext = rules?.length
      ? rules.map((r: any) =>
          `Rule ${r.rule_number} — ${r.title} [ID: ${r.id}] [Category: ${r.category}] [Penalty: ${r.penalty_type === 'fine' ? `$${r.fine_amount}` : r.penalty_type}]: ${r.description}`
        ).join('\n')
      : 'No house rules available.';

    // Prompt the AI
    const prompt = `You are analyzing a photo of a potential condominium rule violation. Below are the active house rules for this association. Analyze the photo and return a JSON object with the following fields:

- "violation_type": one of ["noise","construction","pet","parking","harassment","smoking","waste","subletting","balcony","other"]
- "severity": one of ["low","medium","high","critical"]
- "description": a detailed description of what visible violation is in the photo (2-4 sentences)
- "matched_house_rule_id": the ID of the closest matching house rule from the list below, or null if none match
- "matched_rule_explanation": a brief explanation (1 sentence) of why this rule matches, or why no rule matches
- "confidence": number 0-100 representing how confident you are in this analysis

HOUSE RULES:
${rulesContext}

Return ONLY valid JSON. Do not include any other text.`;

    const result = await visionCompletion(config, base64, prompt);

    let extracted;
    try {
      extracted = JSON.parse(result);
    } catch {
      return NextResponse.json({
        error: 'AI returned invalid response',
        hint: 'Try again with a clearer photo.',
      }, { status: 500 });
    }

    // Validate and sanitize
    const validTypes = ['noise', 'construction', 'pet', 'parking', 'harassment', 'smoking', 'waste', 'subletting', 'balcony', 'other'];
    const validSeverities = ['low', 'medium', 'high', 'critical'];

    return NextResponse.json({
      success: true,
      data: {
        violation_type: validTypes.includes(extracted.violation_type) ? extracted.violation_type : 'other',
        severity: validSeverities.includes(extracted.severity) ? extracted.severity : 'medium',
        description: extracted.description || null,
        matched_house_rule_id: extracted.matched_house_rule_id || null,
        matched_rule_explanation: extracted.matched_rule_explanation || null,
        confidence: typeof extracted.confidence === 'number' ? extracted.confidence : null,
      },
    });

  } catch (error: any) {
    console.error('Violation photo analysis error:', error);
    return NextResponse.json({
      error: error.message || 'Analysis failed',
      hint: 'Check your AI provider settings and API key.',
    }, { status: 500 });
  }
}
