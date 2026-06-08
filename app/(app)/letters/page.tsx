import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function LettersPage() {
  const me = await requireStaff();
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
    <div className="mx-auto h-full max-w-7xl overflow-y-auto px-8 py-6">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink-900">Letters</h1>
          <p className="mt-1 text-sm text-ink-500">
            Document templates with merge fields for owner notices, vendor correspondence, statements, and more.
          </p>
        </div>
        <Link href="/letters/new">
          <Button>+ New template</Button>
        </Link>
      </div>

      {/* Metrics */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
        <Metric label="Total templates" value={templates.length} tone="text-ink-700" />
        <Metric label="Active" value={activeCount} tone="text-emerald-700" />
        <Metric label="Categories" value={Object.keys(categoryCounts).length} tone="text-blue-700" />
        <Metric label="Inactive" value={templates.length - activeCount} tone="text-ink-500" />
      </div>

      {/* Category chips */}
      {Object.keys(categoryCounts).length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {Object.entries(categoryCounts).map(([cat, count]) => (
            <span key={cat} className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium capitalize text-gray-600">
              {cat}
              <span className="text-gray-400">{count}</span>
            </span>
          ))}
        </div>
      )}

      {templates.length === 0 ? (
        <div className="rounded-lg border border-dashed border-ink-200 bg-white px-6 py-12 text-center">
          <h2 className="text-base font-semibold text-ink-900">No letter templates yet</h2>
          <p className="mt-1 text-sm text-ink-500">
            Create your first template with merge fields to start generating letters, notices, and statements.
          </p>
          <div className="mt-4">
            <Link href="/letters/new"><Button>Create first template</Button></Link>
          </div>
        </div>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Name</TH>
              <TH>Category</TH>
              <TH>Subject</TH>
              <TH>Updated</TH>
              <TH>Status</TH>
              <TH className="w-[120px]">Actions</TH>
            </TR>
          </THead>
          <tbody>
            {templates.map((t: any) => (
              <TR key={t.id} className="hover:bg-cream-50">
                <TD className="font-medium text-ink-900">{t.name}</TD>
                <TD className="text-sm capitalize text-ink-600">{t.template_category || 'generic'}</TD>
                <TD className="text-sm text-ink-600 max-w-[300px] truncate">{t.subject || '—'}</TD>
                <TD className="text-sm text-ink-500">{date(t.updated_at)}</TD>
                <TD>
                  {t.active ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">Active</span>
                  ) : (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">Inactive</span>
                  )}
                </TD>
                <TD>
                  <div className="flex items-center gap-1">
                    <Link href={`/letters/${t.id}/edit`} className="rounded px-2 py-1 text-xs text-blue-600 hover:bg-blue-50">Edit</Link>
                    <Link href={`/letters/${t.id}/preview`} className="rounded px-2 py-1 text-xs text-emerald-600 hover:bg-emerald-50">Preview</Link>
                  </div>
                </TD>
              </TR>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-lg border border-ink-100 bg-white px-4 py-3">
      <div className="text-xs font-medium uppercase tracking-wider text-ink-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${tone}`}>{value}</div>
    </div>
  );
}
