import { ContextPanel, PanelSection, PanelLink } from '@/components/workspace/context-panel';

export default function SectionLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full">
      <div className="flex-1 overflow-hidden min-w-0">{children}</div>
      <ContextPanel title="Tasks">
        <PanelSection title="Tasks">
          <PanelLink href="/charges/new">New Charge</PanelLink>
          <PanelLink href="/assessments/update">Update Assessments</PanelLink>
        </PanelSection>
        <PanelSection title="Reports">
          <PanelLink href="/reports?slug=aged-receivables">Aged Receivables</PanelLink>
          <PanelLink href="/reports?slug=dues-roll">Dues Roll</PanelLink>
        </PanelSection>
        <PanelSection title="Help Topics">
          <PanelLink href="/help/charges">Managing Charges</PanelLink>
        </PanelSection>
      </ContextPanel>
    </div>
  );
}