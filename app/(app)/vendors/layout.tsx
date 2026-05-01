import { ContextPanel, PanelSection, PanelLink } from '@/components/workspace/context-panel';

export default function SectionLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full">
      <div className="flex-1 overflow-hidden min-w-0">{children}</div>
      <ContextPanel title="Tasks">
        <PanelSection title="Tasks">
          <PanelLink href="/vendors/new">New Vendor</PanelLink>
          <PanelLink href="/bills/new">New Bill</PanelLink>
        </PanelSection>
        <PanelSection title="Reports">
          <PanelLink href="/reports?slug=vendor-directory">Vendor Directory</PanelLink>
          <PanelLink href="/reports?slug=vendor-1099">1099 Report</PanelLink>
        </PanelSection>
        <PanelSection title="Help Topics">
          <PanelLink href="/help/vendors">Managing Vendors</PanelLink>
        </PanelSection>
      </ContextPanel>
    </div>
  );
}