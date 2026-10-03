'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireOwner, requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { parseQuestions, readAnswer, readQuestions } from '@/lib/surveys/questions';
import { ownerSurveyScope, scopeOwnerSurveys } from '@/lib/surveys/owner-scope';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// 'leasing' stays valid for older rows; new surveys are general or maintenance.
const TYPES = ['general', 'maintenance', 'leasing'];

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

function fail(back: string, message: string): never {
  redirect(`${back}${back.includes('?') ? '&' : '?'}error=${encodeURIComponent(message)}`);
}

/** Create a survey, or edit one. Questions are locked once anyone has answered. */
export async function saveSurvey(formData: FormData) {
  const me = await requireStaff();
  const surveyId = text(formData, 'survey_id');
  if (surveyId && !UUID.test(surveyId)) redirect('/surveys');
  const back = surveyId ? `/surveys/${surveyId}/edit` : '/surveys/new';
  const db = (await createClient()) as any;

  const name = text(formData, 'name');
  if (!name) fail(back, 'Enter a survey name.');
  if (name.length > 200) fail(back, 'Keep the survey name under 200 characters.');
  const surveyType = text(formData, 'survey_type') || 'general';
  if (!TYPES.includes(surveyType)) fail(back, 'Choose a survey type.');

  const associationId = text(formData, 'association_id');
  let portfolioId: string | null = me.portfolio?.id ?? null;
  if (associationId) {
    if (!UUID.test(associationId)) fail(back, 'Choose a valid association.');
    // RLS: only an association this staffer can see.
    const { data: assoc } = await db.from('associations').select('id, portfolio_id').eq('id', associationId).maybeSingle();
    if (!assoc) fail(back, 'That association was not found.');
    portfolioId = assoc.portfolio_id;
  }

  const { questions, error: questionError } = parseQuestions(text(formData, 'questions'));
  if (questionError) fail(back, questionError);

  const row = {
    name,
    description: text(formData, 'description') || null,
    survey_type: surveyType,
    association_id: associationId || null,
    questions,
  };

  if (surveyId) {
    const { data: current } = await db.from('surveys').select('id, portfolio_id, questions').eq('id', surveyId).is('archived_at', null).maybeSingle();
    if (!current) fail(back, 'This survey was not found.');
    if (associationId && portfolioId !== current.portfolio_id) fail(back, 'A survey cannot move to another company.');
    const { count } = await db.from('survey_responses').select('id', { count: 'exact', head: true }).eq('survey_id', surveyId);
    if ((count ?? 0) > 0 && JSON.stringify(readQuestions(current.questions)) !== JSON.stringify(questions)) {
      fail(back, 'The questions cannot change after owners have answered. Create a new survey instead.');
    }
    const { data, error } = await db.from('surveys').update(row).eq('id', surveyId).select('id').maybeSingle();
    if (error) fail(back, error.message);
    if (!data) fail(back, 'You cannot edit this survey.');
    revalidatePath(`/surveys/${surveyId}`);
    revalidatePath('/surveys');
    redirect(`/surveys/${surveyId}?saved=1`);
  }

  if (!portfolioId) fail(back, 'Surveys are saved to a company; sign in to one first.');
  const { data, error } = await db.from('surveys')
    .insert({ ...row, portfolio_id: portfolioId, active: true, created_by: me.auth_user_id })
    .select('id')
    .maybeSingle();
  if (error) fail(back, error.message);
  if (!data) fail(back, 'You cannot create surveys.');
  revalidatePath('/surveys');
  redirect(`/surveys/${data.id}?saved=created`);
}

/** Open a survey to owners, or close it. */
export async function setSurveyActive(formData: FormData) {
  await requireStaff();
  const id = text(formData, 'survey_id');
  if (!UUID.test(id)) redirect('/surveys');
  const active = text(formData, 'active') === '1';
  const db = (await createClient()) as any;
  const { data, error } = await db.from('surveys').update({ active }).eq('id', id).is('archived_at', null).select('id').maybeSingle();
  if (error) fail(`/surveys/${id}`, error.message);
  if (!data) fail(`/surveys/${id}`, 'You cannot change this survey.');
  revalidatePath(`/surveys/${id}`);
  revalidatePath('/surveys');
  redirect(`/surveys/${id}?saved=${active ? 'opened' : 'closed'}`);
}

/** Remove a survey from the list (soft delete; its responses are kept). */
export async function archiveSurvey(formData: FormData) {
  await requireStaff();
  const id = text(formData, 'survey_id');
  if (!UUID.test(id)) redirect('/surveys');
  const db = (await createClient()) as any;
  const { data, error } = await db.from('surveys')
    .update({ archived_at: new Date().toISOString(), active: false })
    .eq('id', id)
    .is('archived_at', null)
    .select('id')
    .maybeSingle();
  if (error) fail(`/surveys/${id}`, error.message);
  if (!data) fail(`/surveys/${id}`, 'You cannot remove this survey.');
  revalidatePath('/surveys');
  redirect('/surveys?removed=1');
}

/** An owner answers a survey from the portal. */
export async function submitSurveyResponse(formData: FormData) {
  const me = await requireOwner();
  const id = text(formData, 'survey_id');
  if (!UUID.test(id)) redirect('/portal/surveys');
  const back = `/portal/surveys/${id}`;
  const db = (await createClient()) as any;

  // Open surveys in the owner's company for an association they live in
  // (RLS enforces the same; repeated so another role held by the same person
  // cannot widen it).
  const scope = await ownerSurveyScope(db, me);
  const { data: survey } = await scopeOwnerSurveys(db.from('surveys').select('id, questions').eq('id', id), scope).maybeSingle();
  if (!survey) fail('/portal/surveys', 'That survey is closed or not available to you.');

  const answers: Record<string, string | number> = {};
  let rating: number | null = null;
  for (const q of readQuestions(survey.questions)) {
    const value = readAnswer(q, text(formData, `q_${q.order}`));
    if (value && typeof value === 'object') fail(back, value.error);
    if (value == null) continue;
    answers[String(q.order)] = value;
    // The first rating answer is the response's overall rating (Survey Results report).
    if (q.type === 'rating' && rating == null) rating = value as number;
  }
  if (Object.keys(answers).length === 0) fail(back, 'Answer at least one question.');

  const { data: owner } = await db.from('owners').select('full_name, email').eq('id', me.owner_id).maybeSingle();
  const { error } = await db.from('survey_responses').insert({
    survey_id: id,
    submitted_by_owner_id: me.owner_id,
    submitted_by_name: owner?.full_name ?? null,
    submitted_by_email: owner?.email ?? null,
    answers,
    rating,
    comments: text(formData, 'comments').slice(0, 4000) || null,
  });
  if (error) {
    if (error.code === '23505') fail(back, 'You have already answered this survey.');
    fail(back, error.message);
  }
  revalidatePath('/portal/surveys');
  revalidatePath(`/surveys/${id}`);
  redirect(`${back}?submitted=1`);
}
