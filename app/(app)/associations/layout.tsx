// Section layout for /associations.
// Wraps every page under /associations (list, /[id]/units, /[id]/board, etc.)
// with a right-side ContextPanel whose content swaps based on the current URL.
//
// All other sections of the app (/dashboard, /owners, /units, /work-orders,
// /bills) have their own per-section layouts already, so this file ONLY
// affects /associations and does not interfere with them.
import { AssociationsPanel } from './_panel';
import { SectionShell } from '@/components/workspace/section-shell';

export default function AssociationsLayout({ children }: { children: React.ReactNode }) {
  return (
    <SectionShell panel={<AssociationsPanel />}>{children}</SectionShell>
  );
}
