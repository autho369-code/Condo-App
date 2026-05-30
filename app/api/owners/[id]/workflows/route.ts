import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: ownerId } = await params;
  const supabase = await createClient();
  const db = supabase as any;

  // Portal invite
  const { data: portal } = await db
    .from('owner_portal_invites')
    .select('status, sent_at, last_login_at')
    .eq('owner_id', ownerId)
    .maybeSingle();

  // Owner packet
  const { data: packet } = await db
    .from('owner_packets')
    .select('status, submitted_at')
    .eq('owner_id', ownerId)
    .maybeSingle();

  // Form submissions
  const { data: forms } = await db
    .from('owner_form_submissions')
    .select('form_type, status')
    .eq('owner_id', ownerId);

  const totalForms = 7; // all form types
  const submitted = (forms || []).filter((f: any) => f.status === 'submitted').length;

  // ACH status
  const { data: ach } = await db
    .from('owner_ach_status')
    .select('status')
    .eq('owner_id', ownerId)
    .maybeSingle();

  // Management agreement
  const { data: agreement } = await db
    .from('management_agreements')
    .select('id, status')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({
    portal: portal || { status: 'not_invited', sent_at: null, last_login: null },
    packet: packet || { status: 'draft', submitted_at: null },
    forms: { total: totalForms, submitted },
    ach: ach || { status: 'not_started' },
    agreement: agreement || { status: 'draft', id: null },
  });
}
