import Link from 'next/link';
import { Section } from '@/components/workspace/shell';
import { Alert } from '@/components/ui/shell';
import { StatusChip } from '@/components/operations/status-chip';
import { collectionRequirements, stateName, type StateRule } from '@/lib/state-rules';

/** The rules the company follows in the association's state, read-only for managers. */
export function StateRulesSection({
  stateCode,
  rule,
  source,
  loadError,
  canEdit,
}: {
  stateCode: string | null;
  rule: StateRule | null;
  source: 'company' | 'built_in' | 'default' | null;
  loadError: string | null;
  canEdit: boolean;
}) {
  const title = stateCode ? `State rules · ${stateName(stateCode)}` : 'State rules';
  const editHref = stateCode ? `/company-admin/state-rules?state=${stateCode}` : '/company-admin/state-rules';
  return (
    <Section title={title} padded>
      {loadError ? (
        <Alert tone="danger">State rules could not be loaded: {loadError}</Alert>
      ) : !stateCode ? (
        <Alert tone="warning">This association has no state in its address, so no state rules apply. Add the state to its address.</Alert>
      ) : rule ? (
        <div className="space-y-4 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            {source === 'company'
              ? <StatusChip tone="success">Your company&apos;s rules</StatusChip>
              : <StatusChip tone="neutral">{source === 'built_in' ? 'Built-in profile' : 'Default profile'} · your company has none for this state</StatusChip>}
            {canEdit && <Link href={editHref} className="text-[13px] font-medium text-gray-900 underline-offset-2 hover:underline">{source === 'company' ? 'Edit' : 'Add company rules'}</Link>}
          </div>
          <div>
            <h3 className="text-[13px] font-semibold text-gray-950">Before referring an owner to counsel</h3>
            <ul className="mt-1.5 list-disc space-y-1 pl-5 text-gray-700">{collectionRequirements(rule).map((r) => <li key={r}>{r}</li>)}</ul>
            <p className="mt-2 leading-6 text-gray-600">{rule.summary}</p>
          </div>
          {rule.other_rules && (
            <div>
              <h3 className="text-[13px] font-semibold text-gray-950">Other state requirements</h3>
              <p className="mt-1.5 whitespace-pre-line leading-6 text-gray-700">{rule.other_rules}</p>
            </div>
          )}
          {rule.citations.length > 0 && <p className="text-[12px] leading-5 text-gray-400">{rule.citations.join(' · ')}</p>}
          <p className="text-[12px] leading-4 text-gray-400">Workflow rules, not legal advice. Confirm with association counsel and the governing documents.</p>
        </div>
      ) : (
        <p className="text-sm text-gray-500">No rules are set up for this state.</p>
      )}
    </Section>
  );
}
