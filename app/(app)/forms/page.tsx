import Link from 'next/link';
import { FileText, Plus } from 'lucide-react';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { FilterBar, FilterSelect } from '@/components/operations/filter-bar';
import { MetricStrip } from '@/components/operations/metric-strip';
import { Button } from '@/components/ui/button';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { StatusChip } from '@/components/operations/status-chip';
import { Alert, EmptyState } from '@/components/ui/shell';
import { FORM_AUDIENCES, audienceLabel, signFormFiles } from '@/lib/forms/files';
import { date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function FormsPage({
  searchParams,
}: {
  searchParams: Promise<{ audience?: string; status?: string; q?: string; saved?: string; error?: string }>;
}) {
  const me = await requireStaff();
  const sp = await searchParams;
  const audience = FORM_AUDIENCES.some((a) => a.value === sp.audience) ? sp.audience! : '';
  const status = sp.status === 'active' || sp.status === 'inactive' ? sp.status : '';
  const term = (sp.q ?? '').replace(/[%_,()*"\\]/g, ' ').trim();

  const db = (await createClient()) as any;
  let query = db.from('form_templates')
    .select('id, portfolio_id, name, description, form_type, audience, file_url, file_path, file_name, active, created_at, updated_at')
    .eq('portfolio_id', me.portfolio?.id)
    .is('archived_at', null);
  if (audience) query = query.eq('audience', audience);
  if (status) query = query.eq('active', status === 'active');
  if (term) query = query.or(`name.ilike.*${term}*,form_type.ilike.*${term}*`);
  const [{ data: forms, error }, { count: portalCount }] = await Promise.all([
    query.order('name'),
    db.from('form_templates').select('id', { count: 'exact', head: true })
      .eq('portfolio_id', me.portfolio?.id).is('archived_at', null).eq('active', true).eq('audience', 'homeowner'),
  ]);

  const rows = (forms ?? []) as any[];
  const links = await signFormFiles(rows);

  return (
    <DataWorkspace
      title="Forms"
      description="Forms homeowners download from the owner portal, plus forms your team keeps for vendors and internal use."
      actions={
        <Link href="/forms/new">
          <Button><Plus className="h-4 w-4" /> New form</Button>
        </Link>
      }
    >
      <div className="space-y-6">
        {sp.saved && <Alert tone="success">{sp.saved}</Alert>}
        {sp.error && <Alert tone="danger">{sp.error}</Alert>}
        {error && <Alert tone="danger" title="Could not load forms:">{error.message}</Alert>}

        <MetricStrip
          metrics={[
            { label: 'Forms', value: rows.length, sublabel: audience || status || term ? 'Matching filters' : 'All active and inactive' },
            { label: 'In the owner portal', value: portalCount ?? 0, sublabel: 'Active homeowner forms' },
          ]}
        />

        <FilterBar action="/forms" searchDefault={sp.q ?? ''} searchPlaceholder="Search name or category">
          <FilterSelect label="Who it's for" name="audience" defaultValue={audience}>
            <option value="">Anyone</option>
            {FORM_AUDIENCES.map((a) => <option key={a.value} value={a.value}>{audienceLabel(a.value)}</option>)}
          </FilterSelect>
          <FilterSelect label="Status" name="status" defaultValue={status}>
            <option value="">Any</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </FilterSelect>
        </FilterBar>

        {rows.length === 0 ? (
          <div className="rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <EmptyState
              icon={FileText}
              title={audience || status || term ? 'No forms match these filters' : 'No forms yet'}
              description="Upload a move-in checklist, parking permit or pet registration form for homeowners to download."
              action={<Link href="/forms/new"><Button><Plus className="h-4 w-4" /> New form</Button></Link>}
            />
          </div>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Form</TH>
                <TH>Who it&apos;s for</TH>
                <TH>Category</TH>
                <TH>File</TH>
                <TH>Status</TH>
                <TH>Updated</TH>
              </TR>
            </THead>
            <tbody>
              {rows.map((f) => {
                const href = links.get(f.id) ?? f.file_url;
                return (
                  <TR key={f.id}>
                    <TD className="max-w-xs">
                      <Link href={`/forms/${f.id}`} className="font-medium text-gray-950 hover:underline">{f.name}</Link>
                      {f.description && <div className="mt-0.5 line-clamp-1 text-xs text-gray-500">{f.description}</div>}
                    </TD>
                    <TD className="whitespace-nowrap text-gray-600">{audienceLabel(f.audience)}</TD>
                    <TD className="capitalize text-gray-600">{f.form_type ? f.form_type.replace(/_/g, ' ') : '—'}</TD>
                    <TD>
                      {href ? (
                        <a href={href} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-gray-600 hover:text-gray-950 hover:underline">
                          {f.file_path ? (f.file_name ?? 'Download') : 'Open link'}
                        </a>
                      ) : (
                        <span className="text-xs text-gray-400">No file</span>
                      )}
                    </TD>
                    <TD><StatusChip tone={f.active ? 'success' : 'neutral'}>{f.active ? 'Active' : 'Inactive'}</StatusChip></TD>
                    <TD className="whitespace-nowrap text-gray-600">{date(f.updated_at ?? f.created_at)}</TD>
                  </TR>
                );
              })}
            </tbody>
          </Table>
        )}
      </div>
    </DataWorkspace>
  );
}
