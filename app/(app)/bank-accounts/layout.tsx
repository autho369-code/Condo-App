import { ContextPanel, PanelSection, PanelLink } from '@/components/workspace/context-panel';

export default function SectionLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full">
      <div className="flex-1 overflow-hidden min-w-0">{children}</div>
      <ContextPanel title="Tasks">
        <PanelSection title="Tasks">
          <PanelLink href="/bank-accounts/activity">Banking Activity</PanelLink>
          <PanelLink href="/bank-transfers/new">Bank Transfer</PanelLink>
          <PanelLink href="/journal-entries/new">New Journal Entry</PanelLink>
        </PanelSection>
        <PanelSection title="Reports">
          <PanelLink href="/reports/bank_reconciliation">Bank Reconciliation</PanelLink>
          <PanelLink href="/reports/cash_flow">Cash Flow</PanelLink>
          <PanelLink href="/reports/bank_account_activity">Bank Account Activity</PanelLink>
        </PanelSection>
        <PanelSection title="Help Topics">
          <PanelLink href="/bank-accounts">Bank Account Registry</PanelLink>
          <PanelLink href="/bank-accounts/activity">Activity Ledger</PanelLink>
          <PanelLink href="/reports?q=bank">Banking Reports</PanelLink>
        </PanelSection>
      </ContextPanel>
    </div>
  );
}
