import Link from 'next/link';
import { redirect } from 'next/navigation';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Alert } from '@/components/ui/shell';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const FREQUENCIES = ['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'annually'];
const FORMATS = ['pdf', 'xlsx', 'csv', 'json', 'html'];
const CHANNELS = ['email', 'portal', 'webhook', 'download_only'];
const inputCls = 'h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20';

export default async function NewScheduledReportPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireStaff();
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: definitions } = await (supabase as any)
    .from('report_definitions').select('id, name').eq('active', true).order('name');

  async function createScheduledReport(formData: FormData) {
    'use server';
    const me = await requireStaff();
    const supabase = await createClient();
    const definitionId = (formData.get('definition_id') as string) || null;
    const name = (formData.get('name') as string)?.trim();
    if (!definitionId) redirect('/scheduled-reports/new?error=' + encodeURIComponent('Select a report.'));
    if (!name) redirect('/scheduled-reports/new?error=' + encodeURIComponent('Enter a name for this schedule.'));

    const targets = ((formData.get('delivery_targets') as string) || '')
      .split(/[,;]/).map((s) => s.trim()).filter(Boolean);

    const { error } = await (supabase as any).from('scheduled_reports').insert({
      portfolio_id: me.portfolio?.id,
      definition_id: definitionId,
      name,
      frequency: (formData.get('frequency') as string) || 'monthly',
      output_format: (formData.get('output_format') as string) || 'pdf',
      delivery_channel: (formData.get('delivery_channel') as string) || 'email',
      delivery_targets: targets,
      parameters: {},
      next_run_at: new Date(Date.now() + 86400000).toISOString(),
      active: true,
      created_by: me.auth_user_id,
    });
    if (error) redirect('/scheduled-reports/new?error=' + encodeURIComponent(error.message));
    redirect('/scheduled-reports');
  }

  return (
    <DataWorkspace title="New Scheduled Report" description="Automatically generate and deliver a report on a recurring schedule." actions={<Link href="/scheduled-reports"><Button variant="secondary">Back to scheduled reports</Button></Link>}>
      <form action={createScheduledReport} className="max-w-2xl space-y-5 rounded-2xl border border-gray-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        {sp.error && <Alert tone="danger" title="Could not schedule report">{sp.error}</Alert>}
        <div>
          <Label htmlFor="definition_id">Report <span className="text-red-500">*</span></Label>
          <select id="definition_id" name="definition_id" required className={inputCls}>
            <option value="">Select a report</option>
            {(definitions ?? []).map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div><Label htmlFor="name">Schedule name <span className="text-red-500">*</span></Label><Input id="name" name="name" required placeholder="e.g. Monthly board financials" /></div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <Label htmlFor="frequency">Frequency</Label>
            <select id="frequency" name="frequency" defaultValue="monthly" className={`${inputCls} capitalize`}>{FREQUENCIES.map((f) => <option key={f} value={f}>{f}</option>)}</select>
          </div>
          <div>
            <Label htmlFor="output_format">Format</Label>
            <select id="output_format" name="output_format" defaultValue="pdf" className={`${inputCls} uppercase`}>{FORMATS.map((f) => <option key={f} value={f}>{f}</option>)}</select>
          </div>
          <div>
            <Label htmlFor="delivery_channel">Delivery</Label>
            <select id="delivery_channel" name="delivery_channel" defaultValue="email" className={`${inputCls} capitalize`}>{CHANNELS.map((c) => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}</select>
          </div>
        </div>
        <div>
          <Label htmlFor="delivery_targets">Recipients</Label>
          <Input id="delivery_targets" name="delivery_targets" placeholder="email@example.com, another@example.com" />
          <p className="mt-1 text-xs text-gray-400">Comma-separated email addresses (for email delivery).</p>
        </div>
        <div className="flex items-center justify-between border-t border-gray-100 pt-5">
          <Link href="/scheduled-reports" className="text-sm text-gray-600 hover:text-gray-900">Cancel</Link>
          <Button type="submit" size="lg">Schedule report</Button>
        </div>
      </form>
    </DataWorkspace>
  );
}
