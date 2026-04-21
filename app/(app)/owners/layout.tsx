import { requireStaff } from '@/lib/auth/me';
import { ContextPanel, PanelSection, PanelLink } from '@/components/workspace/context-panel';

export const dynamic = 'force-dynamic';

export default async function OwnersLayout({ children }: { children: React.ReactNode }) {
  await requireStaff();
  return (
    <div className="flex h-screen bg-[#faf6f1]">
      <div className="flex-1 overflow-y-auto">{children}</div>
      <ContextPanel title="Tasks">
        <PanelSection title="Tasks" icon="★">
          <PanelLink href="#">Change Owner</PanelLink>
          <PanelLink href="/owners/new">Move In Owner</PanelLink>
          <PanelLink href="/vendors/new">New Vendor</PanelLink>
          <PanelLink href="#">Email All Owners</PanelLink>
        </PanelSection>
        <PanelSection title="Reports" icon="▤">
          <PanelLink href="/reports/dues_roll">Dues Roll</PanelLink>
          <PanelLink href="/reports/delinquency">Owner Delinquency</PanelLink>
          <PanelLink href="/reports/owner_directory">Owner Directory</PanelLink>
          <PanelLink href="/reports/owner_ledger">Owner Ledger</PanelLink>
        </PanelSection>
      </ContextPanel>
    </div>
  );
}
