import Link from 'next/link';

import { requireBoardAccess } from '@/lib/auth/me';
import { Card, CardBody, Stat } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function BoardDashboardPage() {
  const me = await requireBoardAccess();
  const supabase = await createClient();
  const isStaffView = me.is_staff || me.is_platform_operator;
  const associationIds = isStaffView ? [] : me.board_association_ids;

  const [{ data: associations }, { count: documentsCount }, { count: approvalsCount }] = await Promise.all([
    isStaffView
      ? (supabase as any).from('associations').select('id, name').is('archived_at', null).order('name').limit(25)
      : associationIds.length
      ? (supabase as any).from('associations').select('id, name').in('id', associationIds).order('name')
      : Promise.resolve({ data: [] }),
    associationIds.length
      ? (supabase as any).from('association_attachments').select('id', { count: 'exact', head: true }).in('association_id', associationIds).eq('shared_with_owner', true).is('archived_at', null)
      : Promise.resolve({ count: 0 }),
    associationIds.length
      ? (supabase as any).from('approval_requests').select('id', { count: 'exact', head: true }).in('association_id', associationIds).eq('status', 'pending')
      : Promise.resolve({ count: 0 }),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-7 px-8 py-6">
      <header className="border-b border-ink-100 pb-7">
        <div className="eyebrow">Board access</div>
        <h1 className="mt-2 font-display text-4xl tracking-editorial text-ink-900">Board dashboard</h1>
        <p className="mt-2 text-[15px] text-ink-500">Association documents, approvals, owner portal tools, and account records available to your board role.</p>
      </header>

      <div className="grid gap-3 md:grid-cols-3">
        <Stat label="Associations" value={(associations ?? []).length} />
        <Stat label="Shared documents" value={documentsCount ?? 0} />
        <Stat label="Pending approvals" value={approvalsCount ?? 0} />
      </div>

      <Card>
        <CardBody>
          <div className="grid gap-3 md:grid-cols-2">
            <Link href="/portal/documents" className="rounded border border-ink-100 p-4 hover:bg-cream-50">
              <div className="font-medium text-ink-900">Association documents</div>
              <div className="mt-1 text-sm text-ink-500">Governing documents, minutes, notices, and board-shared files.</div>
            </Link>
            <Link href="/portal/communications" className="rounded border border-ink-100 p-4 hover:bg-cream-50">
              <div className="font-medium text-ink-900">Communication history</div>
              <div className="mt-1 text-sm text-ink-500">Emails, notices, and text messages visible to your owner account.</div>
            </Link>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
