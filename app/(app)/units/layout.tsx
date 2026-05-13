import { requireStaff } from '@/lib/auth/me';
import { ContextPanel, PanelSection, PanelLink } from '@/components/workspace/context-panel';
import { SectionShell } from '@/components/workspace/section-shell';

export const dynamic = 'force-dynamic';

export default async function UnitsLayout({ children }: { children: React.ReactNode }) {
  await requireStaff();
  return (
    <SectionShell
      className="bg-[#faf6f1]"
      panel={
      <ContextPanel>
        <PanelSection title="Tasks">
          <PanelLink href="/units/new">+ New unit</PanelLink>
          <PanelLink href="/associations/new">+ New association</PanelLink>
          <PanelLink href="/owners/new">+ New owner</PanelLink>
          <PanelLink href="/units?filter=balance">Units with balance</PanelLink>
        </PanelSection>
        <PanelSection title="In Reports">
          <PanelLink href="/reports/ar_aging">A/R Aging (live)</PanelLink>
          <PanelLink href="/reports/owner_ledger">Owner Ledger</PanelLink>
          <PanelLink href="/reports/delinquency">Delinquency</PanelLink>
          <PanelLink href="/reports/association_directory">Association Directory</PanelLink>
          <PanelLink href="/reports/unit_availability">Unit Availability</PanelLink>
        </PanelSection>
      </ContextPanel>
      }
    >
      {children}
    </SectionShell>
  );
}
