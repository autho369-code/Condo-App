import { DataWorkspace } from '@/components/operations/data-workspace';
import { ComingSoon } from '@/components/workspace/module-page';
import { requireStaff } from '@/lib/auth/me';

export const dynamic = 'force-dynamic';

export default async function ActivityPage() {
  await requireStaff();

  return (
    <DataWorkspace
      title="Activity"
      description="A consolidated activity feed for portfolio events, approvals, payments, messages, and system actions."
    >
      <ComingSoon
        reason="This redesign links to the activity feed, but the feed query and event grouping still need to be wired."
        roadmapPhase="Placeholder: build activity timeline"
      />
    </DataWorkspace>
  );
}
