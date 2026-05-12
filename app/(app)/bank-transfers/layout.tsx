import { ContextPanel, PanelSection, PanelLink } from '@/components/workspace/context-panel';

export default function SectionLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full">
      <div className="flex-1 overflow-hidden min-w-0">{children}</div>
      <ContextPanel title="Tasks">
        <PanelSection title="Reports">
          <PanelLink href="/bank-accounts/activity">Bank Account Activity</PanelLink>
          <PanelLink href="/reports?slug=general-ledger">General Ledger</PanelLink>
        </PanelSection>
      </ContextPanel>
    </div>
  );
}
