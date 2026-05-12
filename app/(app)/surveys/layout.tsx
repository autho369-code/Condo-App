import { ContextPanel, PanelSection, PanelLink } from '@/components/workspace/context-panel';

export default function SectionLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full">
      <div className="flex-1 overflow-hidden min-w-0">{children}</div>
      <ContextPanel title="Tasks">
        <PanelSection title="In Reports">
          <PanelLink href="/inbox">My Tasks</PanelLink>
          <PanelLink href="/surveys/maintenance/responses">Maintenance Survey Responses</PanelLink>
          <PanelLink href="/reports/survey_results">Survey Results Report</PanelLink>
        </PanelSection>
        <PanelSection title="Help Topics">
          <PanelLink href="/surveys">Surveys</PanelLink>
          <PanelLink href="/reports">Reports</PanelLink>
          <PanelLink href="/work-orders">Work Orders</PanelLink>
          <PanelLink href="/owners">Online Owner Portal</PanelLink>
        </PanelSection>
        <PanelSection title="Useful Links">
          <PanelLink href="/metrics">Pricing Metrics</PanelLink>
          <PanelLink href="/scheduled-reports">Scheduled Reports</PanelLink>
          <PanelLink href="/reports/runs">Run History</PanelLink>
          <PanelLink href="/reports/survey_results">Survey Results</PanelLink>
        </PanelSection>
      </ContextPanel>
    </div>
  );
}
