import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { SurveyFields } from '@/components/surveys/survey-fields';
import { Button } from '@/components/ui/button';
import { Alert, Surface } from '@/components/ui/shell';
import { requireStaff } from '@/lib/auth/me';
import { saveSurvey } from '@/lib/rpcs/surveys';
import { createClient } from '@/lib/supabase/server';
import { fetchAllRows } from '@/lib/supabase/fetch-all';
import { questionsToText, readQuestions } from '@/lib/surveys/questions';

export const dynamic = 'force-dynamic';

export default async function EditSurveyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  await requireStaff();
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = (await createClient()) as any;

  const [{ data: survey }, { count }, associations] = await Promise.all([
    db.from('surveys').select('id, name, description, survey_type, association_id, questions').eq('id', id).is('archived_at', null).maybeSingle(),
    db.from('survey_responses').select('id', { count: 'exact', head: true }).eq('survey_id', id),
    fetchAllRows<any>(() => db.from('associations').select('id, name').is('archived_at', null).order('name').order('id')),
  ]);
  if (!survey) notFound();

  return (
    <DataWorkspace
      title={`Edit ${survey.name}`}
      description="Change who can answer, the name or the description."
      actions={<Link href={`/surveys/${id}`}><Button variant="secondary">Back to survey</Button></Link>}
    >
      <div className="max-w-3xl space-y-5">
        {sp.error && <Alert tone="danger" title="Could not save survey">{sp.error}</Alert>}
        {associations.error && <Alert tone="danger" title="Could not load associations">{associations.error}</Alert>}
        <form action={saveSurvey}>
          <input type="hidden" name="survey_id" value={id} />
          <Surface>
            <SurveyFields
              associations={associations.rows}
              questionsLocked={(count ?? 0) > 0}
              survey={{
                name: survey.name,
                description: survey.description,
                survey_type: survey.survey_type,
                association_id: survey.association_id,
                questionsText: questionsToText(readQuestions(survey.questions)),
              }}
            />
            <div className="mt-5 flex items-center justify-between border-t border-gray-100 pt-4">
              <Link href={`/surveys/${id}`} className="text-sm text-gray-600 hover:text-gray-900">Cancel</Link>
              <Button type="submit">Save survey</Button>
            </div>
          </Surface>
        </form>
      </div>
    </DataWorkspace>
  );
}
