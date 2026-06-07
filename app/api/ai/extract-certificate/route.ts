/**
 * POST /api/ai/extract-certificate
 * 
 * Upload an HO6 insurance certificate image/PDF and get structured data back.
 * Uses the portfolio's configured AI provider.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getAIConfig, visionCompletion, chatCompletion } from '@/lib/ai/service';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Get user's portfolio
    const { data: profile } = await (supabase as any)
      .from('profiles')
      .select('portfolio_id')
      .eq('id', user.id)
      .single();

    if (!profile?.portfolio_id) {
      return NextResponse.json({ error: 'No portfolio found' }, { status: 400 });
    }

    // Get AI config
    const config = await getAIConfig(profile.portfolio_id);
    if (!config) {
      return NextResponse.json({ error: 'AI not configured. Set up your AI provider in Settings → AI.' }, { status: 400 });
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
    const prompt = `Extract the following from this HO6 insurance certificate. Return ONLY valid JSON:
{
  "policy_number": "string or null",
  "insurance_company": "string or null", 
  "insured_name": "string or null",
  "coverage_amount": number or null,
  "liability_amount": number or null,
  "deductible_amount": number or null,
  "effective_date": "YYYY-MM-DD or null",
  "expiration_date": "YYYY-MM-DD or null",
  "property_address": "string or null",
  "confidence": number 0-100
}`;

    const result = await visionCompletion(config, base64, prompt);
    
    let extracted;
    try {
      extracted = JSON.parse(result);
    } catch {
      // If vision model doesn't support images, try text-only with description
      const fallback = await chatCompletion(config, [
        { role: 'system', content: 'You extract insurance certificate data. Return ONLY valid JSON.' },
        { role: 'user', content: prompt },
      ], { jsonMode: true });
      extracted = JSON.parse(fallback);
    }

    return NextResponse.json({ success: true, data: extracted });

  } catch (error: any) {
    console.error('Certificate extraction error:', error);
    return NextResponse.json({ 
      error: error.message || 'Extraction failed',
      hint: 'Check your AI provider settings and API key.'
    }, { status: 500 });
  }
}
