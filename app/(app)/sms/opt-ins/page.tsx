import Link from 'next/link';
import { PhoneCall } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { MetricStrip } from '@/components/operations/metric-strip';
import { StatusChip } from '@/components/operations/status-chip';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/shell';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { toggleOptIn } from '@/lib/rpcs/sms';

export const dynamic = 'force-dynamic';

function formatDate(value: string | null) {
  if (!value) return '—';
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
  const optedOutCount = optInRows.filter((o: any) => !o.opted_in).length;

  // Build a lookup: phone -> opt-in record
  const optInByPhone: Record<string, any> = {};
  optInRows.forEach((o: any) => {
    optInByPhone[o.phone_number] = o;
  });

  // Extract owners with phones
  function extractPhones(entity: any): Array<{ id: string; name: string; phone: string; optedIn: boolean; entityId: string }> {
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
    ownerPhones.push(...extractPhones(o).map(p => ({ ...p, entityType: 'owner' })));
  });

  const vendorPhones: any[] = [];
  (vendors ?? []).forEach((v: any) => {
    vendorPhones.push(...extractPhones(v).map(p => ({ ...p, entityType: 'vendor' })));
  });

  const allPhones = [...ownerPhones, ...vendorPhones];
  const optedInFull = allPhones.filter(p => p.optedIn).length;
  const notOptedIn = allPhones.filter(p => !p.optedIn).length;

  return (
    <DataWorkspace
      title="SMS Opt-In Management"
      description="Manage which owners and vendors have consented to receive SMS text messages."
      actions={<Link href="/sms"><Button variant="secondary">Back to SMS</Button></Link>}
    >
      <div className="space-y-6">
        <MetricStrip
          metrics={[
            { label: 'Total contacts', value: allPhones.length },
            { label: 'Opted in', value: optedInFull },
            { label: 'Not opted in', value: notOptedIn },
            { label: 'Explicitly opted out', value: optedOutCount },
          ]}
        />

        {allPhones.length === 0 ? (
          <div className="rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <EmptyState
              icon={PhoneCall}
              title="No contacts with phone numbers"
              description="Add phone numbers to owners and vendors to manage their SMS opt-in status here."
            />
          </div>
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Name</TH>
                <TH>Type</TH>
                <TH>Phone number</TH>
                <TH>Status</TH>
                <TH>Last changed</TH>
                <TH className="w-[120px]">Actions</TH>
              </tr>
            </THead>
            <tbody>
              {allPhones.map((p: any) => {
                const optRec = optInByPhone[p.phone];
                return (
                  <TR key={p.id}>
                    <TD className="font-medium text-gray-900">{p.name}</TD>
                    <TD className="capitalize text-gray-600">{p.entityType}</TD>
                    <TD className="font-mono text-gray-700">{p.phone}</TD>
                    <TD>
                      {p.optedIn ? (
                        <StatusChip tone="success">Opted in</StatusChip>
                      ) : optRec && !optRec.opted_in ? (
                        <StatusChip tone="danger">Opted out</StatusChip>
                      ) : (
                        <StatusChip tone="neutral">Not set</StatusChip>
                      )}
                    </TD>
                    <TD className="text-gray-500">
                      {optRec?.opted_in_at ? `In: ${formatDate(optRec.opted_in_at)}` : optRec?.opted_out_at ? `Out: ${formatDate(optRec.opted_out_at)}` : '—'}
                    </TD>
                    <TD>
                      <form action={toggleOptIn as any} className="inline">
                        <input type="hidden" name="entity_type" value={p.entityType} />
                        <input type="hidden" name="entity_id" value={p.entityId} />
                        <input type="hidden" name="phone_number" value={p.phone} />
                        {p.optedIn ? (
                          <button type="submit" name="opted_in" value="false" className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50">
                            Opt out
                          </button>
                        ) : (
                          <button type="submit" name="opted_in" value="true" className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-50">
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
    </DataWorkspace>
  );
}
