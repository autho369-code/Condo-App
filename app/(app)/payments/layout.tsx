import { ContextPanel, PanelLink, PanelSection } from '@/components/workspace/context-panel';
import { SectionShell } from '@/components/workspace/section-shell';

export default function PaymentsLayout({ children }: { children: React.ReactNode }) {
  return (
    <SectionShell
      panel={
        <ContextPanel title="Tasks">
          <PanelSection title="Tasks">
            <PanelLink href="/payments/new">Owner Receipt</PanelLink>
            <PanelLink href="/charges/new">Owner Charge</PanelLink>
            <PanelLink href="/bank-accounts/deposits/new">New Bank Deposit</PanelLink>
            <PanelLink href="/credits/apply">Apply Credits</PanelLink>
          </PanelSection>
        </ContextPanel>
      }
    >
      {children}
    </SectionShell>
  );
}
