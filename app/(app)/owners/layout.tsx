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
          <PanelLink href="/owners/new">New Owner</PanelLink>
          <PanelLink href="/owners/new?flow=move-in">Move In Owner</PanelLink>
          <PanelLink href="/send-email?audience=owners">Email All Owners</PanelLink>
</PanelSection>
        <PanelSection title="Reports">
          <PanelLink href="/reports?slug=dues-roll">Dues Roll</PanelLink>
          <PanelLink href="/reports?slug=delinquency">Owner Delinquency</PanelLink>
          <PanelLink href="/reports?slug=owner-directory">Owner Directory</PanelLink>
          <PanelLink href="/reports?slug=owner-ledger">Owner Ledger</PanelLink>
        </PanelSection>
      </ContextPanel>
      }
    >
      {children}
    </SectionShell>
  );
}
