import Link from 'next/link';
import { randomUUID } from 'node:crypto';
import { redirect } from 'next/navigation';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { Alert, Surface } from '@/components/ui/shell';

export const dynamic = 'force-dynamic';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

export default async function NewPhysicalMailPage({ searchParams }: { searchParams: Promise<{ owner_id?: string; case_id?: string; error?: string }> }) {
  const me = await requireStaff();
  const sp = await searchParams;
  const db = (await createClient()) as any;
  const { data: owners } = await db.from('owners').select('id, full_name, address_street, address_city, address_state, address_zip').eq('portfolio_id', me.portfolio?.id).is('archived_at', null).order('full_name');
  const selected = (owners ?? []).find((owner: any) => owner.id === sp.owner_id);

  async function queueMail(formData: FormData) {
    'use server';
    const current = await requireStaff();
    const supabase = (await createClient()) as any;
    const ownerId = String(formData.get('owner_id') ?? '');
    const caseId = String(formData.get('case_id') ?? '') || null;
    const idempotencyKey = String(formData.get('idempotency_key') ?? '');
    if (!UUID.test(idempotencyKey)) redirect('/letters/mail/new?error=' + encodeURIComponent('This mail form expired. Reload it and try again.'));
    const { data: owner } = await supabase.from('owners').select('id, full_name, address_street, address_city, address_state, address_zip').eq('id', ownerId).maybeSingle();
    if (!owner) redirect('/letters/mail/new?error=' + encodeURIComponent('Select an accessible owner.'));
    const content = String(formData.get('content') ?? '').trim();
    const description = String(formData.get('description') ?? '').trim();
    if (!content || !description || !owner.address_street || !owner.address_city || !owner.address_state || !owner.address_zip) redirect(`/letters/mail/new?owner_id=${ownerId}&error=${encodeURIComponent('Description, letter body, and a complete structured owner address are required.')}`);
    const { data: collectionCase } = caseId
      ? await supabase.from('delinquency_cases').select('id, owner_id, association_id').eq('id', caseId).maybeSingle()
      : { data: null };
    if (caseId && (!collectionCase || collectionCase.owner_id !== ownerId)) redirect(`/letters/mail/new?owner_id=${ownerId}&error=${encodeURIComponent('Collection case and recipient do not match.')}`);
    const { data: ownership } = await supabase.from('unit_owners').select('unit_id, units(buildings(association_id))').eq('owner_id', ownerId).is('end_date', null).order('is_primary', { ascending: false }).limit(1).maybeSingle();
    const units = Array.isArray(ownership?.units) ? ownership.units[0] : ownership?.units;
    const buildings = Array.isArray(units?.buildings) ? units.buildings[0] : units?.buildings;
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;font-size:12pt;line-height:1.5;color:#111;padding:0.65in}p{white-space:pre-wrap}</style></head><body><p>${escapeHtml(content)}</p></body></html>`;
    const { error } = await supabase.from('physical_mail_deliveries').insert({
      portfolio_id: current.portfolio?.id,
      association_id: collectionCase?.association_id ?? buildings?.association_id ?? null,
      owner_id: owner.id,
      delinquency_case_id: collectionCase?.id ?? null,
      idempotency_key: idempotencyKey,
      description,
      recipient_name: owner.full_name,
      address_line1: owner.address_street,
      address_city: owner.address_city,
      address_state: owner.address_state,
      address_zip: owner.address_zip,
      content_html: html,
      mail_class: String(formData.get('mail_class') ?? 'first_class'),
      color: formData.get('color') === 'on',
      double_sided: formData.get('double_sided') === 'on',
      created_by: current.auth_user_id,
    });
    if (error?.code === '23505') redirect('/letters/mail');
    if (error) redirect(`/letters/mail/new?owner_id=${ownerId}&error=${encodeURIComponent(error.message)}`);
    redirect('/letters/mail');
  }

  return <DataWorkspace title="New Physical Mail Piece" description="Review recipient data and content before adding the piece to the durable provider queue." actions={<Link href="/letters/mail"><Button variant="secondary">Back to fulfillment</Button></Link>}>
    <div className="space-y-5">
      {sp.error && <Alert title="Could not queue mail">{sp.error}</Alert>}
      <Surface className="max-w-4xl"><form action="/letters/mail/new" className="flex flex-col gap-3 sm:flex-row sm:items-end">{sp.case_id && <input type="hidden" name="case_id" value={sp.case_id} />}<Field label="Owner" className="flex-1"><Select name="owner_id" defaultValue={selected?.id ?? ''}><option value="">Select owner</option>{(owners ?? []).map((owner: any) => <option key={owner.id} value={owner.id}>{owner.full_name}</option>)}</Select></Field><Button type="submit" variant="secondary">Load recipient</Button></form></Surface>
      {selected && <Surface className="max-w-4xl"><form action={queueMail} className="space-y-5"><input type="hidden" name="owner_id" value={selected.id} /><input type="hidden" name="idempotency_key" value={randomUUID()} />{sp.case_id && <input type="hidden" name="case_id" value={sp.case_id} />}<Alert tone={selected.address_street && selected.address_city && selected.address_state && selected.address_zip ? 'info' : 'warning'} title="Recipient address.">{selected.address_street ? `${selected.address_street}, ${selected.address_city ?? ''}, ${selected.address_state ?? ''} ${selected.address_zip ?? ''}` : 'This owner needs a structured mailing address before fulfillment.'}</Alert><Field label="Internal description" required><Input name="description" required maxLength={200} placeholder="March collection notice" /></Field><Field label="Letter body" required hint="Plain text is escaped and rendered into the provider print template."><Textarea name="content" required rows={14} /></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Mail class"><Select name="mail_class" defaultValue="first_class"><option value="first_class">USPS First Class</option><option value="standard">USPS Standard</option></Select></Field><div className="space-y-3 pt-6"><label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" name="double_sided" defaultChecked className="h-4 w-4 rounded border-gray-300" /> Double-sided printing</label><label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" name="color" className="h-4 w-4 rounded border-gray-300" /> Color printing</label></div></div><Button type="submit" disabled={!selected.address_street || !selected.address_city || !selected.address_state || !selected.address_zip}>Queue for fulfillment</Button></form></Surface>}
    </div>
  </DataWorkspace>;
}
