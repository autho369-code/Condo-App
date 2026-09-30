import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { Badge } from '@/components/ui/shell';
import { addDelinquencyNote, setCollectionStatus } from '@/lib/rpcs/owner-collections';
import { date } from '@/lib/utils';

export type CollectionOcc = {
  id: string;
  status: string;
  occupancy_type: string;
  in_foreclosure: boolean | null;
  in_collections: boolean | null;
  certified_funds_only: boolean | null;
  allow_online_payments: boolean | null;
  require_full_online_payment: boolean | null;
  units?: { unit_number?: string | null; buildings?: { associations?: { name?: string | null } | null } | null } | null;
};
export type DelinquencyNote = { id: string; occupancy_id: string; note: string; created_by_email: string | null; created_at: string };

function Toggle({ name, checked, title, hint }: { name: string; checked: boolean; title: string; hint: string }) {
  return (
    <label className="flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50/60 p-3">
      <input type="checkbox" name={name} defaultChecked={checked} className="mt-1" />
      <span>
        <span className="block text-sm font-medium text-gray-900">{title}</span>
        <span className="block text-xs text-gray-500">{hint}</span>
      </span>
    </label>
  );
}

export function OwnerCollectionStatus({
  ownerId,
  occupancies,
  notes,
  canEdit,
}: {
  ownerId: string;
  occupancies: CollectionOcc[];
  notes: DelinquencyNote[];
  canEdit: boolean;
}) {
  const owned = occupancies.filter((o) => o.status === 'current' && o.occupancy_type === 'owner');
  if (!owned.length) return null;
  return (
    <div id="collections" className="border-t border-gray-100 px-5 py-4">
      <h3 className="text-sm font-semibold text-gray-900">Collections &amp; payment rules</h3>
      <p className="mt-0.5 text-xs text-gray-500">These flags are enforced: they restrict how this homeowner can pay. Changes are logged.</p>
      <ul className="mt-3 space-y-4">
        {owned.map((o) => {
          const occNotes = notes.filter((n) => n.occupancy_id === o.id);
          const allowOnline = o.allow_online_payments !== false;
          return (
            <li key={o.id} className="rounded-xl border border-gray-100 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-medium text-gray-900">
                  Unit {o.units?.unit_number ?? '—'}
                  <span className="font-normal text-gray-500"> · {o.units?.buildings?.associations?.name ?? ''}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {o.in_foreclosure && <Badge tone="danger">In foreclosure</Badge>}
                  {o.in_collections && <Badge tone="pending">In collections</Badge>}
                  {o.certified_funds_only && <Badge tone="pending">Certified funds only</Badge>}
                  {!allowOnline && <Badge tone="inactive">Online payments off</Badge>}
                  {allowOnline && o.require_full_online_payment && <Badge tone="progress">Online: pay in full</Badge>}
                </div>
              </div>

              {canEdit && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-[12px] font-medium text-gray-500 hover:text-gray-900">Change status</summary>
                  <form action={setCollectionStatus} className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <input type="hidden" name="owner_id" value={ownerId} />
                    <input type="hidden" name="occupancy_id" value={o.id} />
                    <Toggle name="in_collections" checked={!!o.in_collections} title="In collections" hint="Referred to the association's attorney or agency." />
                    <Toggle name="in_foreclosure" checked={!!o.in_foreclosure} title="In foreclosure" hint="Implies in collections." />
                    <Toggle name="certified_funds_only" checked={!!o.certified_funds_only} title="Certified funds only" hint="Office receipts by check, cash or other are refused." />
                    <Toggle name="allow_online_payments" checked={allowOnline} title="Allow online payments" hint="Portal checkout and autopay." />
                    <Toggle name="require_full_online_payment" checked={!!o.require_full_online_payment} title="Require online payments in full" hint="Portal payment must cover the whole balance." />
                    <div className="flex items-end"><Button type="submit" variant="secondary">Save</Button></div>
                  </form>
                </details>
              )}

              <div className="mt-3 border-t border-gray-100 pt-3">
                <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Delinquency notes</div>
                {occNotes.length === 0 ? (
                  <p className="mt-1 text-xs text-gray-500">No delinquency notes.</p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {occNotes.map((n) => (
                      <li key={n.id} className="text-sm text-gray-800">
                        <span className="whitespace-pre-wrap">{n.note}</span>
                        <span className="block text-xs text-gray-500">{n.created_by_email ?? 'staff'} · {date(n.created_at)}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <form action={addDelinquencyNote} className="mt-2 space-y-2">
                  <input type="hidden" name="owner_id" value={ownerId} />
                  <input type="hidden" name="occupancy_id" value={o.id} />
                  <Textarea name="note" rows={2} required maxLength={4000} placeholder="Promised payment by the 15th…" />
                  <Button type="submit" variant="secondary">Add note</Button>
                </form>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
