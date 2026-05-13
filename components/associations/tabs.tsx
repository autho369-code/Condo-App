// Tab strip used across the Association detail pages.
// Active tab gets the blue underline matching the AppFolio screenshot.
import Link from 'next/link';

const TABS = [
  { slug: 'profile',               label: 'Association' },
  { slug: 'units',                 label: 'Units' },
  { slug: 'board',                 label: 'Board of Directors' },
  { slug: 'approvals',             label: 'Approvals' },
  { slug: 'committees',            label: 'Committees' },
  { slug: 'architectural-reviews', label: 'Architectural Reviews' },
  { slug: 'budget',                label: 'Budget' },
  { slug: 'amenities',             label: 'Amenities' },
  { slug: 'documents',             label: 'Documents' },
] as const;

export type AssociationTabSlug = (typeof TABS)[number]['slug'];

export function AssociationTabs({
  associationId,
  active,
}: {
  associationId: string;
  active: AssociationTabSlug;
}) {
  return (
    <nav className="mb-5 flex gap-6 border-b border-ink-100">
      {TABS.map((tab) => {
        const href = `/associations/${associationId}/${tab.slug}`;
        const on = tab.slug === active;
        return (
          <Link
            key={tab.slug}
            href={href}
            className={`border-b-2 px-1 pb-2 text-sm whitespace-nowrap transition ${
              on
                ? 'border-brand-600 font-semibold text-brand-700'
                : 'border-transparent text-ink-600 hover:text-ink-900'
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
