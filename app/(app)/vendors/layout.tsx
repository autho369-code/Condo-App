import { ContextPanel, PanelSection, PanelLink } from '@/components/workspace/context-panel';
import { SectionShell } from '@/components/workspace/section-shell';

export default function SectionLayout({ children }: { children: React.ReactNode }) {
  return (
    <SectionShell
      panel={
      <ContextPanel title="Tasks">
        <PanelSection title="Tasks">
          <PanelLink href="/vendors/new">New Vendor</PanelLink>
        </PanelSection>
        <PanelSection title="Reports">
          <PanelLink href="/reports?slug=vendor-directory">Vendor Directory</PanelLink>
          <PanelLink href="/reports?slug=vendor-1099">1099 Report</PanelLink>
          <PanelLink href="/reports?slug=check-register">Check Register</PanelLink>
        </PanelSection>
      </ContextPanel>
      }
    >
      {children}
    </SectionShell>
  );
}
