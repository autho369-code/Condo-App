import Link from 'next/link';
import { Mail, Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { MetricStrip } from '@/components/operations/metric-strip';
import { StatusChip } from '@/components/operations/status-chip';
import { EmptyState } from '@/components/ui/shell';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function LettersPage() {
  await requireStaff();
  const supabase = await createClient();

  const { data: rows }: { data: any[] | null } = await (supabase as any)
    .from('document_templates')
    .select('*')
    .is('archived_at', null)
    .order('template_category')
    .order('name');

  const templates = rows ?? [];
  const activeCount = templates.filter((t: any) => t.active).length;

  const categoryCounts: Record<string, number> = {};
  templates.forEach((t: any) => {
    const cat = t.template_category || 'generic';
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
  });

  return (
    <DataWorkspace
      title="Letters"
      description="Document templates with merge fields for owner notices, vendor correspondence, statements, and more."
      actions={
        <Link href="/letters/new">
          <Button><Plus className="h-4 w-4" /> New template</Button>
        </Link>
      }
    >
      <div className="space-y-6">
        <MetricStrip
          metrics={[
            { label: 'Total templates', value: templates.length },
            { label: 'Active', value: activeCount },
            { label: 'Categories', value: Object.keys(categoryCounts).length },
            { label: 'Inactive', value: templates.length - activeCount },
          ]}
        />

        {/* Category chips */}
        {Object.keys(categoryCounts).length > 0 && (
          <div className="flex flex-wrap gap-2">
            {Object.entries(categoryCounts).map(([cat, count]) => (
              <span key={cat} className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium capitalize text-gray-600">
                {cat}
                <span className="text-gray-400">{count}</span>
              </span>
            ))}
          </div>
        )}

        {templates.length === 0 ? (
          <div className="rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <EmptyState
              icon={Mail}
              title="No letter templates yet"
              description="Create your first template with merge fields to start generating letters, notices, and statements."
              action={
                <Link href="/letters/new">
                  <Button><Plus className="h-4 w-4" /> Create first template</Button>
                </Link>
              }
            />
          </div>
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Name</TH>
                <TH>Category</TH>
                <TH>Subject</TH>
                <TH>Updated</TH>
                <TH>Status</TH>
                <TH className="w-[140px]">Actions</TH>
              </tr>
            </THead>
            <tbody>
              {templates.map((t: any) => (
                <TR key={t.id}>
                  <TD className="font-medium text-gray-900">{t.name}</TD>
                  <TD className="capitalize">{t.template_category || 'generic'}</TD>
                  <TD className="max-w-[300px] truncate text-gray-600">{t.subject || '—'}</TD>
                  <TD className="text-gray-500">{date(t.updated_at)}</TD>
                  <TD>
                    <StatusChip tone={t.active ? 'success' : 'neutral'}>
                      {t.active ? 'Active' : 'Inactive'}
                    </StatusChip>
                  </TD>
                  <TD>
                    <div className="flex items-center gap-1">
                      <Link
                        href={`/letters/${t.id}/edit`}
                        className="rounded-lg px-2 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-950"
                      >
                        Edit
                      </Link>
                      <Link
                        href={`/letters/${t.id}/preview`}
                        className="rounded-lg px-2 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-950"
                      >
                        Preview
                      </Link>
                    </div>
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}
      </div>
    </DataWorkspace>
  );
}
