import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const db = supabase as any;

  const formData = await request.formData();
  const ownerId = String(formData.get('owner_id') || '').trim();
  const formType = String(formData.get('form_type') || '').trim();

  if (!ownerId || !formType) {
    return NextResponse.json({ ok: false, error: 'owner_id and form_type required' }, { status: 400 });
  }

  // Collect all form fields
  const data: Record<string, any> = {};
  for (const [key, value] of formData.entries()) {
    if (!['owner_id', 'form_type'].includes(key)) {
      data[key] = value;
    }
  }

  // Upsert: one per owner per form type
  const { error } = await db
    .from('owner_form_submissions')
    .upsert({
      owner_id: ownerId,
      form_type: formType,
      form_data: data,
      status: 'submitted',
      submitted_at: new Date().toISOString(),
    }, { onConflict: 'owner_id,form_type' });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  revalidatePath('/owners/forms');
  revalidatePath(`/owners/${ownerId}`);

  return NextResponse.json({ ok: true });
}
