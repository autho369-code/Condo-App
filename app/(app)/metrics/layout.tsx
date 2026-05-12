import { ContextPanel, PanelSection, PanelLink } from '@/components/workspace/context-panel';

export default function SectionLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full">
      <div className="flex-1 overflow-hidden min-w-0">{children}</div>
      <ContextPanel title="Tasks">
        <PanelSection title="In Reports">
          <PanelLink href="/inbox">My Tasks</PanelLink>
          <PanelLink href="/metrics">Pricing Metrics</PanelLink>
          <PanelLink href="/reports/pricing_metrics">Pricing Metrics Report</PanelLink>
        </PanelSection>
        <PanelSection title="Reports">
          <PanelLink href="/reports">All Reports</PanelLink>
          <PanelLink href="/scheduled-reports">Scheduled Reports</PanelLink>
          <PanelLink href="/reports/runs">Run History</PanelLink>
        </PanelSection>
        <PanelSection title="Help Topics">
          <PanelLink href="/metrics">Metrics</PanelLink>
          <PanelLink href="/reports">Reports</PanelLink>
          <PanelLink href="/reports/market_metrics">Market Metrics</PanelLink>
          <PanelLink href="/associations">Portfolio and HOA Management</PanelLink>
        </PanelSection>
        <PanelSection title="Useful Links">
          <PanelLink href="/surveys">Surveys</PanelLink>
          <PanelLink href="/compliance">Compliance</PanelLink>
          <PanelLink href="/bank-accounts/activity">Banking Activity</PanelLink>
          <PanelLink href="/reports/bank_reconciliation">Bank Reconciliation</PanelLink>
        </PanelSection>
      </ContextPanel>
    </div>
  );
}
