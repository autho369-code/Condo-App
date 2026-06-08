import Link from 'next/link';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { StatusChip } from '@/components/operations/status-chip';
import { Button } from '@/components/ui/button';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function TemplateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireStaff();
  const { id } = await params;

  const supabase = await createClient();
  const db = supabase as any;

  const { data: template } = await db
    .from('document_templates')
    .select('*')
    .eq('id', id)
    .single();

  if (!template) {
    return (
      <DataWorkspace title="Template Not Found" description="The template you're looking for doesn't exist.">
        <div className="rounded border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
          <p className="text-sm text-gray-500">Template not found. It may have been deleted or archived.</p>
          <Link href="/documents?tab=templates" className="mt-3 inline-block text-sm text-blue-700 hover:underline">
            Back to Templates
          </Link>
        </div>
      </DataWorkspace>
    );
  }

  const mergeVars = template.merge_variables ?? {};
  const varKeys = Array.isArray(mergeVars) ? mergeVars.map((v: any) => v.key ?? v.name ?? v) : Object.keys(mergeVars);

  return (
    <DataWorkspace
      title={template.name}
      description={`${(template.letter_type ?? 'general').replace(/_/g, ' ')} template`}
      actions={
        <div className="flex gap-2">
          <Link href={`/documents/generate?template=${id}`}>
            <Button>Use Template</Button>
          </Link>
          <Link href={`/documents/templates/${id}/edit`}>
            <Button variant="secondary">Edit</Button>
          </Link>
        </div>
      }
    >
      <div className="max-w-3xl space-y-6">
        {/* Template info */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-xs font-medium text-gray-500">Type</div>
              <div className="mt-0.5 capitalize text-gray-900">{(template.letter_type ?? 'general').replace(/_/g, ' ')}</div>
            </div>
            <div>
              <div className="text-xs font-medium text-gray-500">Status</div>
              <div className="mt-0.5">
                <StatusChip tone={template.active ? 'success' : 'neutral'}>
                  {template.active ? 'Active' : 'Inactive'}
                </StatusChip>
              </div>
            </div>
            <div>
              <div className="text-xs font-medium text-gray-500">Created</div>
              <div className="mt-0.5 text-gray-900">{date(template.created_at)}</div>
            </div>
            <div>
              <div className="text-xs font-medium text-gray-500">Updated</div>
              <div className="mt-0.5 text-gray-900">{date(template.updated_at)}</div>
            </div>
          </div>

          {template.subject && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="text-xs font-medium text-gray-500">Subject</div>
              <div className="mt-0.5 text-sm text-gray-900">{template.subject}</div>
            </div>
          )}
        </div>

        {/* Merge variables */}
        {varKeys.length > 0 && (
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="mb-3 text-sm font-semibold text-gray-950">Merge Variables</h2>
            <div className="flex flex-wrap gap-1">
              {varKeys.map((v: string) => (
                <span
                  key={v}
                  className="rounded-full bg-brand-50 border border-brand-200 px-2 py-0.5 text-xs text-brand-700"
                >
                  {'{{'}
                  {v}
                  {'}}'}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Body preview */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-3 text-sm font-semibold text-gray-950">Template Body</h2>
          <div className="rounded border border-gray-100 bg-gray-50 p-6">
            <pre className="whitespace-pre-wrap font-sans text-sm text-gray-800 leading-relaxed">{template.body}</pre>
          </div>
        </div>

        <div className="flex gap-2 pb-8">
          <Link href="/documents?tab=templates">
            <Button variant="secondary">Back to Templates</Button>
          </Link>
        </div>
      </div>
    </DataWorkspace>
  );
}
