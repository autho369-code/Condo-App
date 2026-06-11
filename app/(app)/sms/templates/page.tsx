import Link from 'next/link';
import { MessageSquareText, Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { StatusChip } from '@/components/operations/status-chip';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/shell';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { deleteTemplate } from '@/lib/rpcs/sms';

export const dynamic = 'force-dynamic';

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default async function SmsTemplatesPage() {
  const me = await requireStaff();
  const supabase = await createClient();
  const db = supabase as any;

  const { data: templates } = await db
    .from('message_templates')
    .select('*')
    .eq('portfolio_id', me.portfolio?.id)
    .order('category')
    .order('name');

  const rows = templates ?? [];
  const categories = [...new Set(rows.map((t: any) => t.category).filter(Boolean))] as string[];

  return (
    <DataWorkspace
      title="Message Templates"
      description={`Reusable SMS text templates for common messages. Use merge fields like {{owner_name}} to personalize.`}
      actions={
        <Link href="/sms/templates/new">
          <Button><Plus className="h-4 w-4" /> New template</Button>
        </Link>
      }
    >
      <div className="space-y-4">
        {/* Category chips */}
        {categories.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {categories.map((cat: any) => (
              <span key={cat} className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium capitalize text-gray-600">
                {cat}
                <span className="text-gray-400">{rows.filter((t: any) => t.category === cat).length}</span>
              </span>
            ))}
          </div>
        )}

        {rows.length === 0 ? (
          <div className="rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <EmptyState
              icon={MessageSquareText}
              title="No templates yet"
              description="Create your first SMS template to speed up common communications."
              action={
                <Link href="/sms/templates/new">
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
                <TH>Channel</TH>
                <TH>Preview</TH>
                <TH>Updated</TH>
                <TH className="w-[140px]">Actions</TH>
              </tr>
            </THead>
            <tbody>
              {rows.map((t: any) => (
                <TR key={t.id}>
                  <TD className="font-medium text-gray-900">{t.name}</TD>
                  <TD className="capitalize text-gray-600">{t.category || 'general'}</TD>
                  <TD>
                    <StatusChip tone={t.channel === 'sms' ? 'info' : t.channel === 'email' ? 'success' : 'neutral'}>
                      {t.channel}
                    </StatusChip>
                  </TD>
                  <TD className="max-w-md truncate text-gray-600">{t.body}</TD>
                  <TD className="text-gray-500">{formatDate(t.updated_at)}</TD>
                  <TD>
                    <div className="flex items-center gap-1">
                      <Link href={`/sms/templates/${t.id}/edit`} className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50">Edit</Link>
                      <form action={deleteTemplate as any} className="inline">
                        <input type="hidden" name="id" value={t.id} />
                        <button type="submit" className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50">
                          Delete
                        </button>
                      </form>
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
