import Link from 'next/link'
import { Scale } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { requirePortfolioAdmin } from '@/lib/auth/me'
import { PageHeader, Surface, Alert, EmptyState } from '@/components/ui/shell'
import { DataTable } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Field, Input, Select, Textarea } from '@/components/ui/input'
import { PendingSubmit } from '@/components/ui/pending-submit'
import { StatusChip } from '@/components/operations/status-chip'
import { date } from '@/lib/utils'
import {
  US_STATES, STATE_RULE_COLUMNS, collectionRequirements, starterOtherRules, stateCodeOf, stateName, type StateRule,
} from '@/lib/state-rules'
import { applyStateRuleToAssociations, deleteStateRule, saveStateRule } from './actions'

export const dynamic = 'force-dynamic'

type Row = StateRule & { id: string; updated_at: string }

export default async function StateRulesPage({ searchParams }: { searchParams: Promise<{ state?: string; error?: string; saved?: string }> }) {
  const me = await requirePortfolioAdmin()
  const sp = await searchParams
  const db = (await createClient()) as any
  const portfolioId = me.portfolio?.id

  const [rulesRes, assocRes, profilesRes] = await Promise.all([
    db.from('company_state_rules').select(STATE_RULE_COLUMNS).eq('portfolio_id', portfolioId).order('state_code'),
    db.from('associations').select('id, name, state').eq('portfolio_id', portfolioId).is('archived_at', null).order('name'),
    db.from('collection_jurisdiction_profiles').select('state_code, pre_referral_notice_days, notice_method, payment_plan_offer_required, payment_plan_min_months, board_vote_required, foreclosure_min_balance, foreclosure_min_months, summary, citations'),
  ])
  const loadErrors = [
    rulesRes.error && `State rules: ${rulesRes.error.message}`,
    assocRes.error && `Associations: ${assocRes.error.message}`,
    profilesRes.error && `Built-in collection profiles: ${profilesRes.error.message}`,
  ].filter(Boolean) as string[]
  const rules: Row[] = rulesRes.data ?? []
  const ruleByState = new Map(rules.map((r) => [r.state_code, r]))
  const profiles: any[] = profilesRes.data ?? []

  // Associations per state, from their address.
  const assocByState = new Map<string, string[]>()
  for (const a of assocRes.data ?? []) {
    const code = stateCodeOf(a.state)
    if (!code) continue
    assocByState.set(code, [...(assocByState.get(code) ?? []), a.name])
  }
  const statesWithoutRules = [...assocByState.keys()].filter((code) => !ruleByState.has(code)).sort()

  const selected = sp.state && US_STATES.some((s) => s.code === sp.state?.toUpperCase()) ? sp.state.toUpperCase() : null
  const existing = selected ? ruleByState.get(selected) ?? null : null
  // A new state starts from the built-in collection profile and the state's statute summary.
  const builtIn = selected ? profiles.find((p) => p.state_code === selected) ?? profiles.find((p) => p.state_code === 'DEFAULT') : null
  const starter = selected && !existing ? starterOtherRules(selected) : null
  const draft = existing ?? (builtIn ? {
    ...builtIn,
    state_code: selected,
    other_rules: starter?.otherRules ?? '',
    citations: [...(builtIn.state_code === selected ? builtIn.citations ?? [] : []), ...(starter?.citations ?? [])],
  } : null)
  const selectedAssociations = selected ? assocByState.get(selected) ?? [] : []

  return (
    <div className="space-y-6">
      <PageHeader
        title="State Rules"
        description="The rules your company follows in each state. Collection policies use them, and managers see them on each association in that state."
        actions={selected ? <Link href="/company-admin/state-rules"><Button variant="secondary">All states</Button></Link> : undefined}
      />

      {sp.error && <Alert tone="danger">{sp.error}</Alert>}
      {sp.saved && <Alert tone="success">{sp.saved}</Alert>}
      {loadErrors.length > 0 && <Alert tone="danger" title="Some data could not be loaded.">{loadErrors.join(' · ')}</Alert>}

      {!selected && (
        <>
          <Surface>
            <form method="get" className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <Field label="Add or edit a state" className="flex-1">
                <Select name="state" required defaultValue="">
                  <option value="" disabled>Choose a state</option>
                  {US_STATES.map((s) => (
                    <option key={s.code} value={s.code}>{s.name}{ruleByState.has(s.code) ? ' (has rules)' : ''}</option>
                  ))}
                </Select>
              </Field>
              <Button type="submit">Open</Button>
            </form>
            {statesWithoutRules.length > 0 && (
              <p className="mt-3 text-[13px] leading-5 text-gray-500">
                You manage associations in {statesWithoutRules.map((code, i) => (
                  <span key={code}>{i > 0 && ', '}<Link className="font-medium text-gray-900 underline-offset-2 hover:underline" href={`/company-admin/state-rules?state=${code}`}>{stateName(code)}</Link></span>
                ))} with no company rules yet; the built-in collection profile applies there.
              </p>
            )}
          </Surface>

          <DataTable<Row>
            rows={rules}
            rowKey={(r) => r.id}
            onRowHref={(r) => `/company-admin/state-rules?state=${r.state_code}`}
            empty={<EmptyState icon={Scale} title="No state rules yet" description="Choose a state above to record the rules your company follows there." />}
            columns={[
              { key: 'state', header: 'State', render: (r) => <span className="font-medium text-gray-950">{stateName(r.state_code)}</span> },
              { key: 'notice', header: 'Collection notice', render: (r) => `${r.pre_referral_notice_days} days, ${r.notice_method === 'certified_mail' ? 'certified mail' : 'written'}` },
              { key: 'gates', header: 'Before referral', render: (r) => [r.payment_plan_offer_required && 'payment plan', r.board_vote_required && 'board vote'].filter(Boolean).join(', ') || '—' },
              { key: 'assocs', header: 'Associations', align: 'right', render: (r) => assocByState.get(r.state_code)?.length ?? 0 },
              { key: 'updated', header: 'Updated', render: (r) => date(r.updated_at) },
            ]}
          />
        </>
      )}

      {selected && draft && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <Surface>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-gray-950">{stateName(selected)}</h2>
              {existing ? <StatusChip tone="success">Company rules</StatusChip> : <StatusChip tone="neutral">Not saved yet</StatusChip>}
            </div>
            {!existing && (
              <Alert tone="info">This is a starting draft from the built-in state summaries. Review it with your counsel before saving.</Alert>
            )}
            <form action={saveStateRule} className="mt-4 space-y-5">
              <input type="hidden" name="state_code" value={selected} />
              <div>
                <h3 className="text-sm font-semibold text-gray-950">Collections</h3>
                <p className="mt-0.5 text-[13px] text-gray-500">Checked before an owner account can be referred to counsel.</p>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Notice days before referral" required><Input name="pre_referral_notice_days" type="number" min="0" max="180" required defaultValue={draft.pre_referral_notice_days} /></Field>
                  <Field label="Notice sent by" required>
                    <Select name="notice_method" defaultValue={draft.notice_method}>
                      <option value="certified_mail">Certified mail</option>
                      <option value="first_class">First-class / written</option>
                    </Select>
                  </Field>
                  <Field label="Payment plan, minimum months"><Input name="payment_plan_min_months" type="number" min="1" max="60" defaultValue={draft.payment_plan_min_months ?? ''} /></Field>
                  <Field label="Foreclosure, minimum balance ($)"><Input name="foreclosure_min_balance" type="number" min="0" step="0.01" defaultValue={draft.foreclosure_min_balance ?? ''} /></Field>
                  <Field label="Foreclosure, minimum months delinquent"><Input name="foreclosure_min_months" type="number" min="0" max="120" defaultValue={draft.foreclosure_min_months ?? ''} /></Field>
                </div>
                <label className="mt-2 flex min-h-10 items-center gap-2 text-sm text-gray-700"><input type="checkbox" name="payment_plan_offer_required" defaultChecked={draft.payment_plan_offer_required} className="h-4 w-4 rounded border-gray-300" />A payment plan must be offered before referral</label>
                <label className="flex min-h-10 items-center gap-2 text-sm text-gray-700"><input type="checkbox" name="board_vote_required" defaultChecked={draft.board_vote_required} className="h-4 w-4 rounded border-gray-300" />The board must vote to refer</label>
                <Field label="Collection rules in plain words" required className="mt-3">
                  <Textarea name="summary" required maxLength={2000} rows={3} defaultValue={draft.summary} />
                </Field>
              </div>
              <Field label="Other state requirements" hint="Fines and hearings, budget and meeting notices, records requests, resale disclosures — one per line.">
                <Textarea name="other_rules" maxLength={10000} rows={10} defaultValue={draft.other_rules ?? ''} />
              </Field>
              <Field label="Citations" hint="One per line.">
                <Textarea name="citations" rows={3} defaultValue={(draft.citations ?? []).join('\n')} />
              </Field>
              <div className="flex flex-wrap gap-2">
                <PendingSubmit pendingLabel="Saving…">{existing ? 'Save changes' : 'Save rules'}</PendingSubmit>
                <Link href="/company-admin/state-rules"><Button type="button" variant="secondary">Cancel</Button></Link>
              </div>
            </form>
          </Surface>

          <div className="space-y-4">
            <Surface>
              <h3 className="text-sm font-semibold text-gray-950">Associations in {stateName(selected)}</h3>
              {selectedAssociations.length ? (
                <ul className="mt-2 space-y-1 text-[13px] text-gray-700">{selectedAssociations.map((name) => <li key={name}>{name}</li>)}</ul>
              ) : <p className="mt-2 text-[13px] text-gray-500">None yet.</p>}
              {existing && selectedAssociations.length > 0 && (
                <form action={applyStateRuleToAssociations} className="mt-3">
                  <input type="hidden" name="state_code" value={selected} />
                  <PendingSubmit variant="secondary" pendingLabel="Applying…" confirm={`Replace the collection settings of every ${stateName(selected)} association with these rules? Per-association changes are overwritten.`}>Apply to associations</PendingSubmit>
                  <p className="mt-2 text-[12px] leading-4 text-gray-400">New collection policies use these rules automatically. Existing ones change only when you apply.</p>
                </form>
              )}
            </Surface>
            {existing && (
              <Surface>
                <h3 className="text-sm font-semibold text-gray-950">Current collection gates</h3>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px] text-gray-700">{collectionRequirements(existing).map((r) => <li key={r}>{r}</li>)}</ul>
                <form action={deleteStateRule} className="mt-4 border-t border-gray-100 pt-4">
                  <input type="hidden" name="state_code" value={selected} />
                  <PendingSubmit variant="danger" pendingLabel="Removing…" confirm={`Remove your ${stateName(selected)} rules? The built-in profile applies again to new collection policies.`}>Remove rules</PendingSubmit>
                </form>
              </Surface>
            )}
            <p className="text-[12px] leading-4 text-gray-400">Workflow rules, not legal advice. Confirm them with association counsel and the governing documents.</p>
          </div>
        </div>
      )}
    </div>
  )
}
