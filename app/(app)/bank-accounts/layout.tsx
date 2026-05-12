import { ContextPanel, PanelSection, PanelLink } from '@/components/workspace/context-panel';
import { SectionShell } from '@/components/workspace/section-shell';

export default function SectionLayout({ children }: { children: React.ReactNode }) {
  return (
    <SectionShell
      panel={
      <ContextPanel title="Tasks">
        <PanelSection title="Tasks">
          <PanelLink href="/bank-accounts/new">New Bank Account</PanelLink>
          <PanelLink href="/bank-accounts/deposits/new">New Bank Deposit</PanelLink>
          <PanelLink href="/bank-accounts/feeds">Bank Feed</PanelLink>
          <PanelLink href="/bank-accounts/reconcile">Reconcile</PanelLink>
          <PanelLink href="/accounting-periods/close" status="placeholder">Close Accounting Period</PanelLink>
          <PanelLink href="/bank-accounts/online-payments">Enable Bank Accounts for Online Payments</PanelLink>
          <PanelLink href="/bank-accounts/link">Link With Bank</PanelLink>
        </PanelSection>
        <PanelSection title="Reports">
          <PanelLink href="/reports?slug=check-register">Check Register</PanelLink>
          <PanelLink href="/reports?slug=deposit-register">Deposit Register</PanelLink>
          <PanelLink href="/reports?slug=trust-account-balance">Trust Account Balance</PanelLink>
          <PanelLink href="/reports?slug=bank-account-association">Bank Account Association</PanelLink>
        </PanelSection>
      </ContextPanel>
      }
    >
      {children}
    </SectionShell>
  );
}
