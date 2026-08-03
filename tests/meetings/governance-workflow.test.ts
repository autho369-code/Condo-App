import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const migration = readFileSync(join(root, 'supabase/migrations/20260803070000_secure_meeting_governance.sql'), 'utf8').toLowerCase();
const auditMigration = readFileSync(join(root, 'supabase/migrations/20260803071000_meeting_action_audit_integrity.sql'), 'utf8').toLowerCase();
const confidentialReadMigration = readFileSync(join(root, 'supabase/migrations/20260803072000_restrict_confidential_meeting_reads.sql'), 'utf8').toLowerCase();
const databaseTest = readFileSync(join(root, 'supabase/tests/meeting_governance.sql'), 'utf8').toLowerCase();
const actions = readFileSync(join(root, 'app/(app)/meetings/[id]/actions.ts'), 'utf8');
const managerPage = readFileSync(join(root, 'app/(app)/meetings/[id]/page.tsx'), 'utf8');
const boardPage = readFileSync(join(root, 'app/board/meetings/[id]/page.tsx'), 'utf8');
const downloadRoute = readFileSync(join(root, 'app/api/meeting-documents/[id]/route.ts'), 'utf8');
const adminNavigation = readFileSync(join(root, 'lib/navigation/role-modules.ts'), 'utf8');

describe('meeting governance database boundary', () => {
  it('keeps legacy production staff compatible while enforcing assignment scope', () => {
    expect(migration).toContain('create or replace function public.can_edit_association_mvp');
    expect(migration).toContain("p.mvp_role is null and p.hoa_role = 'manager'");
    expect(migration).toContain("p.hoa_role = 'company_admin'");
    expect(migration).toContain('am.ended_at is null');
    expect(migration).toContain('and a.portfolio_id = p.portfolio_id');
  });

  it('adds explicit staff policies without weakening board read-only access', () => {
    for (const policy of [
      'agenda_items_staff_select',
      'agenda_items_staff_insert',
      'agenda_items_staff_update',
      'agenda_items_staff_delete',
      'meeting_documents_staff_select',
      'meeting_documents_staff_insert',
      'meeting_documents_staff_update',
      'meeting_documents_staff_delete',
      'meeting_action_items_board_read',
    ]) expect(migration).toContain(`create policy ${policy}`);
    expect(migration).toContain('public.can_edit_association_mvp(m.association_id)');
    expect(migration).toContain("m.status not in ('completed', 'cancelled')");
    expect(migration).toContain('uploaded_by = auth.uid()');
  });

  it('repairs the empty action-item prototype with a hard data guard', () => {
    expect(migration).toContain('if exists (select 1 from public.meeting_action_items limit 1)');
    expect(migration).toContain('meeting_action_items contains legacy rows');
    expect(migration).toContain('alter column "meetingid" type uuid using null');
    expect(migration).toContain('foreign key (meeting_id) references public.meetings(id) on delete cascade');
    expect(migration).toContain("status in ('open', 'in_progress', 'blocked', 'completed', 'cancelled')");
    expect(migration).toContain('revoke all on public.meeting_action_items from anon');
  });

  it('requires a complete authorized agenda permutation', () => {
    expect(migration).toContain('create or replace function public.reorder_agenda_items');
    expect(migration).toContain('agenda ordering must include every item exactly once');
    expect(migration).toContain('if not public.can_edit_association_mvp(v_association_id)');
    expect(migration).toContain("v_status in ('completed', 'cancelled')");
    expect(migration).toContain('revoke all on function public.reorder_agenda_items(uuid, uuid[]) from public, anon');
  });

  it('stamps completion evidence and preserves immutable action identity', () => {
    expect(auditMigration).toContain('create or replace function public.guard_meeting_action_item_audit');
    expect(auditMigration).toContain('new.meeting_id := old.meeting_id');
    expect(auditMigration).toContain('new.created_by := old.created_by');
    expect(auditMigration).toContain('new.completed_by := coalesce(auth.uid(), new.completed_by)');
    expect(auditMigration).toContain('new.completed_at := now()');
    expect(auditMigration).toContain('create trigger trg_meeting_action_item_audit');
  });

  it('excludes owners from confidential meeting governance reads', () => {
    expect(confidentialReadMigration).toContain('create or replace function public.can_access_confidential_meeting_mvp');
    expect(confidentialReadMigration).toContain('public.can_edit_association_mvp(a_id)');
    expect(confidentialReadMigration).toContain("p.mvp_role = 'assistant_manager'");
    expect(confidentialReadMigration).toContain('from public.board_members bm');
    expect(confidentialReadMigration).not.toContain('from public.occupancies');
    expect(confidentialReadMigration.match(/public\.can_access_confidential_meeting_mvp\(m\.association_id\)/g)).toHaveLength(3);
    expect(databaseTest).toContain('owners must not read board agenda items');
    expect(databaseTest).toContain('owners must not read private meeting-document metadata');
    expect(databaseTest).toContain('owners must not read board follow-up actions');
  });
});

describe('meeting governance application workflow', () => {
  it('guards every management mutation and scopes child-row writes to the meeting', () => {
    expect(actions).toContain('await requireWorkspaceStaff()');
    expect(actions).toContain(".from('meetings')");
    expect(actions).toContain(".eq('id', documentId).eq('meeting_id', meetingId)");
    expect(actions).toContain(".eq('id', actionItemId).eq('meeting_id', meetingId)");
    expect(actions).toContain(".eq('id', agendaItemId).eq('meeting_id', meetingId)");
    expect(actions).toContain("isScopedStoragePath(document.storage_path, 'meetings', meetingId)");
  });

  it('cleans up failed private uploads and never exposes the bucket publicly', () => {
    expect(actions).toContain('MAX_DOCUMENT_BYTES = 25 * 1024 * 1024');
    expect(actions).toContain('ALLOWED_DOCUMENT_TYPES');
    expect(actions).toContain('randomUUID()');
    expect(actions).toContain('await service.storage.from(BUCKET).remove([path])');
    expect(downloadRoute).toContain(".from('meeting_documents')");
    expect(downloadRoute).toContain('await requireAuth()');
    expect(downloadRoute).toContain("isScopedStoragePath(document.storage_path, 'meetings', document.meeting_id)");
    expect(downloadRoute).toContain('.createSignedUrl(document.storage_path, 60)');
    expect(downloadRoute).toContain("response.headers.set('Cache-Control', 'private, no-store, max-age=0')");
  });

  it('delivers the full manager and board experience', () => {
    for (const text of ['Structured agenda', 'Follow-up actions', 'Sign-in &amp; quorum', 'Meeting documents']) {
      expect(managerPage).toContain(text);
    }
    expect(managerPage).toContain('addMeetingActionItem.bind');
    expect(managerPage).toContain('addMeetingDocument.bind');
    expect(managerPage).toContain('moveAgendaItem.bind');
    expect(boardPage).toContain('Follow-up Actions');
    expect(boardPage).toContain("head: [['Action', 'Responsible', 'Due', 'Status']]");
    expect(boardPage).toContain("const [{ jsPDF }, { autoTable }] = await Promise.all");
    expect(boardPage).toContain('autoTable(doc, {');
    expect(boardPage).not.toContain('(doc as any).autoTable');
    expect(boardPage).toContain('href={`/api/meeting-documents/${d.id}`}');
    expect(boardPage).not.toContain('.createSignedUrl(d.storage_path');
    expect(boardPage).toContain('const canEdit = false');
    expect(adminNavigation).toContain("{ label: 'Meetings', href: '/meetings' }");
  });
});
