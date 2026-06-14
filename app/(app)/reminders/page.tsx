import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, Surface } from '@/components/ui/shell';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { ALERT_TYPES, computeReminders } from '@/lib/reminders';

export const dynamic = 'force-dynamic';

async function saveReminderSettings(formData: FormData) {
  'use server';
  const me = await requireStaff();
  const supabase = await createClient();
  const rows = ALERT_TYPES.map((t) => ({
    portfolio_id: me.portfolio?.id,
    alert_type: t.key,
    enabled: formData.get(`enabled_${t.key}`) === 'on',
    lead_days: Math.max(0, parseInt(formData.get(`lead_${t.key}`) as string, 10) || t.defaultLeadDays),
    updated_at: new Date().toISOString(),
  }));
  const { error } = await (supabase as any).from('reminder_settings').upsert(rows, { onConflict: 'portfolio_id,alert_type' });
  if (error) redirect(`/reminders?error=${encodeURIComponent(error.message)}`);
  revalidatePath('/reminders');
  revalidatePath('/dashboard');
  redirect('/reminders?saved=1');
}

export default async function RemindersPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const me = await requireStaff();
  const sp = await searchParams;
  const supabase = await createClient();

  const { data: settingsRows } = await (supabase as any)
    .from('reminder_settings').select('alert_type, enabled, lead_days').eq('portfolio_id', me.portfolio?.id);
  const byType = new Map<string, { enabled: boolean; lead_days: number }>();
  for (const r of settingsRows ?? []) byType.set(r.alert_type, r);

  // Live preview of what's currently due.
  const groups = await computeReminders(supabase as any, me.portfolio?.id);
  const countByType = new Map(groups.map((g) => [g.key, g.items.length]));

  return (
    <DataWorkspace
      title="Reminders"
      description="Choose which alerts appear on your dashboard and how many days in advance."
    >
      <div className="max-w-3xl space-y-4">
        {sp.error && <Alert tone="danger" title="Could not save">{sp.error}</Alert>}
        {sp.saved === '1' && <Alert tone="success" title="Reminder settings saved" />}

        <Surface>
          <form action={saveReminderSettings} className="space-y-3">
            {ALERT_TYPES.map((t) => {
              const cur = byType.get(t.key);
              const enabled = cur?.enabled ?? true;
              const leadDays = cur?.lead_days ?? t.defaultLeadDays;
              const dueNow = countByType.get(t.key) ?? 0;
              return (
                <div key={t.key} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 p-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-2 text-sm font-medium text-gray-900">
                        <input type="checkbox" name={`enabled_${t.key}`} defaultChecked={enabled} className="accent-blue-600" />
                        {t.label}
                      </label>
                      {dueNow > 0 && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">{dueNow} due now</span>}
                    </div>
                    <p className="mt-1 text-xs text-gray-500">{t.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input name={`lead_${t.key}`} type="number" min={0} defaultValue={leadDays} className="w-20" />
                    <span className="text-xs text-gray-500">{t.leadLabel}</span>
                  </div>
                </div>
              );
            })}
            <div className="flex justify-end pt-2">
              <Button type="submit">Save reminder settings</Button>
            </div>
          </form>
        </Surface>
      </div>
    </DataWorkspace>
  );
}
