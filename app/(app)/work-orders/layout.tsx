import { requireStaff } from '@/lib/auth/me';
import { ContextPanel, PanelSection, PanelLink } from '@/components/workspace/context-panel';

export const dynamic = 'force-dynamic';

export default async function WorkOrdersLayout({ children }: { children: React.ReactNode }) {
  await requireStaff();
  return (
    <div className="flex h-screen bg-[#faf6f1]">
      <div className="flex-1 overflow-y-auto">{children}</div>
      <ContextPanel>
        <PanelSection title="Tasks">
          <PanelLink href="/work-orders/new">+ New work order</PanelLink>
          <PanelLink href="/recurring-work-orders">Recurring work orders</PanelLink>
          <PanelLink href="/work-orders?tab=unassigned">Unassigned queue</PanelLink>
          <PanelLink href="/vendors">Vendors</PanelLink>
        </PanelSection>
        <PanelSection title="In Reports">
          <PanelLink href="/reports/open_work_orders">Open Work Orders</PanelLink>
          <PanelLink href="/reports/maintenance_history">Maintenance History</PanelLink>
          <PanelLink href="/reports/work_order_report">Work Order Report</PanelLink>
          <PanelLink href="/reports/vendor_performance">Vendor Performance</PanelLink>
        </PanelSection>
        <PanelSection title="Help Topics">
          <PanelLink href="#">Dispatching a vendor</PanelLink>
          <PanelLink href="#">Approving estimates</PanelLink>
          <PanelLink href="#">Converting a service request to a WO</PanelLink>
        </PanelSection>
      </ContextPanel>
    </div>
  );
}
