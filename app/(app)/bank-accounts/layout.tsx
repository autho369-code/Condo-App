import { ContextPanel, PanelSection, PanelLink } from '@/components/workspace/context-panel';

export default function SectionLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full">
      <div className="flex-1 overflow-hidden min-w-0">{children}</div>
      <ContextPanel title="Tasks">
        <PanelSection title="Tasks">
          <PanelLink href="/bank-transfers/new">Bank Transfer</PanelLink>
          <PanelLink href="/journal-entries/new">New Journal Entry</PanelLink>
        </PanelSection>
        <PanelSection title="Reports">
          <PanelLink href="/reports?slug=bank-reconciliation">Bank Reconciliation</PanelLink>
          <PanelLink href="/reports?slug=cash-flow">Cash Flow</PanelLink>
        </PanelSection>
        <PanelSection title="Help Topics">
          <PanelLink href="/help/bank-accounts">Managing Bank Accounts</PanelLink>
        </PanelSection>
      </ContextPanel>
    </div>
  );
}