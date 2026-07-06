// Tab strip used across the Association detail pages.
// Active tab gets the blue underline matching the AppFolio screenshot.
import Link from 'next/link';
import { resolveAssociation } from '@/lib/associations/resolve';

const TABS = [
  { slug: 'profile',               label: 'Association' },
  { slug: 'units',                 label: 'Units' },
  { slug: 'board',                 label: 'Board of Directors' },
  { slug: 'approvals',             label: 'Approvals' },
  { slug: 'committees',            label: 'Committees' },
  { slug: 'architectural-reviews', label: 'Architectural Reviews' },
  { slug: 'budget',                label: 'Budget' },
  { slug: 'amenities',             label: 'Amenities' },
  { slug: 'payments',              label: 'Payments' },
] as const;

export type AssociationTabSlug = (typeof TABS)[number]['slug'];

export async function AssociationTabs({
  associationId,
  active,
}: {
  associationId: string;
  active: AssociationTabSlug;
}) {
  // associationId may be a UUID or a slug; always build links from the short
  // slug so the URL stays readable as the user moves between tabs.
  const ref = await resolveAssociation(associationId);
  const seg = ref?.slug ?? associationId;
  return (
    <nav className="mb-5 flex gap-5 overflow-x-auto border-b border-gray-200 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {TABS.map((tab) => {
        const href = `/associations/${seg}/${tab.slug}`;
        const on = tab.slug === active;
        return (
          <Link
            key={tab.slug}
            href={href}
            className={`-mb-px shrink-0 border-b-2 px-1 pb-2.5 text-[13px] whitespace-nowrap transition-colors ${
              on
                ? 'border-gray-950 font-semibold text-gray-950'
                : 'border-transparent font-medium text-gray-500 hover:border-gray-300 hover:text-gray-900'
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
