// Section layout for /associations.
// Wraps every page under /associations (list, /[id]/units, /[id]/board, etc.)
// with a right-side ContextPanel whose content swaps based on the current URL.
//
// All other sections of the app (/dashboard, /owners, /units, /work-orders,
// /bills) have their own per-section layouts already, so this file ONLY
// affects /associations and does not interfere with them.
import { AssociationsPanel } from './_panel';

export default function AssociationsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full">
      <div className="flex-1 overflow-hidden min-w-0">{children}</div>
      <AssociationsPanel />
    </div>
  );
}
