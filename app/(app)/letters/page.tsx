import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { ModulePage } from '@/components/workspace/module-page';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';

export const dynamic = 'force-dynamic';

export default async function LettersPage() {
  await requireStaff();
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from('document_templates')
    .select('id, name, letter_type, template_category, active')
    .is('archived_at', null)
    .order('template_category')
    .order('name');

  return (
    <ModulePage title="Letters" description="Document templates for owner notices, vendor correspondence, statements, and more. Uses merge fields against live data.">
      {rows && rows.length > 0 ? (
        <Table>
          <THead><TR><TH>Name</TH><TH>Type</TH><TH>Category</TH><TH>Active</TH></TR></THead>
          <tbody>
            {rows.map((t: any) => (
              <TR key={t.id}>
                <TD className="font-medium">{t.name}</TD>
                <TD className="text-sm text-gray-700">{t.letter_type}</TD>
                <TD className="text-sm capitalize text-gray-600">{t.template_category}</TD>
                <TD>{t.active
                  ? <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">active</span>
                  : <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">archived</span>}</TD>
              </TR>
            ))}
          </tbody>
        </Table>
      ) : (
        <p className="rounded border border-gray-200 bg-white px-6 py-8 text-center text-sm text-gray-500">No letter templates yet.</p>
      )}
    </ModulePage>
  );
}
