import { ContextPanel, PanelSection, PanelLink } from '@/components/workspace/context-panel';

export default function SectionLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full">
      <div className="flex-1 overflow-hidden min-w-0">{children}</div>
      <ContextPanel title="Tasks">
        <PanelSection title="In Reports">
          <PanelLink href="/inbox">My Tasks</PanelLink>
          <PanelLink href="/compliance">Compliance Status</PanelLink>
          <PanelLink href="/reports/violation_log">Violation Log</PanelLink>
          <PanelLink href="/reports/data_diagnostics_summary">Data Diagnostics Summary</PanelLink>
        </PanelSection>
        <PanelSection title="Help Topics">
          <PanelLink href="/compliance">Compliance</PanelLink>
          <PanelLink href="/reports">Reports</PanelLink>
          <PanelLink href="/scheduled-reports">Scheduled Reports</PanelLink>
          <PanelLink href="/reports?q=compliance">Compliance Reports</PanelLink>
        </PanelSection>
        <PanelSection title="Useful Links">
          <PanelLink href="/metrics">Metrics</PanelLink>
          <PanelLink href="/surveys">Surveys</PanelLink>
          <PanelLink href="/reports/runs">Run History</PanelLink>
          <PanelLink href="/reports/users_and_permissions">Users and Permissions</PanelLink>
        </PanelSection>
      </ContextPanel>
    </div>
  );
}
