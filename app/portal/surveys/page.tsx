import Link from 'next/link';
import { requireOwner } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { Badge } from '@/components/ui/shell';
import { readQuestions } from '@/lib/surveys/questions';
import { date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function OwnerSurveysPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const me = await requireOwner();
  const sp = await searchParams;
  const db = (await createClient()) as any;

  // Mirror the owner rule (surveys_resident_read) explicitly, so a board member
  // or staffer who is also an owner sees only what an owner would.
  const assocIds = me.resident_association_ids ?? [];
  const scope = assocIds.length ? `association_id.is.null,association_id.in.(${assocIds.join(',')})` : 'association_id.is.null';
  const [{ data: surveys, error }, { data: mine }] = await Promise.all([
    db.from('surveys')
      .select('id, name, description, questions, created_at, associations(name)')
      .eq('active', true)
      .is('archived_at', null)
      .or(scope)
      .order('created_at', { ascending: false })
      .limit(200),
    db.from('survey_responses').select('survey_id, submitted_at').eq('submitted_by_owner_id', me.owner_id),
  ]);
  const answered = new Map<string, string>(((mine ?? []) as any[]).map((r) => [r.survey_id, r.submitted_at]));
  const list = (surveys ?? []) as any[];

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950 sm:text-[26px]">Surveys</h1>
        <p className="mt-1.5 text-sm leading-6 text-gray-500">Questions from your association. Your answers go to your management team.</p>
      </div>

      {(sp.error || error) && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{sp.error ?? error?.message}</div>
      )}

      {list.length === 0 ? (
        <div className="rounded-2xl border border-gray-200/70 bg-white p-12 text-center shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <p className="text-sm text-gray-500">There are no open surveys right now.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((s) => {
            const done = answered.get(s.id);
            const count = readQuestions(s.questions).length;
            return (
              <Link
                key={s.id}
                href={`/portal/surveys/${s.id}`}
                className="block rounded-2xl border border-gray-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-colors hover:bg-gray-50"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h2 className="text-base font-semibold text-gray-950">{s.name}</h2>
                    {s.description && <p className="mt-1 line-clamp-2 text-sm text-gray-600">{s.description}</p>}
                    <p className="mt-1 text-xs text-gray-500">
                      {s.associations?.name ?? 'All associations'} · {count} question{count === 1 ? '' : 's'}
                    </p>
                  </div>
                  <span className="shrink-0">
                    {done ? <Badge tone="complete">Answered {date(done)}</Badge> : <Badge tone="open">Answer now</Badge>}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
