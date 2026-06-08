import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { Button } from '@/components/ui/button';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { saveTemplate, deleteTemplate } from '@/lib/rpcs/sms';

export const dynamic = 'force-dynamic';

function formatDate(value: string | null) {
  if (!value) return '-';
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
    <div className="h-full overflow-y-auto bg-gray-50 px-8 py-6">
      <div className="mb-6 flex items-start justify-between gap-6">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            <Link href="/sms" className="hover:text-brand-600">SMS</Link> / Templates
          </div>
          <h1 className="mt-1 text-2xl font-semibold text-gray-900">Message Templates</h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-500">
            Reusable SMS text templates for common messages. Use merge fields like {'{{'}owner_name{'}}'} to personalize.
          </p>
        </div>
        <Link href="/sms/templates/new">
          <Button>+ New template</Button>
        </Link>
      </div>

      {/* Category chips */}
      {categories.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {categories.map((cat: any) => (
            <span key={cat} className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium capitalize text-gray-600">
              {cat}
              <span className="text-gray-400">{rows.filter((t: any) => t.category === cat).length}</span>
            </span>
          ))}
        </div>
      )}

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
          <h2 className="text-base font-semibold text-gray-900">No templates yet</h2>
          <p className="mt-1 text-sm text-gray-500">
            Create your first SMS template to speed up common communications.
          </p>
          <div className="mt-4">
            <Link href="/sms/templates/new"><Button>Create first template</Button></Link>
          </div>
        </div>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Name</TH>
              <TH>Category</TH>
              <TH>Channel</TH>
              <TH>Preview</TH>
              <TH>Updated</TH>
              <TH className="w-[140px]">Actions</TH>
            </TR>
          </THead>
          <tbody>
            {rows.map((t: any) => (
              <TR key={t.id}>
                <TD className="font-medium text-gray-900">{t.name}</TD>
                <TD className="text-sm capitalize text-gray-600">{t.category || 'general'}</TD>
                <TD>
                  <span className={`rounded px-2 py-0.5 text-xs font-medium ${t.channel === 'sms' ? 'bg-blue-100 text-blue-700' : t.channel === 'email' ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700'}`}>
                    {t.channel}
                  </span>
                </TD>
                <TD className="max-w-md truncate text-sm text-gray-600">{t.body}</TD>
                <TD className="text-sm text-gray-500">{formatDate(t.updated_at)}</TD>
                <TD>
                  <div className="flex items-center gap-1">
                    <Link href={`/sms/templates/${t.id}/edit`} className="rounded px-2 py-1 text-xs text-blue-600 hover:bg-blue-50">Edit</Link>
                    <form action={deleteTemplate as any} className="inline">
                      <input type="hidden" name="id" value={t.id} />
                      <button type="submit" className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50" onClick={(e) => { if (!confirm('Delete this template?')) e.preventDefault(); }}>
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
  );
}
