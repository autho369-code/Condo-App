import { ContextPanel, PanelSection, PanelLink, PanelDropdown } from '@/components/workspace/context-panel';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-[#faf6f1]">
      <div className="flex-1 overflow-y-auto">{children}</div>
      <ContextPanel>
        <PanelSection title="Calendar">
          <PanelLink href="/calendar">View Calendar</PanelLink>
          <PanelLink href="/calendar/new">Create Event</PanelLink>
        </PanelSection>

        <PanelSection title="Tasks">
          <PanelLink href="/associations/new">+ New Association</PanelLink>
          <PanelLink href="/owners/new">+ New Owner</PanelLink>
          <PanelLink href="/vendors/new">+ New Vendor</PanelLink>
          <PanelLink href="/bills/new">Draw Bill</PanelLink>
          <PanelLink href="/charges">Draw Invoice</PanelLink>
          <PanelLink href="/violations/new">+ New Violation</PanelLink>
          <PanelLink href="/work-orders">+ New Work Order</PanelLink>
        </PanelSection>

        <PanelSection title="Reports">
          <PanelLink href="/reports/ar-aging">Owner Delinquency</PanelLink>
          <PanelLink href="/reports/income_statement">Income Statement</PanelLink>
          <PanelLink href="/reports/dues_roll">Dues Roll</PanelLink>
          <PanelLink href="/reports/cash_flow">Cash Flow</PanelLink>
          <PanelLink href="/reports/balance_sheet">Balance Sheet</PanelLink>
          <PanelLink href="/reports">All Reports</PanelLink>
        </PanelSection>

        <PanelSection title="Help Topics">
          <PanelLink href="/help/getting-started">Getting Started Guide</PanelLink>
          <PanelLink href="/help/import-association">Import an Association</PanelLink>
          <PanelLink href="/help/managing-hoas">Managing HOAs</PanelLink>
          <PanelLink href="/help/owner-portal">Owner Portal Setup</PanelLink>
        </PanelSection>
      </ContextPanel>
    </div>
  );
}
