import { ContextPanel, PanelSection, PanelLink } from '@/components/workspace/context-panel';

export default function SectionLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full">
      <div className="flex-1 overflow-hidden min-w-0">{children}</div>
      <ContextPanel title="Tasks">
        <PanelSection title="Tasks">
          <PanelLink href="/inspections/new">New Inspection</PanelLink>
          <PanelLink href="/inspections/templates/new">New Inspection Template</PanelLink>
          <PanelLink href="/inspections/copy">Bulk Copy Inspections</PanelLink>
        </PanelSection>
        <PanelSection title="Reports">
          <PanelLink href="/reports?slug=inspection-detail">Inspection Detail</PanelLink>
          <PanelLink href="/reports?slug=unit-inspection">Unit Inspection</PanelLink>
        </PanelSection>
        <PanelSection title="Help Topics">
          <PanelLink href="/help/inspections">Inspections</PanelLink>
        </PanelSection>
      </ContextPanel>
    </div>
  );
}