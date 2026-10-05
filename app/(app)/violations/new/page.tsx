import { fetchAllRows } from '@/lib/supabase/fetch-all';
import Link from 'next/link';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { OpenViolationForm } from '@/components/violations/open-violation-form';
import { Alert, Surface } from '@/components/ui/shell';
import { Button } from '@/components/ui/button';
import { requireStaff } from '@/lib/auth/me';
import { openViolation } from '@/lib/rpcs/violation-rules';
import { createClient } from '@/lib/supabase/server';
import { newSubmissionToken } from '@/lib/forms/submission';
import { todayInZone } from '@/lib/time/zoned';
import { VIOLATION_TYPES, humanize } from '@/lib/violations/rules-data';

export const dynamic = 'force-dynamic';

export default async function NewViolationPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; association_id?: string; house_rule_id?: string }>;
}) {
  await requireStaff();
  const sp = await searchParams;
  const supabase = await createClient();
  const db = supabase as any;

  const [{ data: associations }, { data: units }, { data: rules }] = await Promise.all([
    db.from('associations').select('id, name').is('archived_at', null).order('name'),
    // Every unit (one request stops at 1,000 rows).
    fetchAllRows<any>(() => db.from('units').select('id, unit_number, buildings!inner(association_id, name)').is('archived_at', null).order('unit_number').order('id')).then((r) => ({ data: r.rows })),
    db.from('house_rules')
      .select('id, association_id, rule_number, title, description, action_to_resolve, default_violation_type')
      .is('archived_at', null)
      .eq('active', true)
      .order('sort_order'),
  ]);

  return (
    <DataWorkspace
      title="New violation"
      description="Pick the rule that was broken. The owner of record, cure deadline, and follow-up schedule are set automatically."
      actions={<Link href="/violations/field"><Button variant="secondary">Field capture with photos</Button></Link>}
    >
      <div className="max-w-3xl space-y-4">
        {sp.error && <Alert tone="danger" title="Could not open violation:">{sp.error}</Alert>}
        <Surface>
          <OpenViolationForm
            action={openViolation}
            today={todayInZone()}
            submissionToken={newSubmissionToken()}
            associations={associations ?? []}
            units={((units ?? []) as any[]).map((u) => ({
              id: u.id,
              association_id: u.buildings?.association_id,
              label: `${u.unit_number}${u.buildings?.name ? ` · ${u.buildings.name}` : ''}`,
            }))}
            rules={rules ?? []}
            types={VIOLATION_TYPES.map((t) => ({ value: t, label: humanize(t) }))}
            initialAssociationId={sp.association_id}
            initialRuleId={sp.house_rule_id}
          />
        </Surface>
      </div>
    </DataWorkspace>
  );
}
