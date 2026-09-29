'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/input';

type Settings = {
  signatures_required?: boolean | null;
  default_voting_scheme?: string | null;
  default_percentage_required?: number | null;
  sends_bills_to_board?: string | null;
  bills_threshold?: number | string | null;
  sends_pos_to_board?: string | null;
  pos_threshold?: number | string | null;
};

const ROUTING = [
  { value: 'never', label: 'Never — manager approves' },
  { value: 'over_threshold', label: 'At or above a dollar amount' },
  { value: 'always', label: 'Always' },
];

export function ApprovalRulesForm({
  associationId,
  settings,
  action,
  canEdit,
}: {
  associationId: string;
  settings: Settings | null;
  action: (formData: FormData) => void | Promise<void>;
  canEdit: boolean;
}) {
  const [scheme, setScheme] = React.useState(settings?.default_voting_scheme ?? 'majority_approval_required');
  const [billsMode, setBillsMode] = React.useState(settings?.sends_bills_to_board ?? 'never');
  const [posMode, setPosMode] = React.useState(settings?.sends_pos_to_board ?? 'never');

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="association_id" value={associationId} />
      <fieldset disabled={!canEdit} className="space-y-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Voting scheme" htmlFor="voting_scheme">
            <Select id="voting_scheme" name="voting_scheme" value={scheme} onChange={(e) => setScheme(e.target.value)}>
              <option value="majority_approval_required">Majority of the board</option>
              <option value="unanimous_approval_required">Unanimous</option>
              <option value="any_one_approver">Any one board member</option>
              <option value="percentage_required">Percentage of the board</option>
            </Select>
          </Field>
          {scheme === 'percentage_required' ? (
            <Field label="Percentage required" htmlFor="percentage_required">
              <Input id="percentage_required" name="percentage_required" type="number" min="1" max="100" required defaultValue={settings?.default_percentage_required ?? 67} />
            </Field>
          ) : <div className="hidden sm:block" />}

          <Field label="Vendor bills go to the board" htmlFor="bills_mode">
            <Select id="bills_mode" name="bills_mode" value={billsMode} onChange={(e) => setBillsMode(e.target.value)}>
              {ROUTING.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </Select>
          </Field>
          {billsMode === 'over_threshold' ? (
            <Field label="Bill threshold ($)" htmlFor="bills_threshold">
              <Input id="bills_threshold" name="bills_threshold" type="number" min="0" step="0.01" required defaultValue={settings?.bills_threshold ?? ''} />
            </Field>
          ) : <div className="hidden sm:block" />}

          <Field label="Purchase orders go to the board" htmlFor="pos_mode">
            <Select id="pos_mode" name="pos_mode" value={posMode} onChange={(e) => setPosMode(e.target.value)}>
              {ROUTING.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </Select>
          </Field>
          {posMode === 'over_threshold' ? (
            <Field label="PO threshold ($)" htmlFor="pos_threshold">
              <Input id="pos_threshold" name="pos_threshold" type="number" min="0" step="0.01" required defaultValue={settings?.pos_threshold ?? ''} />
            </Field>
          ) : <div className="hidden sm:block" />}
        </div>

        <label className="flex min-h-10 items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" name="signatures_required" defaultChecked={settings?.signatures_required ?? true} className="h-4 w-4 rounded border-gray-300" />
          Require a typed signature with each board vote
        </label>

        {canEdit && <Button type="submit">Save approval rules</Button>}
      </fieldset>
      {!canEdit && <p className="text-xs text-gray-400">Only full-access staff can change approval rules.</p>}
    </form>
  );
}
