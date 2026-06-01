import { Suspense } from 'react';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import OwnerFormsClient from './forms-client';

export const dynamic = 'force-dynamic';

export default async function OwnerFormsPage() {
  await requireStaff();
  const supabase = await createClient();
  const db = supabase as any;

  const [{ data: owners }, { data: submissions }] = await Promise.all([
    db.from('owners').select('id, full_name, email, archived_at').is('archived_at', null).order('full_name').limit(500),
    db.from('owner_form_submissions').select('id, owner_id, form_type, status, form_data, submitted_at').order('submitted_at', { ascending: false }).limit(500),
  ]);

  return (
    <Suspense fallback={<div className="p-8 text-gray-400">Loading forms...</div>}>
      <OwnerFormsClient owners={owners || []} submissions={submissions || []} />
    </Suspense>
  );
}
