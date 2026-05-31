import { ContextPanel, PanelSection, PanelLink } from '@/components/workspace/context-panel';

export default function ReceivablePaymentsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full">
      <div className="flex-1 overflow-hidden min-w-0">{children}</div>
      <ContextPanel title="Tasks">
        <PanelSection title="Receipts">
          <PanelLink href="/receivable-payments/new?type=owner">Owner Receipt</PanelLink>
          <PanelLink href="/receivable-payments/new?type=owner_charge">Owner Charge</PanelLink>
          <PanelLink href="/receivable-payments/new?type=owner_credit">Owner Credit</PanelLink>
          <PanelLink href="/receivable-payments/new?type=vendor">Vendor Receipt</PanelLink>
          <PanelLink href="/receivable-payments/new?type=other">Other Receipt</PanelLink>
          <PanelLink href="/receivable-payments/subsidy">Subsidy Receipts</PanelLink>
        </PanelSection>
        <PanelSection title="Bulk Actions">
          <PanelLink href="/charges/bulk">Bulk Charges and Credits</PanelLink>
          <PanelLink href="/charges/recurring/bulk">Bulk Recurring Charges</PanelLink>
          <PanelLink href="/charges/credits/apply">Apply Credits</PanelLink>
          <PanelLink href="/charges/common">Common Charge</PanelLink>
          <PanelLink href="/charges/late-fees">Charge Late Fees</PanelLink>
        </PanelSection>
        <PanelSection title="Deposits">
          <PanelLink href="/bank-accounts/deposits/new">New Bank Deposit</PanelLink>
          <PanelLink href="/bank-accounts/lockbox">Lockbox</PanelLink>
        </PanelSection>
        <PanelSection title="Services">
          <PanelLink href="/settings/collections">Sign Up for Debt Collections</PanelLink>
        </PanelSection>
      </ContextPanel>
    </div>
  );
}
