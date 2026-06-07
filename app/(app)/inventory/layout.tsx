import { ContextPanel, PanelSection, PanelLink, PanelDropdown } from '@/components/workspace/context-panel';
import { SectionShell } from '@/components/workspace/section-shell';

export default function SectionLayout({ children }: { children: React.ReactNode }) {
  return (
    <SectionShell
      panel={
      <ContextPanel title="Tasks">
        <PanelSection title="Tasks">
          <PanelDropdown title="Inventory tasks" defaultOpen>
            <PanelLink href="/inventory/new">New Inventory Item</PanelLink>
            <PanelLink href="/inventory/adjust">Adjust Stock Levels</PanelLink>
            <PanelLink href="/inventory/categories">Manage Categories</PanelLink>
          </PanelDropdown>
        </PanelSection>
        <PanelSection title="Reports">
          <PanelLink href="/reports?slug=inventory-valuation">Inventory Valuation</PanelLink>
          <PanelLink href="/reports?slug=low-stock">Low Stock Report</PanelLink>
        </PanelSection>
        <PanelSection title="Help Topics">
          <PanelLink href="/help/inventory">Managing Inventory</PanelLink>
        </PanelSection>
      </ContextPanel>
      }
    >
      {children}
    </SectionShell>
  );
}
