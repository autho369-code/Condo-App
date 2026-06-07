import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';

export const dynamic = 'force-dynamic';

export default async function MaintenancePage() {
  await requireStaff();
  const supabase = await createClient();
  const db = supabase as any;

  const { data: tasks } = await db.from('maintenance_tasks').select('id,task_name').limit(10);
  const { data: templates } = await db.from('maintenance_templates').select('id,name');

  return (
    <div className="px-8 py-6">
      <h1 className="text-2xl font-semibold">Preventive maintenance</h1>
      <p className="text-sm text-ink-500">Tasks: {tasks?.length ?? 0} · Templates: {templates?.length ?? 0}</p>
      <div className="mt-4 flex gap-3">
        <Link href="/maintenance/new" className="rounded bg-brand-600 px-4 py-2 text-white text-sm">+ Add task</Link>
        <Link href="/maintenance/templates" className="rounded border px-4 py-2 text-sm">Templates</Link>
      </div>
    </div>
  );
}
