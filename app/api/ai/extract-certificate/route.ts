/**
 * POST /api/ai/extract-certificate
 * 
 * Upload an HO6 insurance certificate image/PDF and get structured data back.
 * Uses the portfolio's configured AI provider.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getAIConfig, visionCompletion } from '@/lib/ai/service';
import { requireWorkspaceStaff } from '@/lib/auth/me';

// Certificates are a page or two; anything bigger is not one (and would be
// read into memory and sent to the AI provider whole).
const MAX_BYTES = 10 * 1024 * 1024;
// The image types visionCompletion sends to every provider (PDF/HEIC would
// need a separate document path).
const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

export async function POST(request: NextRequest) {
  const me = await requireWorkspaceStaff();
  try {
    const portfolioId = me.portfolio?.id as string | undefined;
    if (!portfolioId) {
      return NextResponse.json({ error: 'No portfolio found' }, { status: 400 });
    }

    // Get AI config
    const config = await getAIConfig(portfolioId);
    if (!config) {
      return NextResponse.json({ error: 'AI not configured. Set up your AI provider in Settings → AI.' }, { status: 400 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    
    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'That file is larger than 10 MB. Upload a photo or screenshot of the certificate page.' }, { status: 413 });
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ error: 'Upload the certificate as a PNG, JPEG, WebP or GIF image (take a screenshot of a PDF page).' }, { status: 415 });
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

    const result = await visionCompletion(config, base64, prompt, file.type);
    
    // No text-only fallback: without the document a model can only invent
    // policy numbers and dates.
    const extracted = parseJsonObject(result);
    if (!extracted) {
      return NextResponse.json({
        error: 'The AI could not read that certificate. Enter the details by hand, or try a clearer scan.',
      }, { status: 422 });
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

/** The model's JSON object, also when it wraps it in prose or a code fence. */
function parseJsonObject(text: string): Record<string, unknown> | null {
  const candidates = [text, text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)];
  for (const c of candidates) {
    try {
      const v = JSON.parse(c);
      if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
    } catch {
      // try the next candidate
    }
  }
  return null;
}
