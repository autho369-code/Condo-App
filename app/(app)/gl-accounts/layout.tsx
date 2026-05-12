import { ContextPanel, PanelSection, PanelLink } from '@/components/workspace/context-panel';

export default function SectionLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full">
      <div className="flex-1 overflow-hidden min-w-0">{children}</div>
      <ContextPanel title="Tasks">
        <PanelSection title="Tasks">
          <PanelLink href="/gl-accounts/new">New GL Account</PanelLink>
          <PanelLink href="/gl-account-maps/new" status="placeholder">New GL Account Map</PanelLink>
          <PanelLink href="/gl-accounts/permissions">Manage GL Account Permissions</PanelLink>
          <PanelLink href="/gl-accounts/reactivate">Reactivate GL Account</PanelLink>
        </PanelSection>
        <PanelSection title="Reports">
          <PanelLink href="/reports?slug=general-ledger">General Ledger</PanelLink>
        </PanelSection>
        <PanelSection title="Help Topics">
          <PanelLink href="/help/gl-accounts">Add or Edit GL Accounts</PanelLink>
        </PanelSection>
      </ContextPanel>
    </div>
  );
}
