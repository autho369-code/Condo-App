'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireStaff } from '@/lib/auth/me';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { isBoardSection, OWNER_HIDDEN_SECTIONS, publishBoardPackage } from '@/lib/reports/board-package';

const REF_RE = /^[a-z0-9-]{1,80}$/i;
const s = (fd: FormData, k: string) => ((fd.get(k) as string) ?? '').trim();
const back = (fd: FormData) => `/associations/${REF_RE.test(s(fd, 'association_ref')) ? s(fd, 'association_ref') : s(fd, 'association_id')}/board`;
// Separate query keys so the Board tab's approval-rules alerts don't fire.
function go(path: string, key: 'error' | 'saved', msg: string): never {
  revalidatePath(path);
  redirect(`${path}?report_${key}=${encodeURIComponent(msg)}#board-reports`);
}

export async function saveBoardReportSettings(formData: FormData) {
  await requireStaff();
  const to = back(formData);
  const sections = formData.getAll('sections').map(String).filter(isBoardSection);
  const day = Number(s(formData, 'publish_day'));
  const scope = s(formData, 'share_scope') === 'owners' ? 'owners' : 'board';
  // Shared with owners, per-unit sections are left out of the package; it
  // needs at least one other report or every publish would fail.
  if (scope === 'owners' && sections.length > 0 && sections.every((k) => OWNER_HIDDEN_SECTIONS.has(k))) {
    go(to, 'error', 'A package shared with owners leaves out the receivables aging. Choose at least one other report.');
  }
  const db = (await createClient()) as any;
  const { error } = await db.rpc('save_board_report_settings', {
    p_association_id: s(formData, 'association_id'), p_sections: sections, p_share_scope: scope,
    p_auto_publish: formData.get('auto_publish') === 'on', p_publish_day: Number.isInteger(day) ? day : 10,
    p_notify_board: formData.get('notify_board') === 'on',
  });
  if (error) go(to, 'error', error.message);
  go(to, 'saved', 'Board report settings saved.');
}

export async function publishBoardReportNow(formData: FormData) {
  const me = await requireStaff();
  const to = back(formData);
  const associationId = s(formData, 'association_id');
  const db = (await createClient()) as any;
  // Storage and document writes use the service client; confirm access first.
  const { data: allowed } = await db.rpc('can_manage_association', { p_association_id: associationId });
  if (allowed !== true) go(to, 'error', 'You do not manage this association.');

  const [{ data: association }, { data: settings }] = await Promise.all([
    db.from('associations').select('id, name, portfolio_id, portfolios(company_name)').eq('id', associationId).maybeSingle(),
    db.from('association_board_report_settings').select('sections, share_scope, notify_board').eq('association_id', associationId).maybeSingle(),
  ]);
  if (!association) go(to, 'error', 'Association not found.');
  if (!settings) go(to, 'error', 'Save the board report settings first.');

  let result: Awaited<ReturnType<typeof publishBoardPackage>>;
  try {
    result = await publishBoardPackage({
      dataClient: db,
      svc: createServiceClient(),
      association: { id: association.id, name: association.name, portfolio_id: association.portfolio_id, company_name: association.portfolios?.company_name },
      dateFrom: s(formData, 'date_from'),
      dateTo: s(formData, 'date_to'),
      sections: settings.sections,
      shareScope: settings.share_scope,
      notify: settings.notify_board && formData.get('notify') === 'on',
      actorId: me.auth_user_id,
      source: 'manual',
    });
  } catch (e: any) {
    go(to, 'error', e?.message ?? 'Publishing failed.');
  }
  go(to, 'saved', `${result.replaced ? 'Republished' : 'Published'} to the board portal${result.emailed ? `; ${result.emailed} board member${result.emailed === 1 ? '' : 's'} notified` : ''}.`);
}
