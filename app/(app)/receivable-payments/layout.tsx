import { ContextPanel, PanelSection, PanelLink } from '@/components/workspace/context-panel';

export default function ReceivablesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full">
      <div className="flex-1 overflow-hidden min-w-0">{children}</div>
      <ContextPanel title="Tasks">
        <PanelSection title="Receipts">
          <PanelLink href="/receivable-payments?tab=receipts">Owner Receipt</PanelLink>
          <PanelLink href="/receivable-payments?tab=receipts">Vendor Receipt</PanelLink>
          <PanelLink href="/receivable-payments?tab=receipts">Other Receipt</PanelLink>
          <PanelLink href="/receivable-payments?tab=receipts">Subsidy Receipts</PanelLink>
        </PanelSection>
        <PanelSection title="Charges">
          <PanelLink href="/receivable-payments?tab=charges">Owner Charge</PanelLink>
          <PanelLink href="/receivable-payments?tab=charges">Owner Credit</PanelLink>
          <PanelLink href="/receivable-payments?tab=charges">Bulk Charges and Credits</PanelLink>
          <PanelLink href="/receivable-payments?tab=charges">Bulk Recurring Charges</PanelLink>
          <PanelLink href="/receivable-payments?tab=charges">Apply Credits</PanelLink>
          <PanelLink href="/receivable-payments?tab=charges">Common Charge</PanelLink>
          <PanelLink href="/receivable-payments?tab=charges">Charge Late Fees</PanelLink>
        </PanelSection>
        <PanelSection title="Deposits">
          <PanelLink href="/bank-accounts?action=new-deposit">New Bank Deposit</PanelLink>
          <PanelLink href="/receivable-payments?tab=receipts">Lockbox</PanelLink>
        </PanelSection>
        <PanelSection title="Collections">
          <PanelLink href="/receivable-payments?tab=owner-delinquencies">Sign Up for Debt Collections</PanelLink>
          <PanelLink href="/settings">Resident eCheck Fee Settings</PanelLink>
        </PanelSection>
      </ContextPanel>
    </div>
  );
}
