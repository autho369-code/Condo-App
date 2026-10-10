import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { MetricStrip } from '@/components/operations/metric-strip';
import { StatusChip } from '@/components/operations/status-chip';
import { Button } from '@/components/ui/button';
import { Alert, SectionTitle, Surface } from '@/components/ui/shell';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { requireStaff } from '@/lib/auth/me';
import { archiveSurvey, setSurveyActive } from '@/lib/rpcs/surveys';
import { createClient } from '@/lib/supabase/server';
import { fetchAllRows } from '@/lib/supabase/fetch-all';
import { QUESTION_TYPE_LABEL, readQuestions, type SurveyQuestion } from '@/lib/surveys/questions';
import { date } from '@/lib/utils';
import { PendingSubmit } from '@/components/ui/pending-submit';

export const dynamic = 'force-dynamic';

const SAVED: Record<string, string> = {
  created: 'Survey created and open to owners.',
  '1': 'Survey saved.',
  opened: 'Survey opened. Owners can answer it in their portal.',
  closed: 'Survey closed. Owners can no longer answer it.',
};

function answerText(q: SurveyQuestion, v: unknown) {
  if (v == null || v === '') return '—';
  if (q.type === 'yes_no') return v === 'yes' ? 'Yes' : 'No';
  if (q.type === 'rating') return `${v} of 5`;
  return String(v);
}

export default async function SurveyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const me = await requireStaff();
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = (await createClient()) as any;

  const { data: survey } = await db
    .from('surveys')
    .select('id, name, description, survey_type, active, archived_at, created_at, association_id, questions, associations(name)')
    .eq('id', id)
    .maybeSingle();
  if (!survey) notFound();
  const removed = !!survey.archived_at;
  const canEdit = me.is_staff && !removed;
  const questions = readQuestions(survey.questions);

  const responses = await fetchAllRows<any>(() => db
    .from('survey_responses')
    .select('id, submitted_by_name, submitted_by_email, answers, rating, comments, submitted_at')
    .eq('survey_id', id)
    .order('submitted_at', { ascending: false })
    .order('id'), { maxRows: 20000 });
  const rows = responses.rows;
  const partial = responses.truncated || !!responses.error;

  const results = questions.map((q) => {
    const values = rows.map((r) => (r.answers ?? {})[String(q.order)]).filter((v) => v != null && v !== '');
    const tally = new Map<string, number>();
    for (const v of values) tally.set(String(v), (tally.get(String(v)) ?? 0) + 1);
    const ratings = q.type === 'rating' ? values.map(Number).filter((n) => n >= 1 && n <= 5) : [];
    return {
      q,
      answered: values.length,
      average: ratings.length ? ratings.reduce((s, n) => s + n, 0) / ratings.length : null,
      buckets: q.type === 'rating'
        ? [5, 4, 3, 2, 1].map((n) => ({ label: `${n} of 5`, count: tally.get(String(n)) ?? 0 }))
        : q.type === 'yes_no'
          ? [{ label: 'Yes', count: tally.get('yes') ?? 0 }, { label: 'No', count: tally.get('no') ?? 0 }]
          : q.type === 'choice'
            ? (q.options ?? []).map((o) => ({ label: o, count: tally.get(o) ?? 0 }))
            : [],
      written: q.type === 'text' ? values.map(String).slice(0, 200) : [],
    };
  });
  const lastResponse = rows[0]?.submitted_at ?? null;

  return (
    <DataWorkspace
      title={survey.name}
      description={survey.description || `${survey.associations?.name ?? 'Every association'} · ${questions.length} question${questions.length === 1 ? '' : 's'}`}
      actions={
        <>
          <Link href="/surveys"><Button variant="secondary">Back to surveys</Button></Link>
          {canEdit && <Link href={`/surveys/${id}/edit`}><Button variant="secondary">Edit</Button></Link>}
          {canEdit && (
            <form action={setSurveyActive}>
              <input type="hidden" name="survey_id" value={id} />
              <input type="hidden" name="active" value={survey.active ? '0' : '1'} />
              <Button type="submit">{survey.active ? 'Close survey' : 'Open survey'}</Button>
            </form>
          )}
        </>
      }
    >
      <div className="space-y-4">
        {removed && <Alert tone="info" title="Removed">This survey was removed from the list. Its responses are kept here.</Alert>}
        {sp.error && <Alert tone="danger" title="Something went wrong">{sp.error}</Alert>}
        {sp.saved && SAVED[sp.saved] && <Alert tone="success">{SAVED[sp.saved]}</Alert>}
        {partial && <Alert tone="warning" title="Results are incomplete">{responses.error ?? 'There are more responses than this page can load.'}</Alert>}

        <MetricStrip
          metrics={[
            { label: 'Status', value: removed ? 'Removed' : survey.active ? 'Open' : 'Closed' },
            { label: 'Responses', value: partial ? '—' : rows.length.toLocaleString() },
            { label: 'Last response', value: lastResponse ? date(lastResponse) : '—' },
            { label: 'Who can answer', value: survey.associations?.name ?? 'Every association' },
          ]}
        />

        {questions.length === 0 ? (
          <Surface><p className="text-sm text-gray-500">This survey has no questions.</p></Surface>
        ) : results.map(({ q, answered, average, buckets, written }) => (
          <Surface key={q.order}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <SectionTitle title={`${q.order}. ${q.text}`} description={`${QUESTION_TYPE_LABEL[q.type]} · ${answered} answered`} />
              {average != null && <StatusChip tone="info">Average {average.toFixed(1)} of 5</StatusChip>}
            </div>
            {buckets.length > 0 && (
              <Table>
                <THead>
                  <TR>
                    <TH>Answer</TH>
                    <TH className="text-right">Responses</TH>
                    <TH className="text-right">Share</TH>
                  </TR>
                </THead>
                <tbody>
                  {buckets.map((b) => (
                    <TR key={b.label}>
                      <TD>{b.label}</TD>
                      <TD className="text-right tabular-nums">{b.count}</TD>
                      <TD className="text-right tabular-nums">{answered ? `${Math.round((b.count / answered) * 100)}%` : '—'}</TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            )}
            {q.type === 'text' && (
              written.length === 0
                ? <p className="text-sm text-gray-500">No written answers yet.</p>
                : <ul className="space-y-2">{written.map((w, i) => <li key={i} className="whitespace-pre-wrap rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-800">{w}</li>)}</ul>
            )}
          </Surface>
        ))}

        <Surface padded={false}>
          <div className="px-5 pt-5"><SectionTitle title="Responses" description="Each owner's answers, newest first." /></div>
          {rows.length === 0 ? (
            <p className="px-5 pb-6 pt-2 text-sm text-gray-500">No responses yet.{survey.active ? ' Owners see this survey in their portal under Surveys.' : ''}</p>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Submitted</TH>
                  <TH>Owner</TH>
                  {questions.map((q) => <TH key={q.order}>{q.order}. {q.text.length > 40 ? `${q.text.slice(0, 40)}…` : q.text}</TH>)}
                  <TH>Comments</TH>
                </TR>
              </THead>
              <tbody>
                {rows.map((r) => (
                  <TR key={r.id}>
                    <TD className="whitespace-nowrap text-sm text-gray-600">{date(r.submitted_at)}</TD>
                    <TD className="text-sm text-gray-900">
                      {r.submitted_by_name ?? '—'}
                      {r.submitted_by_email && <div className="text-[13px] text-gray-500">{r.submitted_by_email}</div>}
                    </TD>
                    {questions.map((q) => <TD key={q.order} className="text-sm text-gray-700">{answerText(q, (r.answers ?? {})[String(q.order)])}</TD>)}
                    <TD className="text-sm text-gray-600">{r.comments ?? '—'}</TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          )}
        </Surface>

        <div className="flex flex-wrap items-center gap-3">
          <Link href="/reports/survey_results" className="text-sm font-medium text-gray-600 underline decoration-gray-300 underline-offset-4 hover:text-gray-950">Survey Results report</Link>
          {canEdit && (
            <form action={archiveSurvey}>
              <input type="hidden" name="survey_id" value={id} />
              <PendingSubmit variant="secondary" size="sm" pendingLabel="Removing…" confirm="Remove this survey?">Remove survey</PendingSubmit>
            </form>
          )}
        </div>
      </div>
    </DataWorkspace>
  );
}
