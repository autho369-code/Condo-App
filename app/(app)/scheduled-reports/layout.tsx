import { ContextPanel, PanelSection, PanelLink } from '@/components/workspace/context-panel';

export default function SectionLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full">
      <div className="flex-1 overflow-hidden min-w-0">{children}</div>
      <ContextPanel title="Tasks">
        <PanelSection title="Tasks">
          <PanelLink href="/inbox">My Tasks</PanelLink>
          <PanelLink href="/inbox">Inbox</PanelLink>
          <PanelLink href="/reports">Reports</PanelLink>
          <PanelLink href="/reports/runs">Run History</PanelLink>
        </PanelSection>
        <PanelSection title="Help Topics">
          <PanelLink href="/scheduled-reports">Scheduled Reports</PanelLink>
          <PanelLink href="/reports">Reports</PanelLink>
          <PanelLink href="/reports?q=accounting">Accounting</PanelLink>
          <PanelLink href="/gl-accounts">GL Accounts</PanelLink>
          <PanelLink href="/owners">Online Owner Portal</PanelLink>
        </PanelSection>
        <PanelSection title="Useful Links">
          <PanelLink href="/bank-accounts/activity">Banking Activity</PanelLink>
          <PanelLink href="/bank-accounts">Bank Accounts</PanelLink>
          <PanelLink href="/bills/check-run">Check Run</PanelLink>
          <PanelLink href="/reports/bank_reconciliation">Reconciliation</PanelLink>
          <PanelLink href="/reports/management_fee_summary">Management Fee Summary</PanelLink>
        </PanelSection>
      </ContextPanel>
    </div>
  );
}
