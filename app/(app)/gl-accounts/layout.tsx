import { ContextPanel, PanelSection, PanelLink } from '@/components/workspace/context-panel';
import { SectionShell } from '@/components/workspace/section-shell';

export default function SectionLayout({ children }: { children: React.ReactNode }) {
  return (
    <SectionShell
      panel={
      <ContextPanel title="Tasks">
        <PanelSection title="Tasks">
          <PanelLink href="/gl-accounts/new">Create New GL Account</PanelLink>
          <PanelLink href="/gl-accounts/import">Create New GL Using Excel Import</PanelLink>
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
      }
    >
      {children}
    </SectionShell>
  );
}
