import { ContextPanel, PanelSection, PanelLink } from '@/components/workspace/context-panel';

export default function SectionLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full">
      <div className="flex-1 overflow-hidden min-w-0">{children}</div>
      <ContextPanel title="Tasks">
        <PanelSection title="Quick actions">
          <PanelLink href="/associations/new">+ New Association</PanelLink>
          <PanelLink href="/settings/ai">⚡ AI Configuration</PanelLink>
          <PanelLink href="/onboard">Onboarding checklist</PanelLink>
        </PanelSection>
        <PanelSection title="Help Topics">
          <PanelLink href="/help/settings">Settings Overview</PanelLink>
          <PanelLink href="/help/settings#managing-your-team">Managing Your Team</PanelLink>
          <PanelLink href="/help/settings#online-payment-fees">Payment Fee Settings</PanelLink>
          <PanelLink href="/help/settings#payment-reminders">Reminder Schedule</PanelLink>
        </PanelSection>
      </ContextPanel>
    </div>
  );
}
