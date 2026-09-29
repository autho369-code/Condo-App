import { DataWorkspace } from '@/components/operations/data-workspace';
import { RuleForm } from '@/components/violations/rule-form';
import { Alert, EmptyState, Surface } from '@/components/ui/shell';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { loadAssociationScope } from '@/lib/violations/rules-data';

export const dynamic = 'force-dynamic';

export default async function NewRulePage({
  searchParams,
}: {
  searchParams: Promise<{ association_id?: string; error?: string }>;
}) {
  await requireStaff();
  const sp = await searchParams;
  const supabase = await createClient();
  const { selected } = await loadAssociationScope(supabase as any, sp.association_id);

  return (
    <DataWorkspace title="New rule" description={selected ? `Add a governing-document rule to ${selected.name}.` : undefined}>
      <div className="max-w-3xl space-y-4">
        {sp.error && <Alert tone="danger" title="Could not save rule:">{sp.error}</Alert>}
        {selected ? (
          <Surface><RuleForm associationId={selected.id} /></Surface>
        ) : (
          <EmptyState title="No associations yet" />
        )}
      </div>
    </DataWorkspace>
  );
}
