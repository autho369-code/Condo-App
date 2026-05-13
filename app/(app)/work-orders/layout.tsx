import { requireStaff } from '@/lib/auth/me';
import { ContextPanel, PanelSection, PanelLink } from '@/components/workspace/context-panel';
import { SectionShell } from '@/components/workspace/section-shell';

export const dynamic = 'force-dynamic';

export default async function WorkOrdersLayout({ children }: { children: React.ReactNode }) {
  await requireStaff();
  return (
    <SectionShell
      className="bg-[#faf6f1]"
      panel={
      <ContextPanel>
        <PanelSection title="Tasks">
          <PanelLink href="/work-orders/new">+ New work order</PanelLink>
          <PanelLink href="/work-orders?tab=unassigned">Unassigned queue</PanelLink>
          <PanelLink href="/vendors">Vendors</PanelLink>
        </PanelSection>
        <PanelSection title="In Reports">
          <PanelLink href="/reports/open_work_orders">Open Work Orders</PanelLink>
          <PanelLink href="/reports/maintenance_history">Maintenance History</PanelLink>
          <PanelLink href="/reports/work_order_report">Work Order Report</PanelLink>
          <PanelLink href="/reports/vendor_performance">Vendor Performance</PanelLink>
        </PanelSection>
      </ContextPanel>
      }
    >
      {children}
    </SectionShell>
  );
}
