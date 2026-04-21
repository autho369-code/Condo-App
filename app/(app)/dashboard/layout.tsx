import { ContextPanel, PanelSection, PanelLink } from '@/components/workspace/context-panel';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-[#faf6f1]">
      <div className="flex-1 overflow-y-auto">{children}</div>
      <ContextPanel>
        <PanelSection title="Setup">
          <PanelLink href="/settings">Connect Stripe &amp; insurance</PanelLink>
          <PanelLink href="/onboard">Onboarding checklist</PanelLink>
        </PanelSection>
        <PanelSection title="Calendar">
          <PanelLink href="/calendar">View Calendar</PanelLink>
        </PanelSection>
        <PanelSection title="Property">
          <PanelLink href="/associations/new">+ New Association</PanelLink>
          <PanelLink href="/units/new">+ New Unit</PanelLink>
        </PanelSection>
        <PanelSection title="People">
          <PanelLink href="/owners/new">+ New Owner</PanelLink>
          <PanelLink href="/vendors/new">+ New Vendor</PanelLink>
          <PanelLink href="/bills/new">Draw Bill</PanelLink>
          <PanelLink href="/charges">Draw Invoice</PanelLink>
        </PanelSection>
        <PanelSection title="In Reports">
          <PanelLink href="/reports/delinquency">Owner Delinquency</PanelLink>
          <PanelLink href="/reports/income_statement">Income Statement</PanelLink>
          <PanelLink href="/reports/dues_roll">Dues Roll</PanelLink>
          <PanelLink href="/reports/cash_flow">Cash Flow</PanelLink>
          <PanelLink href="/reports/balance_sheet">Balance Sheet</PanelLink>
        </PanelSection>
        <PanelSection title="Help Topics">
          <PanelLink href="#">How to Use the Help Center</PanelLink>
        </PanelSection>
      </ContextPanel>
    </div>
  );
}
