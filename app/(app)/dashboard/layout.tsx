import { ContextPanel, PanelSection, PanelLink, PanelDropdown } from '@/components/workspace/context-panel';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-[#faf6f1]">
      <div className="flex-1 overflow-y-auto">{children}</div>
      <ContextPanel>
        <PanelSection title="Setup">
          <PanelDropdown title="Quick actions" defaultOpen>
            <PanelLink href="/bills/new">Enter bill</PanelLink>
            <PanelLink href="/calendar/new?type=board_meeting">Schedule hearing</PanelLink>
            <PanelLink href="/scheduled-reports">Manage report runs</PanelLink>
            <PanelLink href="/bank-transfers">Review transfers</PanelLink>
          </PanelDropdown>
          <PanelLink href="/settings">Connect Stripe &amp; insurance</PanelLink>
          <PanelLink href="/onboard">Onboarding checklist</PanelLink>
        </PanelSection>
        <PanelSection title="Calendar">
          <PanelLink href="/calendar">View Calendar</PanelLink>
        </PanelSection>
        <PanelSection title="Association">
          <PanelLink href="/associations/new">+ New Association</PanelLink>
          <PanelLink href="/units/new">+ New Unit</PanelLink>
        </PanelSection>
        <PanelSection title="Owners and Vendors">
          <PanelLink href="/owners/new">+ New Owner</PanelLink>
          <PanelLink href="/vendors/new">+ New Vendor</PanelLink>
          <PanelLink href="/bills/new">Enter bill</PanelLink>
          <PanelLink href="/charges">Create charge</PanelLink>
        </PanelSection>
        <PanelSection title="In Reports">
          <PanelLink href="/reports/delinquency">Owner Delinquency</PanelLink>
          <PanelLink href="/reports/income_statement">Income Statement</PanelLink>
          <PanelLink href="/reports/dues_roll">Dues Roll</PanelLink>
          <PanelLink href="/reports/cash_flow">Cash Flow</PanelLink>
          <PanelLink href="/reports/balance_sheet">Balance Sheet</PanelLink>
        </PanelSection>
      </ContextPanel>
    </div>
  );
}
