'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requirePortfolioAdmin } from '@/lib/auth/me'
import { US_STATES, stateCodeOf, stateName } from '@/lib/state-rules'

const STATE_CODES = new Set(US_STATES.map((s) => s.code))

function back(state: string | null, key: 'error' | 'saved', message: string): never {
  revalidatePath('/company-admin/state-rules')
  const qs = new URLSearchParams()
  if (state) qs.set('state', state)
  qs.set(key, message)
  redirect(`/company-admin/state-rules?${qs.toString()}`)
}

const text = (fd: FormData, key: string) => String(fd.get(key) ?? '').trim()

function optionalInt(raw: string, min: number, max: number, label: string, state: string): number | null {
  if (raw === '') return null
  const n = Number(raw)
  if (!Number.isInteger(n) || n < min || n > max) back(state, 'error', `${label} must be a whole number from ${min} to ${max}.`)
  return n
}

/** The state code from the form, checked against the 50 states + DC. */
function stateFrom(fd: FormData): string {
  const code = text(fd, 'state_code').toUpperCase()
  if (!STATE_CODES.has(code)) back(null, 'error', 'Choose a state.')
  return code
}

export async function saveStateRule(formData: FormData) {
  const me = await requirePortfolioAdmin()
  const portfolioId = me.portfolio?.id
  if (!portfolioId) back(null, 'error', 'Your account is not linked to a company.')
  const state = stateFrom(formData)

  const noticeDays = optionalInt(text(formData, 'pre_referral_notice_days'), 0, 180, 'Notice days', state)
  if (noticeDays == null) back(state, 'error', 'Enter the notice days (0 to 180).')
  const noticeMethod = text(formData, 'notice_method')
  if (!['certified_mail', 'first_class'].includes(noticeMethod)) back(state, 'error', 'Choose how the notice is sent.')
  const planMonths = optionalInt(text(formData, 'payment_plan_min_months'), 1, 60, 'Payment plan months', state)
  const fcMonths = optionalInt(text(formData, 'foreclosure_min_months'), 0, 120, 'Foreclosure months', state)
  const fcBalanceRaw = text(formData, 'foreclosure_min_balance')
  const fcBalance = fcBalanceRaw === '' ? null : Number(fcBalanceRaw)
  if (fcBalance != null && (!Number.isFinite(fcBalance) || fcBalance < 0)) back(state, 'error', 'Foreclosure minimum balance must be zero or more.')
  const summary = text(formData, 'summary')
  if (!summary) back(state, 'error', 'Describe the collection rules in plain words.')
  if (summary.length > 2000) back(state, 'error', 'The collection summary can be at most 2,000 characters.')
  const otherRules = text(formData, 'other_rules')
  if (otherRules.length > 10000) back(state, 'error', 'Other state requirements can be at most 10,000 characters.')
  const citations = text(formData, 'citations').split(/\r?\n/).map((c) => c.trim()).filter(Boolean)
  if (citations.length > 30) back(state, 'error', 'List at most 30 citations.')

  const db = (await createClient()) as any
  // The company is always the caller's own; RLS (can_admin_portfolio) checks it again.
  const { data, error } = await db.from('company_state_rules').upsert({
    portfolio_id: portfolioId,
    state_code: state,
    pre_referral_notice_days: noticeDays,
    notice_method: noticeMethod,
    payment_plan_offer_required: formData.get('payment_plan_offer_required') === 'on',
    payment_plan_min_months: planMonths,
    board_vote_required: formData.get('board_vote_required') === 'on',
    foreclosure_min_balance: fcBalance,
    foreclosure_min_months: fcMonths,
    summary,
    other_rules: otherRules || null,
    citations,
  }, { onConflict: 'portfolio_id,state_code' }).select('id')
  if (error) back(state, 'error', `${stateName(state)} rules not saved: ${error.message}`)
  if (!data?.length) back(state, 'error', `${stateName(state)} rules not saved: you do not have access to change them.`)
  revalidatePath('/delinquencies')
  back(state, 'saved', `${stateName(state)} rules saved. Use "Apply to associations" to update collection policies already set up.`)
}

export async function deleteStateRule(formData: FormData) {
  const me = await requirePortfolioAdmin()
  const portfolioId = me.portfolio?.id
  if (!portfolioId) back(null, 'error', 'Your account is not linked to a company.')
  const state = stateFrom(formData)
  const db = (await createClient()) as any
  const { data, error } = await db.from('company_state_rules').delete()
    .eq('portfolio_id', portfolioId).eq('state_code', state).select('id')
  if (error) back(state, 'error', `${stateName(state)} rules not removed: ${error.message}`)
  if (!data?.length) back(state, 'error', `${stateName(state)} rules not removed: they were not found or you do not have access.`)
  revalidatePath('/delinquencies')
  back(null, 'saved', `${stateName(state)} rules removed. Associations there keep their current collection settings until a rule is applied again.`)
}

/** Re-applies the state's rules to the collection policy of every association of the company in that state. */
export async function applyStateRuleToAssociations(formData: FormData) {
  const me = await requirePortfolioAdmin()
  const portfolioId = me.portfolio?.id
  if (!portfolioId) back(null, 'error', 'Your account is not linked to a company.')
  const state = stateFrom(formData)
  const db = (await createClient()) as any

  const { data: associations, error } = await db.from('associations').select('id, name, state')
    .eq('portfolio_id', portfolioId).is('archived_at', null)
  if (error) back(state, 'error', `Associations could not be loaded: ${error.message}`)
  const inState = (associations ?? []).filter((a: any) => stateCodeOf(a.state) === state)
  if (!inState.length) back(state, 'error', `None of your associations is in ${stateName(state)}.`)

  const { data: policies, error: policiesError } = await db.from('delinquency_policies').select('association_id')
    .in('association_id', inState.map((a: any) => a.id))
  if (policiesError) back(state, 'error', `Collection policies could not be loaded: ${policiesError.message}`)
  const withPolicy = new Set((policies ?? []).map((p: any) => p.association_id))

  const applied: string[] = []
  const failed: string[] = []
  for (const association of inState) {
    if (!withPolicy.has(association.id)) continue
    const { error: applyError } = await db.rpc('apply_delinquency_jurisdiction', { p_association_id: association.id, p_state_code: state })
    if (applyError) failed.push(`${association.name}: ${applyError.message}`)
    else applied.push(association.name)
  }
  const skipped = inState.length - withPolicy.size
  revalidatePath('/delinquencies')
  if (failed.length) back(state, 'error', `Applied to ${applied.length}; not applied to ${failed.join('; ')}`)
  back(state, 'saved', `Applied to ${applied.length} association${applied.length === 1 ? '' : 's'}${skipped ? `; ${skipped} without a collection policy yet (it uses these rules when it is set up)` : ''}.`)
}
