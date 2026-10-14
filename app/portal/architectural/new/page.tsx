import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireOwner } from '@/lib/auth/me';
import { loadOwnArcContext } from '@/lib/portal/arc-context';
import { Alert } from '@/components/ui/shell';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/card';
import { NewArchitecturalRequestForm, type UnitOption } from '@/components/architectural/new-request-form';

export const dynamic = 'force-dynamic';

export default async function NewArchitecturalRequest() {
  const me = await requireOwner();
  if (!me.is_resident && !me.is_board) redirect('/portal');

  const supabase = await createClient();
  const context = await loadOwnArcContext(supabase, me.owner_ids);
  const byAssociation = new Map(context.associations.map((a) => [a.id, a]));

  // Units in associations that take requests online.
  const unitOptions: UnitOption[] = context.units
    .filter((u) => !(u.association_id && byAssociation.get(u.association_id)?.instructions.online_requests_disabled))
    .map((u) => ({
      value: u.unit_id,
      label: `${u.association_id ? byAssociation.get(u.association_id)?.name ?? 'Association' : 'Association'} - Unit ${u.unit_number ?? '-'}`,
      associationId: u.association_id,
    }));
  const offline = context.units.length > 0 && unitOptions.length === 0;
  const someOffline = !offline && unitOptions.length < context.units.length;
  const guidance = Object.fromEntries(context.associations.map((a) => [a.id, {
    submission: a.instructions.submission_form_html,
    documents: a.instructions.document_upload_html,
  }]));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 text-sm text-gray-500">
        <Link href="/portal/architectural" className="hover:text-gray-950 hover:underline">← Back to architectural requests</Link>
      </div>

      <div>
        <h1 className="font-display text-[26px] font-bold leading-[1.12] tracking-[-0.025em] text-ink [text-wrap:balance] sm:text-[30px]">Submit an architectural request</h1>
        <p className="mt-2 max-w-3xl text-[15px] leading-6 text-gray-500">
          Most exterior changes need approval before work begins. Describe what you&apos;d like to do and attach
          your plans, quotes, and photos — the board or architectural committee will review and may ask
          follow-up questions right in the request&apos;s discussion thread.
        </p>
      </div>

      {context.error ? (
        <Alert tone="danger" title="Could not load your units.">{context.error}</Alert>
      ) : offline ? (
        <Alert tone="info">Your association doesn&apos;t take architectural requests online. Contact your management office to submit one.</Alert>
      ) : unitOptions.length === 0 ? (
        <Card>
          <CardBody>
            <p className="text-sm text-gray-600">
              You don&apos;t have a unit on file yet. Contact your property manager so they can link your account to your unit.
            </p>
          </CardBody>
        </Card>
      ) : (
        <>
          {someOffline && (
            <Alert tone="info">Some of your units are in an association that doesn&apos;t take architectural requests online, so they aren&apos;t listed. Contact your management office for those.</Alert>
          )}
          <Card>
            <CardHeader><CardTitle>Request details</CardTitle></CardHeader>
            <CardBody>
              <NewArchitecturalRequestForm unitOptions={unitOptions} guidance={guidance} />
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}
