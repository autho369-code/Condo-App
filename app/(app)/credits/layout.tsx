import { ContextPanel, PanelLink, PanelSection } from '@/components/workspace/context-panel';
import { SectionShell } from '@/components/workspace/section-shell';

export default function CreditsLayout({ children }: { children: React.ReactNode }) {
  return (
    <SectionShell
      panel={
        <ContextPanel title="Tasks">
          <PanelSection title="Tasks">
            <PanelLink href="/payments/new">Homeowner Receipt</PanelLink>
            <PanelLink href="/credits/apply">Apply Credits</PanelLink>
            <PanelLink href="/charges/new">Homeowner Charge</PanelLink>
          </PanelSection>
        </ContextPanel>
      }
    >
      {children}
    </SectionShell>
  );
}
