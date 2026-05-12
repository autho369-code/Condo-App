import { ContextPanel, PanelSection, PanelLink } from '@/components/workspace/context-panel';

export default function SectionLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full">
      <div className="flex-1 overflow-hidden min-w-0">{children}</div>
      <ContextPanel title="Tasks">
        <PanelSection title="Tasks">
          <PanelLink href="/charges/new">New Charge</PanelLink>
          <PanelLink href="/accounting/receivable-payments">Receipts</PanelLink>
          <PanelLink href="/assessments/update">Update Assessments</PanelLink>
        </PanelSection>
        <PanelSection title="Reports">
          <PanelLink href="/reports/ar_aging">Aged Receivables</PanelLink>
          <PanelLink href="/reports/payment_register">Payment Register</PanelLink>
          <PanelLink href="/reports/unapplied_receipts">Unapplied Receipts</PanelLink>
        </PanelSection>
        <PanelSection title="Help Topics">
          <PanelLink href="/charges">Receivables</PanelLink>
          <PanelLink href="/accounting/receivable-payments">Receipt Ledger</PanelLink>
          <PanelLink href="/reports?q=receivable">Receivable Reports</PanelLink>
        </PanelSection>
      </ContextPanel>
    </div>
  );
}
