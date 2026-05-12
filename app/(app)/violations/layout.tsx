import { ContextPanel, PanelSection, PanelLink } from '@/components/workspace/context-panel';

export default function ViolationsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full">
      <div className="min-w-0 flex-1 overflow-hidden">{children}</div>
      <ContextPanel title="Tasks">
        <PanelSection title="My Tasks">
          <PanelLink href="/inbox">My Tasks</PanelLink>
          <PanelLink href="/violations">New Violation</PanelLink>
          <PanelLink href="/calendar/new?type=board_meeting">Schedule Hearing</PanelLink>
          <PanelLink href="/send-email">Send Notice</PanelLink>
          <PanelLink href="/reports/violation_log">Violation Log</PanelLink>
        </PanelSection>
        <PanelSection title="Help Topics">
          <PanelLink href="/violations">Violations</PanelLink>
          <PanelLink href="/compliance">Compliance</PanelLink>
          <PanelLink href="/reports?q=compliance">Compliance Reports</PanelLink>
          <PanelLink href="/letters">Letters</PanelLink>
        </PanelSection>
        <PanelSection title="Useful Links">
          <PanelLink href="/reports/violation_log">Violation Log</PanelLink>
          <PanelLink href="/reports/letter_history">Letter History</PanelLink>
          <PanelLink href="/associations">Associations</PanelLink>
          <PanelLink href="/owners">Owners</PanelLink>
          <PanelLink href="/units">Units</PanelLink>
        </PanelSection>
      </ContextPanel>
    </div>
  );
}
