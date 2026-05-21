import { requireStaff } from '@/lib/auth/me';
import { ModulePage, ComingSoon } from '@/components/workspace/module-page';

export const dynamic = 'force-dynamic';

export default async function ProjectsPage() {
  await requireStaff();
  return (
    <ModulePage title="Projects" description="Multi-work-order projects — roof replacements, pool renovations, repaving.">
      <ComingSoon
        reason="Projects bundle multiple work orders, POs, and bills under one budget. Foundational tables exist for WOs and POs; a projects table will link them."
        supabaseTable="(not created yet — planned: projects + project_work_orders)"
        roadmapPhase="Phase 3 — Maintenance (extension)"
      />
    </ModulePage>
  );
}
