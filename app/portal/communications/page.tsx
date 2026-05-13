import { requireOwnerPortal } from '@/lib/auth/me';
import { normalizeTextPhone } from '@/lib/communications/text-messages';
import { createClient } from '@/lib/supabase/server';
import { date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function PortalCommunicationsPage() {
  const me = await requireOwnerPortal();
  const supabase = await createClient();
  const ownerId = me.owner_id;

  const { data: owner } = ownerId
    ? await (supabase as any)
        .from('owners')
        .select('id, full_name, email, phone, phone_numbers')
        .eq('id', ownerId)
        .maybeSingle()
    : { data: null };

  const phones = owner ? ownerPhones(owner) : [];
  const email = owner?.email ?? me.email;

  const [{ data: emailRows }, { data: smsRows }] = await Promise.all([
    email
      ? (supabase as any)
          .from('communication_messages')
          .select('id, created_at, channel, subject, body, status, recipient_name, recipient_email, recipient_phone')
          .eq('recipient_email', email)
          .order('created_at', { ascending: false })
          .limit(50)
      : Promise.resolve({ data: [] }),
    phones.length
      ? (supabase as any)
          .from('communication_messages')
          .select('id, created_at, channel, subject, body, status, recipient_name, recipient_email, recipient_phone')
          .in('recipient_phone', phones)
          .order('created_at', { ascending: false })
          .limit(50)
      : Promise.resolve({ data: [] }),
  ]);

  const rows = dedupeRows([...(emailRows ?? []), ...(smsRows ?? [])])
    .sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at)))
    .slice(0, 100);

  return (
    <div className="space-y-6">
      <header className="border-b border-ink-100 pb-7">
        <div className="eyebrow">Owner portal</div>
        <h1 className="mt-2 font-display text-4xl tracking-editorial text-ink-900">Communication history</h1>
        <p className="mt-2 text-[15px] text-ink-500">Emails, notices, and text messages sent through the app.</p>
      </header>

      <section className="overflow-hidden rounded border border-ink-100 bg-white">
        {rows.length > 0 ? (
          <table className="w-full text-sm">
            <thead className="border-b border-ink-100 bg-cream-50 text-xs uppercase tracking-wide text-ink-600">
              <tr>
                <th className="px-4 py-2 text-left font-semibold">Date</th>
                <th className="px-4 py-2 text-left font-semibold">Type</th>
                <th className="px-4 py-2 text-left font-semibold">Subject</th>
                <th className="px-4 py-2 text-left font-semibold">Message</th>
                <th className="px-4 py-2 text-left font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row: any) => (
                <tr key={row.id} className="border-b border-ink-100 last:border-b-0">
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-ink-500">{date(row.created_at)}</td>
                  <td className="px-4 py-3 text-xs font-semibold uppercase text-ink-600">{row.channel}</td>
                  <td className="px-4 py-3 text-ink-900">{row.subject ?? 'Notice'}</td>
                  <td className="max-w-md truncate px-4 py-3 text-ink-600">{row.body}</td>
                  <td className="px-4 py-3 text-xs capitalize text-ink-500">{row.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="px-5 py-8 text-center text-sm text-ink-500">No communication history is available yet.</p>
        )}
      </section>
    </div>
  );
}

function ownerPhones(owner: any) {
  const values = [owner.phone];
  if (Array.isArray(owner.phone_numbers)) {
    values.push(...owner.phone_numbers.map((item: any) => typeof item === 'string' ? item : item?.number ?? item?.value));
  }
  const seen = new Set<string>();
  return values.flatMap((value) => {
    const phone = normalizeTextPhone(value);
    if (!phone || seen.has(phone)) return [];
    seen.add(phone);
    return [phone];
  });
}

function dedupeRows(rows: any[]) {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
}
