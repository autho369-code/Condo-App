import { ContextPanel, PanelLink, PanelSection } from '@/components/workspace/context-panel';
import { SectionShell } from '@/components/workspace/section-shell';

export default function PaymentsLayout({ children }: { children: React.ReactNode }) {
  return (
    <SectionShell
      panel={
        <ContextPanel title="Tasks">
          <PanelSection title="Tasks">
            <PanelLink href="/payments/new">Homeowner Receipt</PanelLink>
            <PanelLink href="/charges/new">Homeowner Charge</PanelLink>
            <PanelLink href="/bank-accounts/deposits/new">New Bank Deposit</PanelLink>
            <PanelLink href="/credits/apply" status="placeholder">Apply Credits</PanelLink>
          </PanelSection>
        </ContextPanel>
      }
    >
      {children}
    </SectionShell>
  );
}
