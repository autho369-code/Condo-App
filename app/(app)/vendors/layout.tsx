import { ContextPanel, PanelSection, PanelLink, PanelDropdown } from '@/components/workspace/context-panel';
import { SectionShell } from '@/components/workspace/section-shell';

export default function SectionLayout({ children }: { children: React.ReactNode }) {
  return (
    <SectionShell
      panel={
      <ContextPanel title="Tasks">
        <PanelSection title="Tasks">
          <PanelDropdown title="Vendor tasks" defaultOpen>
            <PanelLink href="/vendors/new">New Vendor</PanelLink>
            <PanelLink href="/vendors/ach">Vendor ACH Setup</PanelLink>
            <PanelLink href="/vendors/w9">Request W-9</PanelLink>
            <PanelLink href="/vendors/compliance">Request Documents</PanelLink>
            <PanelLink href="/vendors/forms">Send Vendor Form</PanelLink>
          </PanelDropdown>
        </PanelSection>
        <PanelSection title="Reports">
          <PanelLink href="/reports?slug=vendor-directory">Vendor Directory</PanelLink>
          <PanelLink href="/reports?slug=vendor-1099">1099 Report</PanelLink>
          <PanelLink href="/reports?slug=check-register">Check Register</PanelLink>
        </PanelSection>
        <PanelSection title="Help Topics">
          <PanelLink href="/help/vendors">Managing Vendors</PanelLink>
        </PanelSection>
      </ContextPanel>
      }
    >
      {children}
    </SectionShell>
  );
}
