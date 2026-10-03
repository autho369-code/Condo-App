import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireOwner } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { Card, CardBody } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Field, Select, Textarea } from '@/components/ui/input';
import { submitSurveyResponse } from '@/lib/rpcs/surveys';
import { readQuestions, type SurveyQuestion } from '@/lib/surveys/questions';
import { ownerSurveyScope, scopeOwnerSurveys } from '@/lib/surveys/owner-scope';
import { date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

function shown(q: SurveyQuestion, v: unknown) {
  if (v == null || v === '') return 'Not answered';
  if (q.type === 'yes_no') return v === 'yes' ? 'Yes' : 'No';
  if (q.type === 'rating') return `${v} of 5`;
  return String(v);
}

export default async function OwnerSurveyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; submitted?: string }>;
}) {
  const me = await requireOwner();
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = (await createClient()) as any;

  // Same scope as the survey list.
  const scope = await ownerSurveyScope(db, me);
  const [{ data: survey }, { data: mine }] = await Promise.all([
    scopeOwnerSurveys(db.from('surveys').select('id, name, description, questions, associations(name)').eq('id', id), scope).maybeSingle(),
    db.from('survey_responses').select('answers, comments, submitted_at')
      .eq('survey_id', id).eq('submitted_by_owner_id', me.owner_id).is('work_order_id', null).maybeSingle(),
  ]);
  if (!survey) notFound();
  const questions = readQuestions(survey.questions);

  return (
    <div className="max-w-3xl space-y-6">
      <div className="text-sm text-gray-500">
        <Link href="/portal/surveys" className="hover:text-gray-950 hover:underline">← Back to surveys</Link>
      </div>
      <div>
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950 sm:text-[26px]">{survey.name}</h1>
        <p className="mt-1 text-xs text-gray-500">{survey.associations?.name ?? 'All associations'}</p>
        {survey.description && <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-600">{survey.description}</p>}
      </div>

      {sp.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{sp.error}</div>
      )}
      {sp.submitted && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800" role="status">Thank you. Your answers were sent.</div>
      )}

      {mine ? (
        <Card>
          <CardBody>
            <p className="mb-4 text-sm text-gray-600">You answered this survey on {date(mine.submitted_at)}.</p>
            <dl className="space-y-3">
              {questions.map((q) => (
                <div key={q.order}>
                  <dt className="text-sm font-medium text-gray-900">{q.order}. {q.text}</dt>
                  <dd className="mt-0.5 whitespace-pre-wrap text-sm text-gray-700">{shown(q, (mine.answers ?? {})[String(q.order)])}</dd>
                </div>
              ))}
              {mine.comments && (
                <div>
                  <dt className="text-sm font-medium text-gray-900">Comments</dt>
                  <dd className="mt-0.5 whitespace-pre-wrap text-sm text-gray-700">{mine.comments}</dd>
                </div>
              )}
            </dl>
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardBody>
            <form action={submitSurveyResponse} className="space-y-5">
              <input type="hidden" name="survey_id" value={survey.id} />
              {questions.map((q) => {
                const name = `q_${q.order}`;
                const label = `${q.order}. ${q.text}`;
                if (q.type === 'rating') {
                  return (
                    <fieldset key={q.order}>
                      <legend className="text-sm font-medium text-gray-900">{label}</legend>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <label key={n} className="flex h-10 min-w-10 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-gray-300 px-3 text-sm text-gray-800 has-[:checked]:border-gray-950 has-[:checked]:bg-gray-950 has-[:checked]:text-white">
                            <input type="radio" name={name} value={n} className="sr-only" />
                            {n}
                          </label>
                        ))}
                      </div>
                      <p className="mt-1 text-xs text-gray-500">1 = poor, 5 = excellent</p>
                    </fieldset>
                  );
                }
                if (q.type === 'yes_no') {
                  return (
                    <fieldset key={q.order}>
                      <legend className="text-sm font-medium text-gray-900">{label}</legend>
                      <div className="mt-2 flex gap-2">
                        {[['yes', 'Yes'], ['no', 'No']].map(([v, l]) => (
                          <label key={v} className="flex h-10 cursor-pointer items-center rounded-lg border border-gray-300 px-4 text-sm text-gray-800 has-[:checked]:border-gray-950 has-[:checked]:bg-gray-950 has-[:checked]:text-white">
                            <input type="radio" name={name} value={v} className="sr-only" />
                            {l}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  );
                }
                if (q.type === 'choice') {
                  return (
                    <Field key={q.order} label={label} htmlFor={name}>
                      <Select id={name} name={name} defaultValue="">
                        <option value="">Choose…</option>
                        {(q.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
                      </Select>
                    </Field>
                  );
                }
                return (
                  <Field key={q.order} label={label} htmlFor={name}>
                    <Textarea id={name} name={name} rows={3} maxLength={4000} />
                  </Field>
                );
              })}
              <Field label="Anything else? (optional)" htmlFor="comments">
                <Textarea id="comments" name="comments" rows={3} maxLength={4000} />
              </Field>
              <div className="flex items-center justify-between border-t border-gray-100 pt-4">
                <Link href="/portal/surveys" className="text-sm text-gray-600 hover:text-gray-900">Cancel</Link>
                <Button type="submit">Send answers</Button>
              </div>
            </form>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
