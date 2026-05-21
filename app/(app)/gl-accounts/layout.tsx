import { ContextPanel, PanelSection, PanelLink } from '@/components/workspace/context-panel';

export default function SectionLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full">
      <div className="flex-1 overflow-hidden min-w-0">{children}</div>
      <ContextPanel title="Tasks">
        <PanelSection title="Tasks">
          <PanelLink href="/gl-accounts/new">New GL Account</PanelLink>
          <PanelLink href="/journal-entries/new">New Journal Entry</PanelLink>
        </PanelSection>
        <PanelSection title="Reports">
          <PanelLink href="/reports?slug=general-ledger">General Ledger</PanelLink>
          <PanelLink href="/reports?slug=trial-balance">Trial Balance</PanelLink>
          <PanelLink href="/reports?slug=balance-sheet">Balance Sheet</PanelLink>
          <PanelLink href="/reports?slug=income-statement">Income Statement</PanelLink>
        </PanelSection>
        <PanelSection title="Help Topics">
          <PanelLink href="/help/gl-accounts">Chart of Accounts</PanelLink>
        </PanelSection>
      </ContextPanel>
    </div>
  );
}