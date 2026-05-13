import { requireStaff } from '@/lib/auth/me';
import { ContextPanel, PanelSection, PanelLink } from '@/components/workspace/context-panel';
import { SectionShell } from '@/components/workspace/section-shell';

export const dynamic = 'force-dynamic';

export default async function BillsLayout({ children }: { children: React.ReactNode }) {
  await requireStaff();
  return (
    <SectionShell
      className="bg-[#faf6f1]"
      panel={
      <ContextPanel>
        <PanelSection title="Tasks">
          <PanelLink href="/bills/new">+ New bill</PanelLink>
          <PanelLink href="/bills/check-run">Run check run</PanelLink>
          <PanelLink href="/bills?status=pending_approval">Pending approval</PanelLink>
          <PanelLink href="/vendors">Vendors</PanelLink>
        </PanelSection>
        <PanelSection title="In Reports">
          <PanelLink href="/reports/bill_detail">Bill Detail</PanelLink>
          <PanelLink href="/reports/aged_payables_summary">A/P Aging</PanelLink>
          <PanelLink href="/reports/check_register">Check Register</PanelLink>
          <PanelLink href="/reports/expense_register">Expense Register</PanelLink>
          <PanelLink href="/reports/vendor_1099_summary">1099 Summary</PanelLink>
        </PanelSection>
      </ContextPanel>
      }
    >
      {children}
    </SectionShell>
  );
}
