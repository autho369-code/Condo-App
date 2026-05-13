import { ContextPanel, PanelSection, PanelLink } from '@/components/workspace/context-panel';

export default function SectionLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full">
      <div className="flex-1 overflow-hidden min-w-0">{children}</div>
      <ContextPanel title="Tasks">
        <PanelSection title="Tasks">
</PanelSection>
        <PanelSection title="Reports">
          <PanelLink href="/reports?slug=inspection-history">Inspection History</PanelLink>
        </PanelSection>
      </ContextPanel>
    </div>
  );
}