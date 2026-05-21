import { requireStaff } from '@/lib/auth/me';
import { ModulePage, ComingSoon } from '@/components/workspace/module-page';

export const dynamic = 'force-dynamic';

export default async function InventoryPage() {
  await requireStaff();
  return (
    <ModulePage title="Inventory" description="Consumables and parts kept on-hand for common maintenance — filters, bulbs, paint.">
      <ComingSoon
        reason="Most HOA management firms don't keep inventory; they use just-in-time vendor purchases. We'll build this if customers ask."
        supabaseTable="(not created yet — planned: inventory_items + inventory_transactions)"
        roadmapPhase="Phase 6 — Advanced Features"
      />
    </ModulePage>
  );
}
