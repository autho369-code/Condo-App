import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const db = supabase as any;

  const fd = await request.formData();
  const ownerId = String(fd.get('owner_id') || '').trim();
  if (!ownerId) return NextResponse.json({ ok: false, error: 'owner_id required' }, { status: 400 });

  const packet = {
    owner_id: ownerId,
    owner_info: safeJson(fd.get('owner_info')),
    unit_info: safeJson(fd.get('unit_info')),
    emergency_contact: safeJson(fd.get('emergency_contact')),
    vehicle_info: safeJson(fd.get('vehicle_info')),
    pet_info: safeJson(fd.get('pet_info')),
    communication_pref: String(fd.get('communication_pref') || 'email'),
    acknowledgments: safeJson(fd.get('acknowledgments')),
    status: String(fd.get('status') || 'draft'),
    submitted_at: fd.get('status') === 'completed' ? new Date().toISOString() : null,
  };

  const { error } = await db
    .from('owner_packets')
    .upsert(packet, { onConflict: 'owner_id' });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  revalidatePath('/owners/packets');
  revalidatePath(`/owners/${ownerId}`);

  return NextResponse.json({ ok: true });
}

function safeJson(val: any): any {
  try { return typeof val === 'string' ? JSON.parse(val) : val; }
  catch { return val; }
}
