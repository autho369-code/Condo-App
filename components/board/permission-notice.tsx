import { ShieldCheck } from 'lucide-react';
import { EmptyState, PageHeader, Surface } from '@/components/ui/shell';
import { PERMISSION_LABELS, type BoardPermission } from '@/lib/board/permission-catalog';

/** Shown on a board portal page the member's officer role doesn't cover. */
export function BoardPermissionNotice({ title, permission }: { title: string; permission: BoardPermission }) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} />
      <Surface padded={false}>
        <EmptyState
          icon={ShieldCheck}
          title="Not part of your board role"
          description={`Your association has limited “${PERMISSION_LABELS[permission].title.toLowerCase()}” to certain officers. Ask your community manager if you need access.`}
        />
      </Surface>
    </div>
  );
}
