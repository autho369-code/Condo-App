import { requireStaff } from '@/lib/auth/me';
import { ContextPanel, PanelLink, PanelSection } from '@/components/workspace/context-panel';
import { SectionShell } from '@/components/workspace/section-shell';

export const dynamic = 'force-dynamic';

export default async function OwnersLayout({ children }: { children: React.ReactNode }) {
  await requireStaff();
  return (
    <SectionShell
      className="bg-cream-50"
      panel={
      <ContextPanel title="Tasks">
        <PanelSection title="Tasks">
          <PanelLink href="/owners?change=homeowner">Change Homeowner</PanelLink>
          <PanelLink href="/owners/new?flow=move-in">Move In Homeowner</PanelLink>
          <PanelLink href="/vendors/new">New Vendor</PanelLink>
          <PanelLink href="/send-email?audience=homeowners">Email All Homeowners</PanelLink>
          <PanelLink href="/owners/new">New Owner</PanelLink>
          <PanelLink href="/owners/activations">Owner Portal Activation</PanelLink>
          <PanelLink href="/owners/packets">Send Owner Packet</PanelLink>
          <PanelLink href="/owners/forms">Send Owner Form</PanelLink>
          <PanelLink href="/owners/ach">Owner ACH Setup</PanelLink>
          <PanelLink href="/owners/management-agreements/new">New Management Agreement</PanelLink>
          <PanelLink href="/owners/management-agreements">Management Agreements</PanelLink>
          <PanelLink href="/owners/portal-bulk-settings">Owner Portal Bulk Settings</PanelLink>
        </PanelSection>
        <PanelSection title="Letters">
          <PanelLink href="/reports?slug=owner-statement-enhanced">Owner Statement (Enhanced)</PanelLink>
          <PanelLink href="/reports?slug=owner-statement">Owner Statement</PanelLink>
        </PanelSection>
        <PanelSection title="Reports">
          <PanelLink href="/reports?slug=dues-roll">Dues Roll</PanelLink>
          <PanelLink href="/reports?slug=delinquency">Owner Delinquency</PanelLink>
          <PanelLink href="/reports?slug=owner-directory">Owner Directory</PanelLink>
          <PanelLink href="/reports?slug=homeowner-ledger">Owner Ledger</PanelLink>
        </PanelSection>
      </ContextPanel>
      }
    >
      {children}
    </SectionShell>
  );
}
