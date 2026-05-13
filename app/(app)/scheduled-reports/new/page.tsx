import Link from 'next/link';
import { createScheduledReport } from '@/lib/rpcs/scheduled-reports';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { ModulePage } from '@/components/workspace/module-page';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { orderedReportFormats } from '@/lib/reports/exporter';

export const dynamic = 'force-dynamic';

export default async function NewScheduledReportPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireStaff();
  const { error } = await searchParams;
  const supabase = await createClient();

  const [{ data: definitions }, { data: associations }] = await Promise.all([
    (supabase as any)
      .from('report_definitions')
      .select('id, name, slug, category, output_formats')
      .eq('active', true)
      .order('name'),
    (supabase as any)
      .from('associations')
      .select('id, name')
      .is('archived_at', null)
      .order('name'),
  ]);
  const formats = orderedReportFormats(Array.from(new Set((definitions ?? []).flatMap((definition: any) => definition.output_formats ?? []))));

  return (
    <ModulePage
      title="New Scheduled Report"
      description="Create a recurring report run with portfolio or association scope."
      breadcrumb={[{ href: '/scheduled-reports', label: 'Scheduled Reports' }]}
    >
      <form action={createScheduledReport as any} className="max-w-3xl space-y-6 rounded border border-ink-100 bg-white p-6">
        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-700">Schedule name</label>
            <Input name="name" required placeholder="Monthly board packet" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-700">Report</label>
            <select name="definition_id" required className="h-10 w-full rounded-md border border-ink-200 bg-white px-3 text-sm">
              <option value="">Choose a report</option>
              {(definitions ?? []).map((definition: any) => (
                <option key={definition.id} value={definition.id}>{definition.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-700">Frequency</label>
            <select name="frequency" defaultValue="monthly" className="h-10 w-full rounded-md border border-ink-200 bg-white px-3 text-sm">
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="biweekly">Biweekly</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="annually">Annually</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-700">Day of week</label>
            <select name="day_of_week" defaultValue="1" className="h-10 w-full rounded-md border border-ink-200 bg-white px-3 text-sm">
              <option value="1">Monday</option>
              <option value="2">Tuesday</option>
              <option value="3">Wednesday</option>
              <option value="4">Thursday</option>
              <option value="5">Friday</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-700">Day of month</label>
            <Input name="day_of_month" type="number" min="1" max="28" defaultValue="1" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-700">UTC hour</label>
            <Input name="hour_utc" type="number" min="0" max="23" defaultValue="9" />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-700">Scope</label>
            <select name="param_scope" defaultValue="portfolio" className="h-10 w-full rounded-md border border-ink-200 bg-white px-3 text-sm">
              <option value="portfolio">Portfolio</option>
              <option value="association">Association</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-700">Association</label>
            <select name="param_association_id" className="h-10 w-full rounded-md border border-ink-200 bg-white px-3 text-sm">
              <option value="">All associations</option>
              {(associations ?? []).map((association: any) => (
                <option key={association.id} value={association.id}>{association.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-700">Format</label>
            <select name="output_format" defaultValue="pdf" className="h-10 w-full rounded-md border border-ink-200 bg-white px-3 text-sm">
              {formats.map((format) => (
                <option key={format} value={format}>{format.toUpperCase()}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-ink-500">PDF is the printable default. XLSX and CSV are for row review.</p>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-ink-700">Delivery</label>
          <select name="delivery_channel" defaultValue="download_only" className="h-10 w-full max-w-xs rounded-md border border-ink-200 bg-white px-3 text-sm">
            <option value="download_only">Save to run history</option>
            <option value="portal">Portal</option>
            <option value="email">Email</option>
          </select>
        </div>

        <div className="flex items-center gap-3">
          <Button type="submit">Create schedule</Button>
          <Link href="/scheduled-reports" className="text-sm text-ink-600 hover:text-ink-900">Cancel</Link>
        </div>
      </form>
    </ModulePage>
  );
}
