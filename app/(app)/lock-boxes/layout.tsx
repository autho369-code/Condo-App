import { ContextPanel, PanelSection, PanelDropdown, PanelLink } from '@/components/workspace/context-panel';
import { SectionShell } from '@/components/workspace/section-shell';

export default function LockBoxesLayout({ children }: { children: React.ReactNode }) {
  return (
    <SectionShell
      panel={
        <ContextPanel title="Tasks">
          <PanelSection title="Tasks">
            <PanelDropdown title="Lock Box Tasks" defaultOpen>
              <PanelLink href="/lock-boxes?action=new">Add Lock Box</PanelLink>
              <PanelLink href="/lock-boxes?action=assign">Record Assignment</PanelLink>
              <PanelLink href="/lock-boxes?action=return">Return Keys</PanelLink>
            </PanelDropdown>
          </PanelSection>
          <PanelSection title="Reports">
            <PanelLink href="/reports?slug=lock-box-inventory">Lock Box Inventory</PanelLink>
            <PanelLink href="/reports?slug=lock-box-assignments">Active Assignments</PanelLink>
          </PanelSection>
          <PanelSection title="Help Topics">
            <PanelLink href="/help/lock-boxes">Managing Lock Boxes</PanelLink>
          </PanelSection>
        </ContextPanel>
      }
    >
      {children}
    </SectionShell>
  );
}
