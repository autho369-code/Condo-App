import Link from 'next/link';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { SurveyFields } from '@/components/surveys/survey-fields';
import { Button } from '@/components/ui/button';
import { Alert, Surface } from '@/components/ui/shell';
import { requireStaff } from '@/lib/auth/me';
import { saveSurvey } from '@/lib/rpcs/surveys';
import { createClient } from '@/lib/supabase/server';
import { fetchAllRows } from '@/lib/supabase/fetch-all';

export const dynamic = 'force-dynamic';

export default async function NewSurveyPage({ searchParams }: { searchParams: Promise<{ error?: string; type?: string }> }) {
  await requireStaff();
  const sp = await searchParams;
  const db = (await createClient()) as any;
  const { rows: associations, error } = await fetchAllRows<any>(() => db.from('associations').select('id, name').is('archived_at', null).order('name').order('id'));

  return (
    <DataWorkspace
      title="New survey"
      description="Owners answer from their portal; each owner answers once."
      actions={<Link href="/surveys"><Button variant="secondary">Back to surveys</Button></Link>}
    >
      <div className="max-w-3xl space-y-5">
        {sp.error && <Alert tone="danger" title="Could not create survey">{sp.error}</Alert>}
        {error && <Alert tone="danger" title="Could not load associations">{error}</Alert>}
        <form action={saveSurvey}>
          <Surface>
            <SurveyFields
              associations={associations}
              survey={sp.type === 'maintenance' ? { name: '', description: null, survey_type: 'maintenance', association_id: null, questionsText: '' } : undefined}
            />
            <div className="mt-5 flex items-center justify-between border-t border-gray-100 pt-4">
              <Link href="/surveys" className="text-sm text-gray-600 hover:text-gray-900">Cancel</Link>
              <Button type="submit">Create survey</Button>
            </div>
          </Surface>
        </form>
      </div>
    </DataWorkspace>
  );
}
