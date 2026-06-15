import Link from 'next/link';
import { FileText, Plus } from 'lucide-react';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { Button } from '@/components/ui/button';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { StatusChip } from '@/components/operations/status-chip';
import { EmptyState } from '@/components/ui/shell';
import { date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function FormsPage() {
  const me = await requireStaff();
  const supabase = await createClient();

  const { data: forms } = await (supabase as any)
    .from('form_templates')
    .select('id, name, description, form_type, file_url, active, created_at')
    .eq('portfolio_id', me.portfolio?.id)
    .is('archived_at', null)
    .order('created_at', { ascending: false });

  const rows = (forms ?? []) as any[];

  return (
    <DataWorkspace
      title="Forms"
      description="Form templates owners and vendors can complete — move-in checklists, architectural change requests, key-fob forms."
      actions={
        <Link href="/forms/new">
          <Button><Plus className="h-4 w-4" /> New form</Button>
        </Link>
      }
    >
      {rows.length === 0 ? (
        <div className="rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <EmptyState
            icon={FileText}
            title="No forms yet"
            description="Create a form template owners or vendors can complete."
            action={
              <Link href="/forms/new">
                <Button><Plus className="h-4 w-4" /> New form</Button>
              </Link>
            }
          />
        </div>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Form</TH>
              <TH>Type</TH>
              <TH>Created</TH>
              <TH>Status</TH>
              <TH>File</TH>
            </TR>
          </THead>
          <tbody>
            {rows.map((f) => (
              <TR key={f.id}>
                <TD>
                  <div className="font-medium text-gray-950">{f.name}</div>
                  {f.description && (
                    <div className="mt-0.5 text-xs text-gray-500 line-clamp-1">{f.description}</div>
                  )}
                </TD>
                <TD className="capitalize text-gray-600">{f.form_type ? f.form_type.replace(/_/g, ' ') : '—'}</TD>
                <TD className="whitespace-nowrap text-gray-600">{date(f.created_at)}</TD>
                <TD>
                  <StatusChip tone={f.active ? 'success' : 'neutral'}>
                    {f.active ? 'Active' : 'Inactive'}
                  </StatusChip>
                </TD>
                <TD>
                  {f.file_url ? (
                    <a
                      href={f.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-gray-600 hover:text-gray-950 hover:underline"
                    >
                      Open
                    </a>
                  ) : (
                    <span className="text-xs text-gray-400">—</span>
                  )}
                </TD>
              </TR>
            ))}
          </tbody>
        </Table>
      )}
    </DataWorkspace>
  );
}
