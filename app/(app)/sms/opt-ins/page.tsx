import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { Button } from '@/components/ui/button';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { toggleOptIn } from '@/lib/rpcs/sms';

export const dynamic = 'force-dynamic';

function formatDate(value: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default async function SmsOptInsPage() {
  const me = await requireStaff();
  const supabase = await createClient();
  const db = supabase as any;

  // Get all opt-in records
  const { data: optIns } = await db
    .from('sms_opt_ins')
    .select('*')
    .eq('portfolio_id', me.portfolio?.id)
    .order('entity_type')
    .order('phone_number');

  // Get owners with phone numbers
  const { data: owners } = await db
    .from('owners')
    .select('id, full_name, phone, phone_numbers')
    .is('archived_at', null)
    .eq('portfolio_id', me.portfolio?.id)
    .order('full_name')
    .limit(500);

  // Get vendors with phone numbers
  const { data: vendors } = await db
    .from('vendors')
    .select('id, name, phone_numbers')
    .eq('portfolio_id', me.portfolio?.id)
    .order('name')
    .limit(500);

  const optInRows = optIns ?? [];
  const optedInCount = optInRows.filter((o: any) => o.opted_in).length;
  const optedOutCount = optInRows.filter((o: any) => !o.opted_in).length;

  // Build a lookup: phone -> opt-in record
  const optInByPhone: Record<string, any> = {};
  optInRows.forEach((o: any) => {
    optInByPhone[o.phone_number] = o;
  });

  // Extract owners with phones
  function extractPhones(entity: any, type: string): Array<{ id: string; name: string; phone: string; optedIn: boolean; entityId: string }> {
    const result: Array<{ id: string; name: string; phone: string; optedIn: boolean; entityId: string }> = [];
    const name = entity.full_name || entity.name || '';
    const phones: string[] = [];

    // Check simple phone field
    if (entity.phone && typeof entity.phone === 'string' && entity.phone.trim()) {
      phones.push(entity.phone.trim());
    }
    // Check phone_numbers array
    if (entity.phone_numbers && Array.isArray(entity.phone_numbers)) {
      entity.phone_numbers.forEach((p: any) => {
        if (p.number && typeof p.number === 'string' && p.number.trim()) {
          phones.push(p.number.trim());
        }
      });
    }

    phones.forEach((phone, idx) => {
      const optRec = optInByPhone[phone];
      result.push({
        id: `${entity.id}-${idx}`,
        name,
        phone,
        optedIn: optRec ? optRec.opted_in : false,
        entityId: entity.id,
      });
    });

    return result;
  }

  const ownerPhones: any[] = [];
  (owners ?? []).forEach((o: any) => {
    ownerPhones.push(...extractPhones(o, 'owner').map(p => ({ ...p, entityType: 'owner' })));
  });

  const vendorPhones: any[] = [];
  (vendors ?? []).forEach((v: any) => {
    vendorPhones.push(...extractPhones(v, 'vendor').map(p => ({ ...p, entityType: 'vendor' })));
  });

  const allPhones = [...ownerPhones, ...vendorPhones];
  const optedInFull = allPhones.filter(p => p.optedIn).length;
  const notOptedIn = allPhones.filter(p => !p.optedIn).length;

  return (
    <div className="h-full overflow-y-auto bg-gray-50 px-8 py-6">
      <div className="mb-6 flex items-start justify-between gap-6">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            <Link href="/sms" className="hover:text-brand-600">SMS</Link> / Opt-Ins
          </div>
          <h1 className="mt-1 text-2xl font-semibold text-gray-900">SMS Opt-In Management</h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-500">
            Manage which owners and vendors have consented to receive SMS text messages.
          </p>
        </div>
        <Link href="/sms"><Button variant="secondary">Back to SMS</Button></Link>
      </div>

      {/* Metrics */}
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <Metric label="Total contacts" value={allPhones.length} />
        <Metric label="Opted in" value={optedInFull} tone="text-green-700" />
        <Metric label="Not opted in" value={notOptedIn} tone="text-amber-700" />
        <Metric label="Explicitly opted out" value={optedOutCount} tone="text-red-700" />
      </div>

      {allPhones.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
          <h2 className="text-base font-semibold text-gray-900">No contacts with phone numbers</h2>
          <p className="mt-1 text-sm text-gray-500">
            Add phone numbers to owners and vendors to manage their SMS opt-in status here.
          </p>
        </div>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Name</TH>
              <TH>Type</TH>
              <TH>Phone number</TH>
              <TH>Status</TH>
              <TH>Last changed</TH>
              <TH className="w-[120px]">Actions</TH>
            </TR>
          </THead>
          <tbody>
            {allPhones.map((p: any) => {
              const optRec = optInByPhone[p.phone];
              return (
                <TR key={p.id}>
                  <TD className="font-medium text-gray-900">{p.name}</TD>
                  <TD className="text-sm capitalize text-gray-600">{p.entityType}</TD>
                  <TD className="font-mono text-sm text-gray-700">{p.phone}</TD>
                  <TD>
                    {p.optedIn ? (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Opted in</span>
                    ) : optRec && !optRec.opted_in ? (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">Opted out</span>
                    ) : (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">Not set</span>
                    )}
                  </TD>
                  <TD className="text-sm text-gray-500">
                    {optRec?.opted_in_at ? `In: ${formatDate(optRec.opted_in_at)}` : optRec?.opted_out_at ? `Out: ${formatDate(optRec.opted_out_at)}` : '-'}
                  </TD>
                  <TD>
                    <form action={toggleOptIn as any} className="inline">
                      <input type="hidden" name="entity_type" value={p.entityType} />
                      <input type="hidden" name="entity_id" value={p.entityId} />
                      <input type="hidden" name="phone_number" value={p.phone} />
                      {p.optedIn ? (
                        <button type="submit" name="opted_in" value="false" className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50">
                          Opt out
                        </button>
                      ) : (
                        <button type="submit" name="opted_in" value="true" className="rounded px-2 py-1 text-xs text-green-600 hover:bg-green-50">
                          Opt in
                        </button>
                      )}
                    </form>
                  </TD>
                </TR>
              );
            })}
          </tbody>
        </Table>
      )}
    </div>
  );
}

function Metric({ label, value, tone = 'text-gray-900' }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
      <div className="text-xs font-medium uppercase tracking-wider text-gray-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${tone}`}>{value}</div>
    </div>
  );
}
