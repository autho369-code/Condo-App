'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { requireWorkspaceStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';

const text = (formData: FormData, key: string) => String(formData.get(key) ?? '').trim();

function numberValue(formData: FormData, key: string, fallback = 0) {
  const raw = text(formData, key);
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function failTo(path: string, message: string): never {
  redirect(`${path}${path.includes('?') ? '&' : '?'}error=${encodeURIComponent(message)}`);
}

function requirePortfolioId(me: Awaited<ReturnType<typeof requireWorkspaceStaff>>, path: string) {
  const portfolioId = me.portfolio?.id;
  if (!portfolioId) failTo(path, 'A portfolio is required for reserve planning.');
  return portfolioId;
}

async function scopedStudy(studyId: string, path: string) {
  const me = await requireWorkspaceStaff();
  const portfolioId = requirePortfolioId(me, path);
  const supabase = await createClient();
  const { data: study, error } = await (supabase as any)
    .from('reserve_studies')
    .select('id, portfolio_id, association_id, status')
    .eq('id', studyId)
    .eq('portfolio_id', portfolioId)
    .maybeSingle();

  if (error || !study) failTo(path, error?.message ?? 'Reserve study not found.');
  return { me, portfolioId, supabase, study };
}

export async function createReserveStudy(formData: FormData) {
  const me = await requireWorkspaceStaff();
  const portfolioId = requirePortfolioId(me, '/capital-reserves/new');
  const supabase = await createClient();
  const associationId = text(formData, 'association_id');
  const name = text(formData, 'name');
  const baseYear = numberValue(formData, 'base_year', new Date().getFullYear());
  const horizonYears = numberValue(formData, 'horizon_years', 30);
  const openingBalance = numberValue(formData, 'opening_balance');
  const annualContribution = numberValue(formData, 'annual_contribution');
  const contributionGrowth = numberValue(formData, 'annual_contribution_growth_rate');
  const inflationRate = numberValue(formData, 'annual_inflation_rate', 3);
  const interestRate = numberValue(formData, 'annual_interest_rate', 1);

  if (!associationId || !name) failTo('/capital-reserves/new', 'Association and study name are required.');
  if ([baseYear, horizonYears, openingBalance, annualContribution, contributionGrowth, inflationRate, interestRate].some(Number.isNaN)) {
    failTo('/capital-reserves/new', 'Reserve assumptions must be valid numbers.');
  }
  if (horizonYears < 1 || horizonYears > 50) failTo('/capital-reserves/new', 'Projection horizon must be between 1 and 50 years.');

  const { data: association, error: associationError } = await (supabase as any)
    .from('associations')
    .select('id')
    .eq('id', associationId)
    .eq('portfolio_id', portfolioId)
    .is('archived_at', null)
    .maybeSingle();
  if (associationError || !association) failTo('/capital-reserves/new', 'That association is outside your portfolio or unavailable.');

  const { data: study, error: studyError } = await (supabase as any)
    .from('reserve_studies')
    .insert({
      portfolio_id: portfolioId,
      association_id: associationId,
      name,
      study_date: text(formData, 'study_date') || new Date().toISOString().slice(0, 10),
      base_year: baseYear,
      horizon_years: horizonYears,
      opening_balance: openingBalance,
      annual_contribution: annualContribution,
      annual_contribution_growth_rate: contributionGrowth,
      annual_inflation_rate: inflationRate,
      annual_interest_rate: interestRate,
      funding_goal: text(formData, 'funding_goal') || 'threshold',
      prepared_by: text(formData, 'prepared_by') || null,
      notes: text(formData, 'notes') || null,
      created_by: me.auth_user_id,
    })
    .select('id')
    .single();

  if (studyError || !study) failTo('/capital-reserves/new', studyError?.message ?? 'Could not create the reserve study.');

  const { error: scenarioError } = await (supabase as any)
    .from('reserve_funding_scenarios')
    .insert({
      study_id: study.id,
      portfolio_id: portfolioId,
      association_id: associationId,
      name: 'Current funding plan',
      opening_balance: openingBalance,
      annual_contribution: annualContribution,
      annual_contribution_growth_rate: contributionGrowth,
      annual_interest_rate: interestRate,
      is_baseline: true,
      created_by: me.auth_user_id,
    });

  if (scenarioError) {
    await (supabase as any).from('reserve_studies').delete().eq('id', study.id).eq('portfolio_id', portfolioId);
    failTo('/capital-reserves/new', scenarioError.message ?? 'Could not create the baseline funding plan.');
  }

  redirect(`/capital-reserves/${study.id}?created=1`);
}

export async function addReserveComponent(studyId: string, formData: FormData) {
  const path = `/capital-reserves/${studyId}`;
  const { me, portfolioId, supabase, study } = await scopedStudy(studyId, path);
  const name = text(formData, 'name');
  const usefulLife = numberValue(formData, 'useful_life_years');
  const remainingLife = numberValue(formData, 'remaining_life_years');
  const currentAge = numberValue(formData, 'current_age_years');
  const replacementCost = numberValue(formData, 'current_replacement_cost');
  const quantity = numberValue(formData, 'quantity', 1);
  const fixedAssetId = text(formData, 'fixed_asset_id') || null;

  if (!name || usefulLife <= 0 || remainingLife < 0 || replacementCost < 0 || quantity <= 0) {
    failTo(path, 'Component name, useful life, remaining life, quantity, and replacement cost must be valid.');
  }

  if (fixedAssetId) {
    const { data: asset } = await (supabase as any)
      .from('fixed_assets')
      .select('id')
      .eq('id', fixedAssetId)
      .eq('portfolio_id', portfolioId)
      .eq('association_id', study.association_id)
      .maybeSingle();
    if (!asset) failTo(path, 'The linked fixed asset is outside this association.');
  }

  const inflationRaw = text(formData, 'inflation_rate');
  const conditionRaw = text(formData, 'condition_score');
  const { error } = await (supabase as any).from('reserve_components').insert({
    study_id: studyId,
    portfolio_id: portfolioId,
    association_id: study.association_id,
    fixed_asset_id: fixedAssetId,
    name,
    category: text(formData, 'category') || 'building_envelope',
    quantity,
    unit: text(formData, 'unit') || 'each',
    current_age_years: currentAge,
    useful_life_years: usefulLife,
    remaining_life_years: remainingLife,
    current_replacement_cost: replacementCost,
    inflation_rate: inflationRaw ? Number(inflationRaw) : null,
    condition_score: conditionRaw ? Number(conditionRaw) : null,
    priority: text(formData, 'priority') || 'standard',
    last_inspected_at: text(formData, 'last_inspected_at') || null,
    notes: text(formData, 'notes') || null,
    created_by: me.auth_user_id,
  });

  if (error) failTo(path, error.message);
  revalidatePath(path);
  redirect(`${path}?component_added=1`);
}

export async function addFundingScenario(studyId: string, formData: FormData) {
  const path = `/capital-reserves/${studyId}`;
  const { me, portfolioId, supabase, study } = await scopedStudy(studyId, path);
  const name = text(formData, 'name');
  const openingBalance = numberValue(formData, 'opening_balance');
  const annualContribution = numberValue(formData, 'annual_contribution');
  const contributionGrowth = numberValue(formData, 'annual_contribution_growth_rate');
  const interestRate = numberValue(formData, 'annual_interest_rate');
  const assessmentYear = numberValue(formData, 'special_assessment_year');
  const assessmentAmount = numberValue(formData, 'special_assessment_amount');

  if (!name || [openingBalance, annualContribution, contributionGrowth, interestRate, assessmentYear, assessmentAmount].some(Number.isNaN)) {
    failTo(path, 'Scenario name and numeric assumptions are required.');
  }

  const specialAssessments = assessmentAmount > 0
    ? [{ year: Math.max(1, Math.floor(assessmentYear)), amount: assessmentAmount, label: 'Planned special assessment' }]
    : [];

  const { error } = await (supabase as any).from('reserve_funding_scenarios').insert({
    study_id: studyId,
    portfolio_id: portfolioId,
    association_id: study.association_id,
    name,
    opening_balance: openingBalance,
    annual_contribution: annualContribution,
    annual_contribution_growth_rate: contributionGrowth,
    annual_interest_rate: interestRate,
    special_assessments: specialAssessments,
    is_baseline: false,
    notes: text(formData, 'notes') || null,
    created_by: me.auth_user_id,
  });

  if (error) failTo(path, error.message);
  revalidatePath(path);
  redirect(`${path}?scenario_added=1`);
}

export async function changeReserveStudyStatus(studyId: string, nextStatus: string) {
  const path = `/capital-reserves/${studyId}`;
  const allowed = new Set(['draft', 'board_review', 'approved', 'superseded']);
  if (!allowed.has(nextStatus)) failTo(path, 'Invalid reserve study status.');

  const me = await requireWorkspaceStaff();
  const portfolioId = me.portfolio?.id;
  if (!portfolioId) failTo(path, 'A portfolio is required for reserve planning.');
  const supabase = await createClient();
  if (nextStatus === 'approved') {
    const { count, error: componentError } = await (supabase as any)
      .from('reserve_components')
      .select('id', { count: 'exact', head: true })
      .eq('study_id', studyId)
      .eq('portfolio_id', portfolioId);
    if (componentError) failTo(path, componentError.message);
    if (!count) failTo(path, 'Add at least one reserve component before approving this study.');
  }
  const patch = nextStatus === 'approved'
    ? { status: nextStatus, approved_at: new Date().toISOString(), approved_by: me.auth_user_id }
    : nextStatus === 'superseded'
      ? { status: nextStatus }
      : { status: nextStatus, approved_at: null, approved_by: null };
  const { data, error } = await (supabase as any)
    .from('reserve_studies')
    .update(patch)
    .eq('id', studyId)
    .eq('portfolio_id', portfolioId)
    .select('id')
    .maybeSingle();

  if (error || !data) failTo(path, error?.message ?? 'Reserve study not found.');
  revalidatePath(path);
  revalidatePath('/capital-reserves');
  redirect(`${path}?status_updated=1`);
}
