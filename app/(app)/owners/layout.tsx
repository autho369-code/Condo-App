import { requireStaff } from '@/lib/auth/me';
import { ContextPanel, PanelLink, PanelSection } from '@/components/workspace/context-panel';

export const dynamic = 'force-dynamic';

export default async function OwnersLayout({ children }: { children: React.ReactNode }) {
  await requireStaff();
  return (
    <div className="flex h-screen bg-gray-50">
      <div className="min-w-0 flex-1 overflow-y-auto">{children}</div>
      <ContextPanel title="Tasks">
        <PanelSection title="Tasks">
          <PanelLink href="/owners/new">New Owner</PanelLink>
          <PanelLink href="/owners/activations">Owner Portal Activation</PanelLink>
          <PanelLink href="/owners/packets">Send Owner Packet</PanelLink>
          <PanelLink href="/owners/forms">Send Owner Form</PanelLink>
          <PanelLink href="/owners/ach">Owner ACH Setup</PanelLink>
          <PanelLink href="/owners/management-agreements/new">New Management Agreement</PanelLink>
        </PanelSection>
        <PanelSection title="Reports">
          <PanelLink href="/reports?slug=dues-roll">Dues Roll</PanelLink>
          <PanelLink href="/reports?slug=delinquency">Owner Delinquency</PanelLink>
          <PanelLink href="/reports?slug=owner-directory">Owner Directory</PanelLink>
          <PanelLink href="/reports?slug=homeowner-ledger">Owner Ledger</PanelLink>
        </PanelSection>
      </ContextPanel>
    </div>
  );
}
