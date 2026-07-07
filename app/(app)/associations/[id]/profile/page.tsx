import { notFound, redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { Workspace, WorkspaceHeader, Section, Tile } from '@/components/workspace/shell';
import { Alert } from '@/components/ui/shell';
import { AssociationTabs } from '@/components/associations/tabs';
import { resolveAssociation } from '@/lib/associations/resolve';
import { Button } from '@/components/ui/button';
import { Input, Label, Textarea } from '@/components/ui/input';

export const dynamic = 'force-dynamic';

export default async function AssociationProfileTab({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  await requireStaff();
  const { id: assocParam } = await params;
  const association = await resolveAssociation(assocParam);
  if (!association) notFound();
  const id = association.id;
  const sp = await searchParams;
  const supabase = await createClient();

  const { data: assoc, error: aErr } = await (supabase as any)
    .from('associations')
    .select(`
      id, name, address, address_line_2, city, state, zip,
      portfolio_id, status, archived_at, created_at,
      remit_payee, remit_address, payment_instructions,
      site_manager, site_manager_user_id,
      portfolio:portfolios ( id, company_name )
    `)
    .eq('id', id)
    .maybeSingle();
  if (aErr || !assoc) notFound();

  // Manager-entered payment remittance details (white-glove: each manager sets
  // their own payee / mailing address / bill-pay notes per association).
  async function savePaymentInstructions(formData: FormData) {
    'use server';
    await requireStaff();
    const sb = await createClient();
    const fail = (msg: string) => redirect(`/associations/${assocParam}/profile?error=${encodeURIComponent(msg)}`);
    const { error } = await (sb as any)
      .from('associations')
      .update({
        remit_payee: ((formData.get('remit_payee') as string) || '').trim() || null,
        remit_address: ((formData.get('remit_address') as string) || '').trim() || null,
        payment_instructions: ((formData.get('payment_instructions') as string) || '').trim() || null,
      })
      .eq('id', id);
    if (error) fail(error.message);
    revalidatePath(`/associations/${assocParam}/profile`);
    redirect(`/associations/${assocParam}/profile?saved=1`);
  }

  // Managers in this portfolio, for the site-manager assignment dropdown
  const { data: managerProfiles } = await (supabase as any)
    .from('profiles')
    .select('id, full_name, email')
    .eq('portfolio_id', assoc.portfolio_id)
    .eq('hoa_role', 'manager')
    .order('full_name');

  // The assigned site manager receives owner-portal messages for this
  // association (fallback: company admins, then the portfolio support email).
  async function saveSiteManager(formData: FormData) {
    'use server';
    await requireStaff();
    const sb = await createClient();
    const fail = (msg: string) => redirect(`/associations/${assocParam}/profile?error=${encodeURIComponent(msg)}`);
    const userId = ((formData.get('site_manager_user_id') as string) || '').trim() || null;
    let displayName: string | null = null;
    if (userId) {
      const { data: mgr } = await (sb as any).from('profiles').select('full_name, email').eq('id', userId).maybeSingle();
      if (!mgr) fail('Selected manager was not found.');
      displayName = mgr.full_name ?? mgr.email ?? null;
    }
    const { error } = await (sb as any)
      .from('associations')
      .update({ site_manager_user_id: userId, site_manager: displayName })
      .eq('id', id);
    if (error) fail(error.message);
    revalidatePath(`/associations/${assocParam}/profile`);
    redirect(`/associations/${assocParam}/profile?saved=1`);
  }

  // Roll-up counts in parallel
  const buildingsRes = await (supabase as any).from('buildings').select('id').eq('association_id', id);
  const buildingIds = (buildingsRes.data ?? []).map((b: any) => b.id);

  const [unitsRes, boardRes, committeesRes, amenitiesRes, approvalsRes] = await Promise.all([
    buildingIds.length
      ? (supabase as any).from('units').select('id', { count: 'exact', head: true }).in('building_id', buildingIds).is('archived_at', null)
      : Promise.resolve({ count: 0 }),
    (supabase as any).from('board_members').select('id', { count: 'exact', head: true }).eq('association_id', id).eq('active', true),
    (supabase as any).from('committees').select('id', { count: 'exact', head: true }).eq('association_id', id).is('archived_at', null),
    (supabase as any).from('association_amenities').select('id', { count: 'exact', head: true }).eq('association_id', id).is('archived_at', null),
    (supabase as any).from('approval_requests').select('id', { count: 'exact', head: true }).eq('association_id', id).eq('status', 'pending'),
  ]);

  const rail = null;

  return (
    <Workspace
      header={
        <>
          <AssociationTabs associationId={id} active="profile" />
          <WorkspaceHeader title={assoc.name} />
        </>
      }
      rail={rail}
    >
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Tile label="Units"             value={unitsRes.count ?? 0}      href={`/associations/${id}/units`} />
        <Tile label="Board Members"     value={boardRes.count ?? 0}      href={`/associations/${id}/board`} />
        <Tile label="Committees"        value={committeesRes.count ?? 0} href={`/associations/${id}/committees`} />
        <Tile label="Amenities"         value={amenitiesRes.count ?? 0}  href={`/associations/${id}/amenities`} />
        <Tile label="Pending Approvals" value={approvalsRes.count ?? 0}  href={`/associations/${id}/approvals`} tone={(approvalsRes.count ?? 0) > 0 ? 'warning' : 'neutral'} />
      </div>

      <Section title="Association Information" padded>
        <dl className="grid grid-cols-[180px_1fr] gap-y-2.5 text-sm">
          <dt className="text-gray-500">Name</dt>
          <dd className="text-gray-900">{assoc.name}</dd>

          <dt className="text-gray-500">Address</dt>
          <dd className="text-gray-900">
            {assoc.address || <span className="text-gray-400">—</span>}
            {assoc.address_line_2 ? `, ${assoc.address_line_2}` : ''}
            {(assoc.city || assoc.state || assoc.zip) && (
              <div>{[assoc.city, assoc.state].filter(Boolean).join(', ')} {assoc.zip ?? ''}</div>
            )}
          </dd>

          <dt className="text-gray-500">Portfolio</dt>
          <dd className="text-gray-900">{(assoc.portfolio as any)?.company_name ?? <span className="text-gray-400">—</span>}</dd>

          <dt className="text-gray-500">Status</dt>
          <dd className="capitalize text-gray-900">{assoc.status ?? 'active'}</dd>

          <dt className="text-gray-500">Created</dt>
          <dd className="text-gray-900">{assoc.created_at ? formatDate(assoc.created_at) : <span className="text-gray-400">—</span>}</dd>
        </dl>
      </Section>

      <div className="mt-6">
        <Section title="Site Manager" padded>
          <p className="mb-4 text-sm leading-6 text-gray-500">
            The assigned manager receives messages owners send from the owner portal
            (as regular email, reply-to the owner). If no manager is assigned, messages
            fall back to your company admins.
          </p>
          <form action={saveSiteManager} className="flex max-w-2xl items-end gap-3">
            <div className="flex-1">
              <Label htmlFor="site_manager_user_id">Assigned manager</Label>
              <select
                id="site_manager_user_id"
                name="site_manager_user_id"
                defaultValue={assoc.site_manager_user_id ?? ''}
                className="mt-1 block w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-950 shadow-[0_1px_2px_rgba(16,24,40,0.04)] outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
              >
                <option value="">— Not assigned (messages go to company admins) —</option>
                {(managerProfiles ?? []).map((m: any) => (
                  <option key={m.id} value={m.id}>{m.full_name ?? m.email}</option>
                ))}
              </select>
            </div>
            <Button type="submit">Save</Button>
          </form>
        </Section>
      </div>

      <div className="mt-6">
        <Section title="Payment Instructions" padded>
          <p className="mb-4 text-sm leading-6 text-gray-500">
            Owners pay by check or bank bill-pay. What you enter here is exactly what owners see on their
            <span className="font-medium text-gray-700"> How to Pay</span> page in the owner portal.
          </p>
          {sp.saved && <div className="mb-4"><Alert tone="success" title="Saved">Payment instructions updated.</Alert></div>}
          {sp.error && <div className="mb-4"><Alert tone="danger" title="Could not save">{sp.error}</Alert></div>}
          <form action={savePaymentInstructions} className="max-w-2xl space-y-4">
            <div>
              <Label htmlFor="remit_payee">Make checks payable to</Label>
              <Input id="remit_payee" name="remit_payee" defaultValue={assoc.remit_payee ?? ''} placeholder={`e.g. ${assoc.name}`} />
            </div>
            <div>
              <Label htmlFor="remit_address">Mail payments to</Label>
              <Textarea id="remit_address" name="remit_address" rows={3} defaultValue={assoc.remit_address ?? ''} placeholder={"Street / PO Box or lockbox\nCity, State ZIP"} />
            </div>
            <div>
              <Label htmlFor="payment_instructions">Other options &amp; notes</Label>
              <Textarea id="payment_instructions" name="payment_instructions" rows={4} defaultValue={assoc.payment_instructions ?? ''} placeholder={"Bank bill-pay payee + address, the account/reference owners should use, lockbox details, or any other payment instructions."} />
              <p className="mt-1 text-xs text-gray-500">Tip: tell owners to include their unit number as the account/memo so payments are applied correctly.</p>
            </div>
            <div className="flex justify-end">
              <Button type="submit">Save payment instructions</Button>
            </div>
          </form>
        </Section>
      </div>
    </Workspace>
  );
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
}
