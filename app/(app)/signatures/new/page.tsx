import { DataWorkspace } from '@/components/operations/data-workspace';
import { NewSignatureRequestForm } from '@/components/signatures/new-request-form';
import { Alert, Surface } from '@/components/ui/shell';
import { requireStaff } from '@/lib/auth/me';
import { createSignatureRequest } from '@/lib/rpcs/esignatures';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const isUuid = (v?: string) => !!v && /^[0-9a-f-]{36}$/i.test(v);

/** Prefill title and text from the record being signed. */
async function prefill(db: any, subjectType?: string, subjectId?: string) {
  if (!isUuid(subjectId)) return {};
  if (subjectType === 'management_agreement') {
    const { data: a } = await db.from('management_agreements')
      .select('name, association_id, start_date, end_date, auto_renew, renewal_term_months, termination_notice_days, terms, associations(name)')
      .eq('id', subjectId).maybeSingle();
    if (!a) return {};
    const fee = a.terms?.management_fee != null ? `$${Number(a.terms.management_fee).toLocaleString()} (${String(a.terms.fee_basis ?? 'per month').replace(/_/g, ' ')})` : 'as scheduled';
    return {
      association_id: a.association_id ?? undefined,
      title: a.name,
      body_text: [
        `${a.name}`,
        '',
        `Association: ${a.associations?.name ?? '—'}`,
        `Term: ${a.start_date}${a.end_date ? ` through ${a.end_date}` : ', continuing until terminated'}`,
        `Management fee: ${fee}`,
        `Renewal: ${a.auto_renew ? `renews automatically for ${a.renewal_term_months ?? 12}-month terms` : 'does not renew automatically'}`,
        `Termination notice: ${a.termination_notice_days ?? 'per the agreement'} days`,
        '',
        'The undersigned approve this management agreement on behalf of their respective parties.',
      ].join('\n'),
    };
  }
  if (subjectType === 'architectural_request') {
    const { data: r } = await db.from('architectural_requests')
      .select('title, description, status, decision_notes, association_id, units(unit_number), associations(name)')
      .eq('id', subjectId).maybeSingle();
    if (!r) return {};
    return {
      association_id: r.association_id ?? undefined,
      title: `Architectural review decision — ${r.title}`,
      body_text: [
        `Architectural review decision — ${r.title}`,
        '',
        `Association: ${r.associations?.name ?? '—'}${r.units?.unit_number ? ` · Unit ${r.units.unit_number}` : ''}`,
        `Decision: ${String(r.status ?? '').replace(/_/g, ' ')}`,
        '',
        'Request:',
        r.description ?? '—',
        '',
        'Conditions / notes:',
        r.decision_notes ?? 'None',
        '',
        'The undersigned acknowledge this decision and any conditions of approval.',
      ].join('\n'),
    };
  }
  return {};
}

export default async function NewSignatureRequestPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; subject_type?: string; subject_id?: string; association_id?: string }>;
}) {
  await requireStaff();
  const sp = await searchParams;
  const db = (await createClient()) as any;
  const [{ data: associations }, { data: boardMembers }, pre] = await Promise.all([
    db.from('associations').select('id, name').is('archived_at', null).order('name'),
    db.from('board_members').select('association_id, full_name, email, role').eq('active', true).order('role'),
    prefill(db, sp.subject_type, sp.subject_id),
  ]);
  const subjectType = sp.subject_type && ['management_agreement', 'architectural_request'].includes(sp.subject_type) && isUuid(sp.subject_id) ? sp.subject_type : undefined;

  return (
    <DataWorkspace title="Request signatures" description="Upload a PDF or write the text, add signers, and send. Each signer gets a private link; every step is recorded with a tamper-evident fingerprint.">
      <div className="max-w-4xl space-y-4">
        {sp.error && <Alert tone="danger" title="Could not send:">{sp.error}</Alert>}
        <Surface>
          <NewSignatureRequestForm
            action={createSignatureRequest}
            associations={associations ?? []}
            boardMembers={boardMembers ?? []}
            initial={{ ...pre, association_id: (pre as any).association_id ?? sp.association_id, subject_type: subjectType, subject_id: subjectType ? sp.subject_id : undefined }}
          />
        </Surface>
      </div>
    </DataWorkspace>
  );
}
