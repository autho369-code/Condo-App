import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { QUESTION_HELP } from '@/lib/surveys/questions';

type Option = { id: string; name: string };

/** Fields shared by New survey and Edit survey. */
export function SurveyFields({
  associations,
  survey,
  questionsLocked,
}: {
  associations: Option[];
  survey?: { name: string; description: string | null; survey_type: string; association_id: string | null; questionsText: string };
  questionsLocked?: boolean;
}) {
  const s = survey;
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label="Survey name" htmlFor="name">
        <Input id="name" name="name" required maxLength={200} defaultValue={s?.name ?? ''} placeholder="e.g. Annual owner satisfaction" />
      </Field>
      <Field label="Type" htmlFor="survey_type">
        <Select id="survey_type" name="survey_type" defaultValue={s?.survey_type ?? 'general'}>
          <option value="general">General</option>
          <option value="maintenance">Maintenance</option>
          {s?.survey_type === 'leasing' && <option value="leasing">Leasing</option>}
        </Select>
      </Field>
      <div className="sm:col-span-2">
        <Field label="Who can answer" htmlFor="association_id" hint="Owners of the chosen association, or of every association.">
          <Select id="association_id" name="association_id" defaultValue={s?.association_id ?? ''}>
            <option value="">Owners in every association</option>
            {associations.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field label="Description" htmlFor="description" hint="Shown to owners above the questions.">
          <Textarea id="description" name="description" rows={3} defaultValue={s?.description ?? ''} />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field
          label="Questions"
          htmlFor="questions"
          hint={questionsLocked ? 'Owners have answered, so the questions can no longer change.' : 'One question per line. Start a line with Rating:, Yes/No: or Choice: to pick its type.'}
        >
          <Textarea
            id="questions"
            name="questions"
            required
            rows={8}
            readOnly={questionsLocked}
            defaultValue={s?.questionsText ?? ''}
            placeholder={QUESTION_HELP.join('\n')}
            className="font-mono"
          />
        </Field>
      </div>
    </div>
  );
}
