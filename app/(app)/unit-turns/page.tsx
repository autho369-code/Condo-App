import { requireStaff } from '@/lib/auth/me';
import { ModulePage, ComingSoon } from '@/components/workspace/module-page';

export const dynamic = 'force-dynamic';

export default async function UnitTurnsPage() {
  await requireStaff();
  return (
    <ModulePage title="Unit Turns" description="Turnover workflow for vacating → cleaning → inspecting → re-listing units.">
      <ComingSoon
        reason="Unit turns aren't common for HOAs (owner-led communities). This module targets association portfolios. Schema + workflow pending."
        supabaseTable="(not created yet — planned: unit_turns)"
        roadmapPhase="Phase 6 — Advanced Features"
      />
    </ModulePage>
  );
}
