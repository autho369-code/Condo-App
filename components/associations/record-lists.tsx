import Link from 'next/link';
import { Section } from '@/components/workspace/shell';
import { StatusChip } from '@/components/operations/status-chip';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import {
  addAdditionalFee, addAssociationInsurance, addAssociationKey, addAssociationNote,
  archiveAssociationInsurance, archiveAssociationKey, archiveAssociationNote, deleteAdditionalFee,
} from '@/lib/rpcs/association-record';
import { date, money } from '@/lib/utils';
import { PendingSubmit } from '@/components/ui/pending-submit';

type Common = { associationId: string; back: string };
const Hidden = ({ associationId, back }: Common) => (<><input type="hidden" name="association_id" value={associationId} /><input type="hidden" name="back" value={back} /></>);
const Empty = ({ children }: { children: React.ReactNode }) => <p className="px-5 py-4 text-sm text-gray-500">{children}</p>;

export const COVERAGE_LABEL: Record<string, string> = {
  master_property: 'Master property', general_liability: 'General liability', directors_officers: 'Directors & officers',
  fidelity_crime: 'Fidelity / crime', umbrella: 'Umbrella', flood: 'Flood', earthquake: 'Earthquake',
  workers_comp: 'Workers’ compensation', boiler_machinery: 'Boiler & machinery', cyber: 'Cyber', other: 'Other',
};

export function UpcomingActivities({ events, associationId }: { events: any[]; associationId: string }) {
  return (
    <Section title="Upcoming activities" actions={<Link href={`/calendar/new?assoc=${associationId}`} className="text-[13px] font-medium text-gray-500 hover:text-gray-900">Add activity</Link>}>
      {events.length ? (
        <ul className="divide-y divide-gray-100">
          {events.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
              <span className="text-gray-900">{e.title}</span>
              <span className="shrink-0 text-[12px] text-gray-500">{new Date(e.start_datetime).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
            </li>
          ))}
        </ul>
      ) : <Empty>Nothing scheduled in the next 60 days.</Empty>}
    </Section>
  );
}

export function InsuranceList({ policies, associationId, back }: Common & { policies: any[] }) {
  const soon = Date.now() + 60 * 86400000;
  return (
    <Section title="Association insurance" subtitle="Master, D&O, fidelity, umbrella and other association policies. Owner HO-6 policies live on each owner.">
      {policies.length ? (
        <ul className="divide-y divide-gray-100">
          {policies.map((p) => {
            const exp = p.expiration_date ? new Date(`${p.expiration_date}T00:00:00`).getTime() : null;
            return (
              <li key={p.id} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 text-sm">
                  <div className="font-medium text-gray-900">{COVERAGE_LABEL[p.coverage_type] ?? p.coverage_type} · {p.carrier}</div>
                  <div className="text-[12px] text-gray-500">
                    {[p.policy_number && `#${p.policy_number}`, p.coverage_amount != null && `Coverage ${money(p.coverage_amount)}`, p.deductible != null && `Deductible ${money(p.deductible)}`, p.agent_name && `Agent ${p.agent_name}`].filter(Boolean).join(' · ')}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {exp && (exp < Date.now() ? <StatusChip tone="danger">Expired</StatusChip> : exp < soon ? <StatusChip tone="warning">Expires {date(p.expiration_date)}</StatusChip> : <StatusChip tone="success">Through {date(p.expiration_date)}</StatusChip>)}
                  <form action={archiveAssociationInsurance}><Hidden associationId={associationId} back={back} /><input type="hidden" name="id" value={p.id} /><PendingSubmit variant="ghost" size="sm" pendingLabel="Archiving…" confirm="Archive this insurance policy?">Archive</PendingSubmit></form>
                </div>
              </li>
            );
          })}
        </ul>
      ) : <Empty>No association policies on file.</Empty>}
      <details className="border-t border-gray-100 px-5 py-3">
        <summary className="cursor-pointer text-[13px] font-medium text-gray-600 hover:text-gray-900">Add policy</summary>
        <form action={addAssociationInsurance} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Hidden associationId={associationId} back={back} />
          <Field label="Coverage"><Select name="coverage_type" required defaultValue="master_property">{Object.entries(COVERAGE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></Field>
          <Field label="Carrier"><Input name="carrier" required maxLength={200} /></Field>
          <Field label="Policy number"><Input name="policy_number" maxLength={80} /></Field>
          <Field label="Coverage amount"><Input name="coverage_amount" type="number" min="0" step="0.01" /></Field>
          <Field label="Deductible"><Input name="deductible" type="number" min="0" step="0.01" /></Field>
          <Field label="Annual premium"><Input name="annual_premium" type="number" min="0" step="0.01" /></Field>
          <Field label="Effective"><Input name="effective_date" type="date" /></Field>
          <Field label="Expires"><Input name="expiration_date" type="date" /></Field>
          <Field label="Agent"><Input name="agent_name" maxLength={120} /></Field>
          <Field label="Agent email"><Input name="agent_email" type="email" maxLength={254} /></Field>
          <Field label="Agent phone"><Input name="agent_phone" maxLength={40} /></Field>
          <div className="flex items-end"><Button type="submit" className="w-full">Add policy</Button></div>
        </form>
      </details>
    </Section>
  );
}

export function AdditionalFees({ fees, glAccounts, associationId, back }: Common & { fees: any[]; glAccounts: any[] }) {
  const gl = new Map(glAccounts.map((g) => [g.id, `${g.number ?? ''} ${g.name}`.trim()]));
  return (
    <Section title="Additional management fees" subtitle="Fees billed to the association on top of the base management fee, e.g. a percentage of late fees collected.">
      {fees.length ? (
        <ul className="divide-y divide-gray-100">
          {fees.map((f) => (
            <li key={f.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
              <span className="text-gray-900">{f.label}<span className="text-gray-500"> · {f.percentage != null ? `${Number(f.percentage)}%` : money(f.amount)}{f.gl_account_id ? ` of ${gl.get(f.gl_account_id) ?? 'GL'}` : ''}{f.suppress ? ' · suppressed' : ''}</span></span>
              <form action={deleteAdditionalFee}><Hidden associationId={associationId} back={back} /><input type="hidden" name="id" value={f.id} /><PendingSubmit variant="ghost" size="sm" pendingLabel="Removing…" confirm="Remove this fee?">Remove</PendingSubmit></form>
            </li>
          ))}
        </ul>
      ) : <Empty>No additional fees.</Empty>}
      <details className="border-t border-gray-100 px-5 py-3">
        <summary className="cursor-pointer text-[13px] font-medium text-gray-600 hover:text-gray-900">Add fee</summary>
        <form action={addAdditionalFee} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-4">
          <Hidden associationId={associationId} back={back} />
          <Field label="Name"><Input name="label" required maxLength={120} /></Field>
          <Field label="Based on GL account"><Select name="gl_account_id" defaultValue=""><option value="">—</option>{glAccounts.map((g) => <option key={g.id} value={g.id}>{`${g.number ?? ''} ${g.name}`.trim()}</option>)}</Select></Field>
          <Field label="Percentage"><Input name="percentage" type="number" min="0" max="100" step="0.01" /></Field>
          <Field label="Or amount"><Input name="amount" type="number" min="0" step="0.01" /></Field>
          <label className="flex min-h-10 items-center gap-2 text-sm text-gray-700 sm:col-span-3"><input type="checkbox" name="suppress" className="h-4 w-4 rounded border-gray-300" />Suppress (track but do not bill)</label>
          <Button type="submit">Add fee</Button>
        </form>
      </details>
    </Section>
  );
}

export function KeysList({ keys, associationId, back }: Common & { keys: any[] }) {
  return (
    <Section title="Keys">
      {keys.length ? (
        <ul className="divide-y divide-gray-100">
          {keys.map((k) => (
            <li key={k.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
              <span className="text-gray-900">{k.label}<span className="text-gray-500">{k.key_number ? ` · #${k.key_number}` : ''}{k.held_by ? ` · held by ${k.held_by}` : ''}</span></span>
              <form action={archiveAssociationKey}><Hidden associationId={associationId} back={back} /><input type="hidden" name="id" value={k.id} /><PendingSubmit variant="ghost" size="sm" pendingLabel="Removing…" confirm="Remove this key?">Remove</PendingSubmit></form>
            </li>
          ))}
        </ul>
      ) : <Empty>No keys recorded.</Empty>}
      <details className="border-t border-gray-100 px-5 py-3">
        <summary className="cursor-pointer text-[13px] font-medium text-gray-600 hover:text-gray-900">Add key</summary>
        <form action={addAssociationKey} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-4">
          <Hidden associationId={associationId} back={back} />
          <Field label="Key"><Input name="label" required maxLength={120} placeholder="e.g. Roof access" /></Field>
          <Field label="Number"><Input name="key_number" maxLength={40} /></Field>
          <Field label="Held by"><Input name="held_by" maxLength={120} /></Field>
          <div className="flex items-end"><Button type="submit" className="w-full">Add key</Button></div>
        </form>
      </details>
    </Section>
  );
}

export function NotesList({ notes, associationId, back }: Common & { notes: any[] }) {
  return (
    <Section title="Notes">
      {notes.length ? (
        <ul className="divide-y divide-gray-100">
          {notes.map((n) => (
            <li key={n.id} className="flex items-start justify-between gap-3 px-5 py-3 text-sm">
              <div className="min-w-0">
                {n.is_standard && <StatusChip tone="info">Standard</StatusChip>}
                <p className="mt-1 whitespace-pre-wrap text-gray-800">{n.body}</p>
                <div className="mt-1 text-[12px] text-gray-400">{date(n.created_at)}</div>
              </div>
              <form action={archiveAssociationNote}><Hidden associationId={associationId} back={back} /><input type="hidden" name="id" value={n.id} /><PendingSubmit variant="ghost" size="sm" pendingLabel="Archiving…" confirm="Archive this note?">Archive</PendingSubmit></form>
            </li>
          ))}
        </ul>
      ) : <Empty>No notes yet.</Empty>}
      <form action={addAssociationNote} className="space-y-2 border-t border-gray-100 px-5 py-3">
        <Hidden associationId={associationId} back={back} />
        <Textarea name="body" rows={2} maxLength={5000} placeholder="Add a note for the management team" aria-label="Note" />
        <div className="flex items-center justify-between gap-2">
          <label className="flex min-h-10 items-center gap-2 text-sm text-gray-700"><input type="checkbox" name="is_standard" className="h-4 w-4 rounded border-gray-300" />Standard note (always shown)</label>
          <Button type="submit" size="sm">Add note</Button>
        </div>
      </form>
    </Section>
  );
}

export function LinkedRecords({ banks, assets, associationId }: { banks: any[]; assets: any[]; associationId: string }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Section title="Bank accounts" actions={<Link href="/bank-accounts/new" className="text-[13px] font-medium text-gray-500 hover:text-gray-900">Add</Link>}>
        {banks.length ? (
          <ul className="divide-y divide-gray-100">{banks.map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
              <Link href={`/bank-accounts/${b.id}`} className="text-gray-900 hover:text-gray-600">{b.name}</Link>
              <span className="text-[12px] capitalize text-gray-500">{(b.purpose ?? b.fund_type ?? 'operating').toString().replace(/_/g, ' ')}{b.last_reconciliation_date ? ` · reconciled ${date(b.last_reconciliation_date)}` : ''}</span>
            </li>
          ))}</ul>
        ) : <Empty>No bank accounts linked.</Empty>}
      </Section>
      <Section title="Fixed assets" actions={<Link href={`/fixed-assets/new?association_id=${associationId}`} className="text-[13px] font-medium text-gray-500 hover:text-gray-900">Add</Link>}>
        {assets.length ? (
          <ul className="divide-y divide-gray-100">{assets.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
              <span className="text-gray-900">{a.name}</span>
              <span className="text-[12px] text-gray-500">{a.purchase_price != null ? money(a.purchase_price) : ''}{a.purchase_date ? ` · ${date(a.purchase_date)}` : ''}</span>
            </li>
          ))}</ul>
        ) : <Empty>No fixed assets recorded.</Empty>}
      </Section>
    </div>
  );
}

const AUDIT_LABEL: Record<string, string> = {
  association_settings_updated: 'Settings updated', association_private_settings_updated: 'Staff-only settings updated',
  board_approval_settings_updated: 'Approval rules updated',
  violation_settings_updated: 'Fining policy updated', delinquency_jurisdiction_applied: 'Collection profile applied',
  delinquency_compliance_updated: 'Collection protections updated', year_end_package_generated: 'Year-end package prepared',
  year_end_package_finalized: 'Year-end package finalized', year_end_package_superseded: 'Year-end package superseded',
};

export function AuditLog({ events }: { events: any[] }) {
  return (
    <Section title="Audit log" subtitle="Changes to this association’s settings and controls.">
      {events.length ? (
        <ul className="divide-y divide-gray-100">
          {events.map((e) => {
            // Staff-only settings log just the changed field names (no values).
            const fields: string[] = Array.isArray(e.changes?.fields) ? e.changes.fields : Object.keys(e.changes?.after ?? {});
            return (
              <li key={e.id} className="px-5 py-2.5 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-gray-900">{AUDIT_LABEL[e.action] ?? e.action.replace(/_/g, ' ')}</span>
                  <span className="shrink-0 text-[12px] text-gray-400">{new Date(e.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                </div>
                <div className="text-[12px] text-gray-500">{e.actor_email ?? 'System'}{fields.length ? ` · ${fields.map((f) => f.replace(/_/g, ' ')).slice(0, 6).join(', ')}${fields.length > 6 ? '…' : ''}` : ''}</div>
              </li>
            );
          })}
        </ul>
      ) : <Empty>No recorded changes yet.</Empty>}
    </Section>
  );
}
