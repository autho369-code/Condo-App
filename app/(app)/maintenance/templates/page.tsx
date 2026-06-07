import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { Button } from '@/components/ui/button';

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
    <div className="mx-auto h-full max-w-5xl overflow-y-auto px-8 py-6">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <nav className="text-xs font-semibold uppercase tracking-wider text-ink-500">
            <Link href="/maintenance" className="hover:text-ink-700">Maintenance</Link>
            <span className="mx-2">/</span>
            Templates
          </nav>
          <h1 className="mt-2 text-2xl font-semibold text-ink-900">Template library</h1>
          <p className="mt-1 text-sm text-ink-500">
            {templates?.length ?? 0} starter tasks across {Object.keys(grouped).length} categories. Click a template to add it to an association.
          </p>
        </div>
        <Link href="/maintenance/new"><Button>+ Custom task</Button></Link>
      </div>

      <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
        <strong>How templates work:</strong> Templates are starting points. When you apply one, it creates an editable copy for your association.
        Modify frequencies, vendors, reminders — each association's copy is independent.
      </div>

      {Object.keys(grouped).length === 0 ? (
        <div className="rounded-lg border border-dashed border-ink-200 bg-white px-6 py-12 text-center">
          <p className="text-ink-500">No templates yet. Run the seed SQL to populate the library.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([category, items]) => (
            <section key={category}>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-500">{category}</h2>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
                {items.map((t: any) => (
                  <Link
                    key={t.id}
                    href={`/maintenance/new?template=${t.id}`}
                    className="group flex items-center justify-between rounded-lg border border-ink-100 bg-white p-4 hover:border-champagne-300 hover:bg-cream-50 transition-colors"
                  >
                    <div>
                      <div className="font-medium text-ink-900 group-hover:text-champagne-700">{t.name}</div>
                      {t.description && <div className="mt-1 text-xs text-ink-500">{t.description}</div>}
                    </div>
                    <span className="text-champagne-500 opacity-0 group-hover:opacity-100 transition-opacity">+ Add</span>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
