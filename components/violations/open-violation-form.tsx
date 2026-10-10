'use client';

import * as React from 'react';
import Link from 'next/link';
import { PendingSubmit } from '@/components/ui/pending-submit';
import { Field, Input, Select, Textarea } from '@/components/ui/input';

type Rule = { id: string; association_id: string; rule_number: string; title: string; description: string; action_to_resolve: string | null; default_violation_type: string };
type Unit = { id: string; label: string; association_id: string };

export function OpenViolationForm({
  action,
  associations,
  units,
  rules,
  types,
  initialAssociationId,
  initialRuleId,
  today: todayProp,
  todayByAssociation,
  submissionToken,
}: {
  action: (formData: FormData) => void | Promise<void>;
  associations: { id: string; name: string }[];
  units: Unit[];
  rules: Rule[];
  types: { value: string; label: string }[];
  initialAssociationId?: string;
  initialRuleId?: string;
  /** Today's date in the association's zone (the server's UTC date is tomorrow on a US evening). */
  today?: string;
  /** Today's date in each association's own zone; wins over `today` once one is picked. */
  todayByAssociation?: Record<string, string>;
  /** One-time token so a double click opens one violation. */
  submissionToken?: string;
}) {
  const [associationId, setAssociationId] = React.useState(initialAssociationId ?? '');
  const [ruleId, setRuleId] = React.useState(initialRuleId ?? '');
  const assocRules = rules.filter((r) => r.association_id === associationId);
  const assocUnits = units.filter((u) => u.association_id === associationId);
  const rule = assocRules.find((r) => r.id === ruleId);
  const fallbackToday = todayProp ?? (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();
  const today = (associationId && todayByAssociation?.[associationId]) || fallbackToday;

  return (
    <form action={action} className="space-y-5">
      {submissionToken && <input type="hidden" name="submission_token" value={submissionToken} />}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Association" htmlFor="association_id" required>
          <Select id="association_id" name="association_id" required value={associationId} onChange={(e) => { setAssociationId(e.target.value); setRuleId(''); }}>
            <option value="">Select association</option>
            {associations.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
        </Field>
        <Field label="Unit" htmlFor="unit_id" hint="The owner of record is attached automatically. Fines need a unit.">
          <Select id="unit_id" name="unit_id" disabled={!associationId} defaultValue="">
            <option value="">Common area / unknown</option>
            {assocUnits.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
          </Select>
        </Field>
        <Field label="Rule violated" htmlFor="house_rule_id" className="sm:col-span-2"
          hint={associationId && assocRules.length === 0 ? <>This association has no rules yet — <Link className="font-medium text-gray-600 underline" href={`/violations/rules?association_id=${associationId}`}>set up its rule library</Link>.</> : undefined}>
          <Select id="house_rule_id" name="house_rule_id" disabled={!associationId} value={ruleId} onChange={(e) => setRuleId(e.target.value)}>
            <option value="">No specific rule</option>
            {assocRules.map((r) => <option key={r.id} value={r.id}>{r.rule_number} — {r.title}</option>)}
          </Select>
        </Field>
      </div>

      {rule && (
        <div className="rounded-xl border border-gray-200/70 bg-gray-50 px-4 py-3 text-[13px] leading-5 text-gray-600">
          <div className="font-medium text-gray-900">{rule.rule_number} — {rule.title}</div>
          <p className="mt-1 whitespace-pre-wrap">{rule.description}</p>
          {rule.action_to_resolve && <p className="mt-2"><span className="font-medium text-gray-700">To resolve: </span>{rule.action_to_resolve}</p>}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_200px_180px]">
        <Field label="Title" htmlFor="title" hint={rule ? 'Leave blank to use the rule title.' : undefined}>
          <Input key={`title-${ruleId}`} id="title" name="title" maxLength={200} placeholder={rule?.title ?? 'e.g. Bicycle stored in hallway'} required={!rule} />
        </Field>
        <Field label="Type" htmlFor="violation_type">
          <Select key={`type-${ruleId}`} id="violation_type" name="violation_type" defaultValue={rule?.default_violation_type ?? 'other'}>
            {types.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </Select>
        </Field>
        <Field label="Observed on" htmlFor="date_observed">
          {/* Re-keyed so the default follows the selected association's date. */}
          <Input key={today} id="date_observed" name="date_observed" type="date" max={today} defaultValue={today} />
        </Field>
      </div>
      <Field label="What was observed" htmlFor="description" hint={rule ? 'Leave blank to use the rule text.' : undefined}>
        <Textarea id="description" name="description" rows={4} maxLength={4000} placeholder="Where, when, and what — facts only." />
      </Field>

      <div className="flex flex-col-reverse gap-3 border-t border-gray-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/violations" className="text-center text-sm text-gray-600 hover:text-gray-900">Cancel</Link>
        <PendingSubmit pendingLabel="Opening…">Open violation</PendingSubmit>
      </div>
    </form>
  );
}
