import Link from 'next/link';
import { PhoneCall } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { MetricStrip } from '@/components/operations/metric-strip';
import { StatusChip } from '@/components/operations/status-chip';
import { Button } from '@/components/ui/button';
import { Alert, EmptyState } from '@/components/ui/shell';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { toggleOptIn } from '@/lib/rpcs/sms';
import { canonicalPhone } from '@/lib/sms/twilio';
import { phoneNumberList } from '@/lib/sms/phone-entries';
import { fetchAllRows } from '@/lib/supabase/fetch-all';

export const dynamic = 'force-dynamic';

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default async function SmsOptInsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
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

  // Every owner and (unarchived) vendor with phone numbers, paged past
  // PostgREST's 1,000-row cap instead of silently stopping at 500.
  const [ownerRes, vendorRes] = await Promise.all([
    fetchAllRows<any>(() => db
      .from('owners')
      .select('id, full_name, phone, phone_numbers')
      .is('archived_at', null)
      .eq('portfolio_id', me.portfolio?.id)
      .order('full_name')
      .order('id')),
    fetchAllRows<any>(() => db
      .from('vendors')
      .select('id, name, phone_numbers')
      .is('archived_at', null)
      .eq('portfolio_id', me.portfolio?.id)
      .order('name')
      .order('id')),
  ]);
  const owners = ownerRes.rows;
  const vendors = vendorRes.rows;
  const recipientLoadError = ownerRes.error ?? vendorRes.error;
  const recipientsTruncated = ownerRes.truncated || vendorRes.truncated;

  const optInRows = (optIns ?? []).filter((record: any) => ['owner', 'vendor'].includes(record.entity_type));
  const optedOutCount = optInRows.filter((o: any) => !o.opted_in).length;

  // Build a lookup: phone -> opt-in record
  const optInByPhone: Record<string, any> = {};
  optInRows.forEach((o: any) => {
    optInByPhone[canonicalPhone(o.phone_number)] = o;
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
    // phone_numbers holds { number } objects or plain strings.
    phones.push(...phoneNumberList(entity.phone_numbers));

    // The primary phone is usually also in phone_numbers: list each number once.
    const seen = new Set<string>();
    const unique = phones.filter((p) => {
      const key = canonicalPhone(p);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    unique.forEach((phone, idx) => {
      const optRec = optInByPhone[canonicalPhone(phone)];
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
        {sp.error && (
          <Alert tone="danger" title="Could not update opt-in:">{sp.error}</Alert>
        )}

        {recipientLoadError && <Alert tone="danger" title="Could not load recipients.">{recipientLoadError}</Alert>}
        {recipientsTruncated && <Alert tone="warning" title="Recipient list truncated.">Not every owner or vendor could be loaded.</Alert>}

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
                const optRec = optInByPhone[canonicalPhone(p.phone)];
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
                          <div className="flex min-w-64 gap-2"><input name="consent_source" required minLength={10} placeholder="Consent source and date" className="min-w-0 flex-1 rounded-lg border border-gray-300 px-2 py-1 text-xs" /><button type="submit" name="opted_in" value="true" className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-50">Opt in</button></div>
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
