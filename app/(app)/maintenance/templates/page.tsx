import Link from 'next/link';
import { LayoutTemplate, Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { Button } from '@/components/ui/button';
import { Alert, Breadcrumb, EmptyState, PageHeader, PageShell, SectionTitle } from '@/components/ui/shell';

export const dynamic = 'force-dynamic';

export default async function TemplatesPage() {
  await requireStaff();
  const supabase = await createClient();
  const db = supabase as any;

  const { data: templates } = await db.from('maintenance_templates').select('*').order('category');

  const grouped: Record<string, any[]> = {};
  for (const t of templates ?? []) {
    if (!grouped[t.category]) grouped[t.category] = [];
    grouped[t.category].push(t);
  }

  return (
    <PageShell>
      <Breadcrumb items={[{ label: 'Maintenance', href: '/maintenance' }, { label: 'Templates' }]} />
      <PageHeader
        title="Template library"
        description={`${templates?.length ?? 0} starter tasks across ${Object.keys(grouped).length} categories. Click a template to add it to an association.`}
        actions={
          <Link href="/maintenance/new">
            <Button><Plus className="h-4 w-4" /> Custom task</Button>
          </Link>
        }
      />

      <Alert tone="info" title="How templates work:" className="mb-6">
        Templates are starting points. When you apply one, it creates an editable copy for your
        association. Modify frequencies, vendors, reminders — each association&apos;s copy is independent.
      </Alert>

      {Object.keys(grouped).length === 0 ? (
        <div className="rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <EmptyState
            icon={LayoutTemplate}
            title="No templates yet"
            description="Run the seed SQL to populate the library."
          />
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([category, items]) => (
            <section key={category}>
              <SectionTitle title={category} />
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
                {items.map((t: any) => (
                  <Link
                    key={t.id}
                    href={`/maintenance/new?template=${t.id}`}
                    className="group flex items-center justify-between rounded-2xl border border-gray-200/70 bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-shadow hover:shadow-[0_1px_3px_rgba(16,24,40,0.08),0_4px_12px_-4px_rgba(16,24,40,0.1)]"
                  >
                    <div>
                      <div className="font-medium text-gray-900">{t.name}</div>
                      {t.description && <div className="mt-1 text-xs text-gray-500">{t.description}</div>}
                    </div>
                    <span className="text-sm font-medium text-gray-400 opacity-0 transition-opacity group-hover:opacity-100">+ Add</span>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </PageShell>
  );
}
