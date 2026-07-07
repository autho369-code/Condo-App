import Link from 'next/link';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

import { DataWorkspace } from '@/components/operations/data-workspace';
import { FilterBar } from '@/components/operations/filter-bar';
import { MetricStrip } from '@/components/operations/metric-strip';
import { StatusChip } from '@/components/operations/status-chip';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Alert } from '@/components/ui/shell';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const FREQ_LABELS: Record<string, string> = { monthly: 'Monthly', quarterly: 'Quarterly', semiannual: 'Semi-annual', annual: 'Annual' };
const DELIVERY_LABELS: Record<string, string> = { email: 'Email', paper: 'Paper', both: 'Email + paper' };

export default async function OwnerPacketsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; owner?: string; saved?: string; error?: string }>;
}) {
  const me = await requireStaff();
  const sp = await searchParams;
  const q = (sp.q ?? '').trim().toLowerCase();
  const supabase = await createClient();

  const [{ data: owners }, { data: requests }, { data: settings }] = await Promise.all([
    (supabase as any).from('owners').select('id, portfolio_id, full_name, email, portal_activated, archived_at').is('archived_at', null).order('full_name'),
    (supabase as any)
      .from('document_requests')
      .select('id, owner_id, name, doc_type, status, requested_at, due_date')
      .not('owner_id', 'is', null)
      .order('requested_at', { ascending: false })
      .limit(500),
    (supabase as any).from('owner_packet_settings').select('*'),
  ]);

  const requestsByOwner = new Map<string, any[]>();
  for (const request of requests ?? []) {
    const ownerId = (request as any).owner_id;
    requestsByOwner.set(ownerId, [...(requestsByOwner.get(ownerId) ?? []), request]);
  }
  const settingsByOwner = new Map<string, any>();
  for (const s of settings ?? []) settingsByOwner.set(s.owner_id, s);

  let rows: any[] = (owners ?? []).map((owner: any) => ({ owner, requests: requestsByOwner.get(owner.id) ?? [], config: settingsByOwner.get(owner.id) ?? null }));
  if (sp.owner) rows = rows.filter((row) => row.owner.id === sp.owner);
  if (q) rows = rows.filter((row) => [row.owner.full_name, row.owner.email].some((value) => value?.toLowerCase().includes(q)));

  const openRequests = (requests ?? []).filter((request: any) => !['approved', 'rejected'].includes(request.status)).length;

  const selectedOwner = sp.owner ? (owners ?? []).find((o: any) => o.id === sp.owner) : null;
  const selectedConfig = selectedOwner ? settingsByOwner.get(selectedOwner.id) ?? null : null;

  async function savePacketSettings(formData: FormData) {
    'use server';
    const me2 = await requireStaff();
    const sb = await createClient();
    const ownerId = formData.get('owner_id') as string;
    const portfolioId = formData.get('portfolio_id') as string;
    const fail = (msg: string) => redirect(`/owners/packets?owner=${ownerId}&error=${encodeURIComponent(msg)}`);
    const { error } = await (sb as any).from('owner_packet_settings').upsert({
      owner_id: ownerId,
      portfolio_id: portfolioId,
      frequency: (formData.get('frequency') as string) || 'monthly',
      delivery: (formData.get('delivery') as string) || 'email',
      statement_template: (formData.get('statement_template') as string) || 'standard',
      include_statement: formData.get('include_statement') === 'on',
      include_ledger_detail: formData.get('include_ledger_detail') === 'on',
      include_delinquency: formData.get('include_delinquency') === 'on',
      include_documents: formData.get('include_documents') === 'on',
      include_violations: formData.get('include_violations') === 'on',
      notes: ((formData.get('notes') as string) || '').trim() || null,
      updated_at: new Date().toISOString(),
      updated_by: me2.auth_user_id,
    }, { onConflict: 'owner_id' });
    if (error) fail(error.message);
    revalidatePath('/owners/packets');
    redirect(`/owners/packets?owner=${ownerId}&saved=1`);
  }

  const selectClass = 'mt-1 block w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-950 shadow-[0_1px_2px_rgba(16,24,40,0.04)] outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15';

  return (
    <DataWorkspace
      title="Send Owner Packets"
      description="Configure what each owner receives, how often, and how it's delivered — then stage outbound packet delivery."
      actions={<Link href="/owners/forms?template=owner_packet"><Button>Prepare packet</Button></Link>}
    >
      <div className="space-y-4">
        {sp.saved && <Alert tone="success" title="Packet settings saved" />}
        {sp.error && <Alert tone="danger" title="Could not save">{sp.error}</Alert>}

        {selectedOwner && (
          <section className="overflow-hidden rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
              <h2 className="text-sm font-semibold text-gray-900">Packet settings — {selectedOwner.full_name}</h2>
              <Link href="/owners/packets" className="text-xs font-medium text-gray-500 hover:text-gray-900 hover:underline">Close</Link>
            </div>
            <form action={savePacketSettings} className="grid grid-cols-1 gap-4 px-5 py-4 md:grid-cols-3">
              <input type="hidden" name="owner_id" value={selectedOwner.id} />
              <input type="hidden" name="portfolio_id" value={selectedOwner.portfolio_id} />
              <div>
                <Label htmlFor="frequency">Frequency</Label>
                <select id="frequency" name="frequency" defaultValue={selectedConfig?.frequency ?? 'monthly'} className={selectClass}>
                  {Object.entries(FREQ_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <Label htmlFor="delivery">Delivery</Label>
                <select id="delivery" name="delivery" defaultValue={selectedConfig?.delivery ?? 'email'} className={selectClass}>
                  {Object.entries(DELIVERY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <Label htmlFor="statement_template">Statement template</Label>
                <select id="statement_template" name="statement_template" defaultValue={selectedConfig?.statement_template ?? 'standard'} className={selectClass}>
                  <option value="standard">Owner Statement</option>
                  <option value="enhanced">Owner Statement (Enhanced)</option>
                </select>
              </div>
              <fieldset className="md:col-span-3">
                <legend className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-400">Packet contents</legend>
                <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2">
                  {[
                    ['include_statement', 'Account statement', selectedConfig ? selectedConfig.include_statement : true],
                    ['include_ledger_detail', 'Ledger detail', selectedConfig ? selectedConfig.include_ledger_detail : true],
                    ['include_delinquency', 'Delinquency summary', selectedConfig ? selectedConfig.include_delinquency : true],
                    ['include_documents', 'Recent documents', selectedConfig ? selectedConfig.include_documents : false],
                    ['include_violations', 'Open violations', selectedConfig ? selectedConfig.include_violations : false],
                  ].map(([name, label, checked]: any) => (
                    <label key={name} className="flex items-center gap-2 text-sm text-gray-700">
                      <input type="checkbox" name={name} defaultChecked={Boolean(checked)} className="h-4 w-4 rounded border-gray-300" /> {label}
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="md:col-span-2">
                <Label htmlFor="notes">Notes</Label>
                <Input id="notes" name="notes" defaultValue={selectedConfig?.notes ?? ''} placeholder="Special handling for this owner's packet" />
              </div>
              <div className="flex items-end justify-end">
                <Button type="submit">Save packet settings</Button>
              </div>
            </form>
          </section>
        )}

        <MetricStrip metrics={[
          { label: 'Packet candidates', value: rows.length },
          { label: 'Configured', value: rows.filter((row) => row.config).length },
          { label: 'Open document requests', value: openRequests },
          { label: 'Portal active', value: rows.filter((row) => row.owner.portal_activated).length },
        ]} />
        <FilterBar action="/owners/packets" searchDefault={sp.q ?? ''} searchPlaceholder="Search owner or email" />
        <Table>
          <THead><TR><TH>Owner</TH><TH>Portal</TH><TH>Packet Settings</TH><TH>Latest Activity</TH><TH>Next Step</TH></TR></THead>
          <tbody>
            {rows.map(({ owner, requests: ownerRequests, config }) => {
              const latest = ownerRequests[0];
              return (
                <TR key={owner.id} className="hover:bg-gray-50">
                  <TD><Link href={`/owners/${owner.id}`} className="font-medium text-gray-900 hover:text-gray-950 hover:underline">{owner.full_name}</Link><div className="mt-1 text-xs text-gray-500">{owner.email}</div></TD>
                  <TD><StatusChip tone={owner.portal_activated ? 'success' : 'warning'}>{owner.portal_activated ? 'Ready' : 'Activate first'}</StatusChip></TD>
                  <TD>
                    {config ? (
                      <>
                        <StatusChip tone="info">{FREQ_LABELS[config.frequency] ?? config.frequency} · {DELIVERY_LABELS[config.delivery] ?? config.delivery}</StatusChip>
                        <div className="mt-1 text-xs text-gray-500">{config.statement_template === 'enhanced' ? 'Enhanced statement' : 'Standard statement'}</div>
                      </>
                    ) : (
                      <StatusChip tone="neutral">Not configured</StatusChip>
                    )}
                  </TD>
                  <TD><div className="text-gray-900">{latest?.name ?? 'No packet activity'}</div><div className="mt-1 text-xs text-gray-500">{date(latest?.requested_at)}</div></TD>
                  <TD>
                    <div className="flex flex-wrap gap-2 text-sm font-medium">
                      <Link href={`/owners/packets?owner=${owner.id}`} className="text-gray-600 transition-colors hover:text-gray-950">Configure</Link>
                      <Link href={`/owners/forms?owner=${owner.id}&template=owner_packet`} className="text-gray-600 transition-colors hover:text-gray-950">Preview packet →</Link>
                    </div>
                  </TD>
                </TR>
              );
            })}
          </tbody>
        </Table>
      </div>
    </DataWorkspace>
  );
}
