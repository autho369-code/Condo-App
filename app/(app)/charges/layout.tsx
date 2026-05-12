import { ContextPanel, PanelSection, PanelLink } from '@/components/workspace/context-panel';

export default function SectionLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full">
      <div className="flex-1 overflow-hidden min-w-0">{children}</div>
      <ContextPanel title="Tasks">
        <PanelSection title="Tasks">
          <PanelLink href="/payments/new">Homeowner Receipt</PanelLink>
          <PanelLink href="/vendor-receipts/new" status="placeholder">Vendor Receipt</PanelLink>
          <PanelLink href="/other-receipts/new" status="placeholder">Other Receipt</PanelLink>
          <PanelLink href="/subsidy-receipts/new" status="placeholder">Subsidy Receipt</PanelLink>
          <PanelLink href="/charges/new">Homeowner Charge</PanelLink>
          <PanelLink href="/charges/bulk" status="placeholder">Bulk Charges and Credits</PanelLink>
          <PanelLink href="/charges/recurring/bulk" status="placeholder">Bulk Recurring Charges</PanelLink>
          <PanelLink href="/credits/new" status="placeholder">Homeowner Credit</PanelLink>
          <PanelLink href="/credits/apply">Apply Credits</PanelLink>
          <PanelLink href="/charges/common/new" status="placeholder">Common Charge</PanelLink>
          <PanelLink href="/charges/late-fees" status="placeholder">Charge Late Fees</PanelLink>
          <PanelLink href="/bank-accounts/deposits/new">New Bank Deposit</PanelLink>
          <PanelLink href="/lockbox" status="placeholder">Lockbox</PanelLink>
          <PanelLink href="/collections/signup" status="placeholder">Sign Up for Debt Collections</PanelLink>
          <PanelLink href="/settings/resident-check-fees" status="placeholder">Resident Check Fee Settings</PanelLink>
        </PanelSection>
      </ContextPanel>
    </div>
  );
}
