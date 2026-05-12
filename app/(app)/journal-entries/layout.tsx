import { ContextPanel, PanelSection, PanelLink } from '@/components/workspace/context-panel';

export default function SectionLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full">
      <div className="flex-1 overflow-hidden min-w-0">{children}</div>
      <ContextPanel title="Tasks">
        <PanelSection title="Tasks">
          <PanelLink href="/journal-entries/new">New Journal Entry</PanelLink>
          <PanelLink href="/journal-entries/post-gpr" status="placeholder">Post GPR</PanelLink>
          <PanelLink href="/journal-entries/recurring/new" status="placeholder">New Recurring Journal Entry</PanelLink>
          <PanelLink href="/journal-entries/batches/new" status="placeholder">Upload Journal Entry Batch</PanelLink>
          <PanelLink href="/journal-entries/batches" status="placeholder">View Journal Entry Batches</PanelLink>
          <PanelLink href="/journal-entries/post" status="placeholder">Manually Post Journal Entries</PanelLink>
        </PanelSection>
        <PanelSection title="Reports">
          <PanelLink href="/reports?slug=general-ledger">General Ledger</PanelLink>
          <PanelLink href="/reports?slug=gross-potential-rent">Gross Potential Rent</PanelLink>
          <PanelLink href="/reports?slug=journal-entry-register">Journal Entry Register</PanelLink>
        </PanelSection>
      </ContextPanel>
    </div>
  );
}
