import { Check, Scale } from 'lucide-react';
import { Alert } from '@/components/ui/shell';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import {
  applyDelinquencyJurisdiction,
  recordBoardReferralVote,
  recordPaymentPlanOffer,
  saveDelinquencyCompliance,
} from '@/lib/rpcs/delinquency-compliance';
import { todayInZone } from '@/lib/time/zoned';

type Profile = {
  state_code: string; state_name: string; summary: string; citations: string[];
  /** The company's own rules for the state (company_state_rules). */
  company?: boolean; other_rules?: string | null;
};
type Policy = {
  association_id: string; jurisdiction: string | null; pre_referral_notice_days: number; notice_method: string;
  payment_plan_offer_required: boolean; payment_plan_min_months: number | null; board_vote_required: boolean;
  foreclosure_min_balance: number | null; foreclosure_min_months: number | null;
};

/** Association-level: which state's pre-referral protections the ladder enforces. */
export function JurisdictionPanel({
  associationName,
  policy,
  profiles,
  canEdit,
}: {
  associationName: string;
  policy: Policy;
  profiles: Profile[];
  canEdit: boolean;
}) {
  const profile = profiles.find((p) => p.state_code === policy.jurisdiction) ?? profiles.find((p) => p.state_code === 'DEFAULT');
  const requirements = [
    `${policy.notice_method === 'certified_mail' ? 'Certified-mail' : 'Written'} notice delivered ≥ ${policy.pre_referral_notice_days} days before referral`,
    policy.payment_plan_offer_required ? `Payment plan offered${policy.payment_plan_min_months ? ` (≥ ${policy.payment_plan_min_months} months)` : ''}` : null,
    policy.board_vote_required ? 'Board vote approving referral' : null,
    policy.foreclosure_min_balance != null ? `Foreclosure only at ≥ $${Number(policy.foreclosure_min_balance).toLocaleString()} owed` : null,
    policy.foreclosure_min_months != null ? `Foreclosure only after ≥ ${policy.foreclosure_min_months} months delinquent` : null,
  ].filter(Boolean) as string[];

  return (
    <details className="rounded-2xl border border-gray-200/70 bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
        <span className="flex items-center gap-2 font-semibold text-gray-950"><Scale className="h-4 w-4 text-gray-400" />{associationName}</span>
        <span className="text-[13px] text-gray-500">{profile?.state_name ?? 'Default'} protections · {requirements.length} gates</span>
      </summary>
      <div className="mt-4 grid gap-5 lg:grid-cols-2">
        <div className="space-y-3 text-sm">
          <ul className="space-y-1.5">
            {requirements.map((r) => <li key={r} className="flex gap-2 text-gray-700"><Check className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />{r}</li>)}
          </ul>
          {profile && (
            <div className="rounded-xl bg-gray-50 p-3 text-[13px] leading-5 text-gray-600">
              {profile.company && <p className="mb-1 text-[12px] font-medium text-gray-900">Your company&apos;s {profile.state_name} rules</p>}
              <p>{profile.summary}</p>
              {profile.other_rules && <p className="mt-2 whitespace-pre-line">{profile.other_rules}</p>}
              <p className="mt-2 text-[12px] text-gray-400">{profile.citations.join(' · ')}</p>
            </div>
          )}
          <p className="text-[12px] leading-4 text-gray-400">Workflow gates, not legal advice. Confirm notice periods, delivery rules, and remedies with association counsel and the governing documents.</p>
        </div>
        {canEdit && (
          <div className="space-y-4">
            <form action={applyDelinquencyJurisdiction} className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <input type="hidden" name="association_id" value={policy.association_id} />
              <Field label="State profile" className="flex-1">
                <Select name="state_code" defaultValue={policy.jurisdiction ?? 'DEFAULT'}>
                  {profiles.map((p) => <option key={p.state_code} value={p.state_code}>{p.state_name}</option>)}
                </Select>
              </Field>
              <Button type="submit" variant="secondary">Apply profile</Button>
            </form>
            <form action={saveDelinquencyCompliance} className="space-y-3 border-t border-gray-100 pt-4">
              <input type="hidden" name="association_id" value={policy.association_id} />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Notice days"><Input name="pre_referral_notice_days" type="number" min="0" max="180" defaultValue={policy.pre_referral_notice_days} /></Field>
                <Field label="Notice method">
                  <Select name="notice_method" defaultValue={policy.notice_method}>
                    <option value="certified_mail">Certified mail</option>
                    <option value="first_class">First-class / written</option>
                  </Select>
                </Field>
                <Field label="Plan months (min)"><Input name="payment_plan_min_months" type="number" min="1" max="60" defaultValue={policy.payment_plan_min_months ?? ''} /></Field>
                <Field label="Foreclosure min $"><Input name="foreclosure_min_balance" type="number" min="0" step="0.01" defaultValue={policy.foreclosure_min_balance ?? ''} /></Field>
                <Field label="Foreclosure min months"><Input name="foreclosure_min_months" type="number" min="0" max="120" defaultValue={policy.foreclosure_min_months ?? ''} /></Field>
              </div>
              <label className="flex min-h-10 items-center gap-2 text-sm text-gray-700"><input type="checkbox" name="payment_plan_offer_required" defaultChecked={policy.payment_plan_offer_required} className="h-4 w-4 rounded border-gray-300" />Require a payment-plan offer before referral</label>
              <label className="flex min-h-10 items-center gap-2 text-sm text-gray-700"><input type="checkbox" name="board_vote_required" defaultChecked={policy.board_vote_required} className="h-4 w-4 rounded border-gray-300" />Require a board vote before referral</label>
              <Button type="submit" variant="secondary">Save overrides</Button>
            </form>
          </div>
        )}
      </div>
    </details>
  );
}

/** Case-level: what still blocks referral, plus forms to record the protections. */
export function ReferralReadiness({
  caseId,
  readiness,
  planRequired,
  planMinMonths,
  boardRequired,
}: {
  caseId: string;
  readiness: { blockers: string[]; warnings: string[] } | null;
  planRequired: boolean;
  planMinMonths: number | null;
  boardRequired: boolean;
}) {
  if (!readiness) return null;
  const today = todayInZone();
  const needsPlan = planRequired && readiness.blockers.some((b) => b.startsWith('Recorded payment-plan'));
  const needsBoard = boardRequired && readiness.blockers.some((b) => b.startsWith('Recorded board vote'));
  return (
    <div className="mt-4 space-y-3 border-t border-gray-100 pt-4">
      {readiness.blockers.length === 0 ? (
        <Alert tone="success">All referral protections for this jurisdiction are satisfied.</Alert>
      ) : (
        <Alert tone="warning" title="Before legal referral:">{readiness.blockers.join(' · ')}</Alert>
      )}
      {readiness.warnings.map((w) => <Alert key={w} tone="info">{w}</Alert>)}
      <div className="grid gap-3 lg:grid-cols-2">
        {needsPlan && (
          <form action={recordPaymentPlanOffer} className="space-y-2 rounded-xl border border-gray-200/70 p-3">
            <input type="hidden" name="case_id" value={caseId} />
            <div className="text-sm font-medium text-gray-900">Record payment-plan offer</div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Offered on"><Input name="offered_on" type="date" required max={today} defaultValue={today} /></Field>
              <Field label="Months"><Input name="months" type="number" required min={planMinMonths ?? 1} max="60" defaultValue={planMinMonths ?? 6} /></Field>
            </div>
            <Textarea name="terms" required minLength={10} maxLength={2000} rows={2} placeholder="Terms offered, e.g. 18 monthly payments of $62.50, fees waived while current" />
            <Button type="submit" variant="secondary" size="sm">Record offer</Button>
          </form>
        )}
        {needsBoard && (
          <form action={recordBoardReferralVote} className="space-y-2 rounded-xl border border-gray-200/70 p-3">
            <input type="hidden" name="case_id" value={caseId} />
            <div className="text-sm font-medium text-gray-900">Record board referral vote</div>
            <div className="grid grid-cols-3 gap-2">
              <Field label="Meeting"><Input name="meeting_date" type="date" required max={today} /></Field>
              <Field label="For"><Input name="votes_for" type="number" required min="0" max="99" /></Field>
              <Field label="Against"><Input name="votes_against" type="number" required min="0" max="99" defaultValue={0} /></Field>
            </div>
            <Input name="note" required minLength={10} maxLength={2000} placeholder="Motion / minutes reference" />
            <Button type="submit" variant="secondary" size="sm">Record vote</Button>
          </form>
        )}
      </div>
    </div>
  );
}
