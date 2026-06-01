import { Suspense } from 'react';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import OwnerPacketClient from './packet-client';

export const dynamic = 'force-dynamic';

export default async function OwnerPacketsPage() {
  await requireStaff();
  const supabase = await createClient();
  const db = supabase as any;

  const [{ data: owners }, { data: packets }] = await Promise.all([
    db.from('owners').select('id, full_name, email, archived_at').is('archived_at', null).order('full_name').limit(500),
    db.from('owner_packets').select('*').order('created_at', { ascending: false }).limit(200),
  ]);

  return (
    <Suspense fallback={<div className="p-8 text-gray-400">Loading...</div>}>
      <OwnerPacketClient owners={owners || []} packets={packets || []} />
    </Suspense>
  );
}
