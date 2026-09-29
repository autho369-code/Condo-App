import { Section } from '@/components/workspace/shell';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/input';
import { Alert, Badge } from '@/components/ui/shell';
import { BOARD_REPORT_SECTIONS, DEFAULT_BOARD_SECTIONS, previousMonth } from '@/lib/reports/board-package';
import { publishBoardReportNow, saveBoardReportSettings } from '@/lib/rpcs/board-reports';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { isScopedStoragePath } from '@/lib/security/storage-paths';
import { date } from '@/lib/utils';

export async function BoardReportsSection({
  associationId,
  associationRef,
  error,
  saved,
}: {
  associationId: string;
  associationRef: string;
  error?: string;
  saved?: string;
}) {
  const db = (await createClient()) as any;
  const [{ data: settings }, { data: published }, { count: boardEmails }] = await Promise.all([
    db.from('association_board_report_settings').select('sections, share_scope, auto_publish, publish_day, notify_board, updated_at').eq('association_id', associationId).maybeSingle(),
    db.from('documents').select('id, file_name, file_url, uploaded_at, share_scope, description')
      .eq('entity_type', 'association').eq('entity_id', associationId).eq('doc_type', 'board_report')
      .order('uploaded_at', { ascending: false }).limit(12),
    db.from('board_members').select('id', { count: 'exact', head: true }).eq('association_id', associationId).eq('active', true).not('email', 'is', null),
  ]);

  const selected = new Set<string>(settings?.sections ?? DEFAULT_BOARD_SECTIONS);
  const period = previousMonth();
  const links = new Map<string, string>();
  const toSign = ((published ?? []) as any[]).filter((d) => isScopedStoragePath(d.file_url, 'associations', associationId));
  if (toSign.length) {
    try {
      const { data: signed } = await (createServiceClient() as any).storage.from('association-documents').createSignedUrls(toSign.map((d) => d.file_url), 3600);
      const byPath = new Map<string, string>((signed ?? []).filter((x: any) => x?.signedUrl).map((x: any) => [x.path, x.signedUrl]));
      for (const d of toSign) { const u = byPath.get(d.file_url); if (u) links.set(d.id, u); }
    } catch {}
  }
  const hidden = (
    <>
      <input type="hidden" name="association_id" value={associationId} />
      <input type="hidden" name="association_ref" value={associationRef} />
    </>
  );

  return (
    <div id="board-reports">
      <Section
        title="Board reports"
        subtitle="The statements the board receives each month. Published packages appear in the board portal under Reports and Documents."
        padded
      >
        {error && <Alert tone="danger" className="mb-4">{error}</Alert>}
        {saved && <Alert tone="success" className="mb-4">{saved}</Alert>}

        <form action={saveBoardReportSettings} className="space-y-4">
          {hidden}
          <fieldset>
            <legend className="mb-2 text-[13px] font-medium text-gray-700">Include in the package</legend>
            <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
              {BOARD_REPORT_SECTIONS.map(([key, label]) => (
                <label key={key} className="flex min-h-10 items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" name="sections" value={key} defaultChecked={selected.has(key)} className="h-4 w-4 rounded border-gray-300" />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Who can see packages" htmlFor="br-scope">
              <Select id="br-scope" name="share_scope" defaultValue={settings?.share_scope ?? 'board'}>
                <option value="board">Board only</option>
                <option value="owners">Board and owners</option>
              </Select>
            </Field>
            <Field label="Publish on day of month" htmlFor="br-day" hint="Last month’s package, once the books are in.">
              <Input id="br-day" name="publish_day" type="number" min={1} max={28} defaultValue={settings?.publish_day ?? 10} />
            </Field>
            <div className="space-y-1 pt-1 sm:pt-6">
              <label className="flex min-h-10 items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" name="auto_publish" defaultChecked={settings?.auto_publish ?? false} className="h-4 w-4 rounded border-gray-300" />
                Publish automatically
              </label>
              <label className="flex min-h-10 items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" name="notify_board" defaultChecked={settings?.notify_board ?? true} className="h-4 w-4 rounded border-gray-300" />
                Email board members
              </label>
            </div>
          </div>
          <Button type="submit" variant="secondary">Save board report settings</Button>
        </form>

        <div className="mt-5 border-t border-gray-100 pt-4">
          <h3 className="text-sm font-semibold text-gray-900">Publish now</h3>
          {!settings ? (
            <p className="mt-1 text-[13px] text-gray-500">Save the settings above first.</p>
          ) : (
            <form action={publishBoardReportNow} className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-4 sm:items-end">
              {hidden}
              <Field label="From" htmlFor="br-from"><Input id="br-from" name="date_from" type="date" required defaultValue={period.from} /></Field>
              <Field label="To" htmlFor="br-to"><Input id="br-to" name="date_to" type="date" required defaultValue={period.to} /></Field>
              <label className="flex min-h-10 items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" name="notify" defaultChecked={settings.notify_board} disabled={!settings.notify_board} className="h-4 w-4 rounded border-gray-300" />
                Email {boardEmails ?? 0} board member{boardEmails === 1 ? '' : 's'}
              </label>
              <Button type="submit">Publish to board portal</Button>
            </form>
          )}
          <p className="mt-2 text-[12px] text-gray-500">Publishing the same period again replaces that package; board members are only emailed once per period.</p>
        </div>

        {(published ?? []).length > 0 && (
          <div className="mt-5 border-t border-gray-100 pt-4">
            <h3 className="mb-2 text-sm font-semibold text-gray-900">Published</h3>
            <ul className="divide-y divide-gray-100">
              {(published ?? []).map((d: any) => (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <div className="min-w-0">
                    {links.has(d.id)
                      ? <a href={links.get(d.id)} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-gray-900 hover:underline">{d.file_name}</a>
                      : <span className="text-sm font-medium text-gray-900">{d.file_name}</span>}
                    {d.description && <div className="text-xs text-gray-500">{d.description}</div>}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Badge tone={d.share_scope === 'owners' ? 'complete' : 'progress'}>{d.share_scope === 'owners' ? 'Board and owners' : 'Board'}</Badge>
                    {date(d.uploaded_at)}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Section>
    </div>
  );
}
