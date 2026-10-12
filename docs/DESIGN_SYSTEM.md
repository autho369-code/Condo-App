# Portier369 Design System v2
*Single visual language for all 200+ pages. Last updated 2026-06-10.*

## Identity
Calm, professional operations software. Light surfaces, dark ink, one accent.
The login page (`app/(auth)/login/page.tsx`) is the aesthetic reference:
soft layered shadows, generous radii, tight letter-spacing on headings.

## Tokens
| Token | Value |
|---|---|
| Page background | `#f6f7f9` |
| Card surface | white, `border-gray-200/70`, `rounded-2xl`, shadow `0_1px_2px_rgba(16,24,40,0.04)` |
| Ink / headings | `text-gray-950`, tracking `-0.02em` |
| Body text | `text-sm text-gray-600` (13-14px) |
| Muted | `text-gray-500` / hints `text-gray-400` |
| Primary action | `bg-gray-950 text-white hover:bg-gray-800` |
| Accent / focus | `blue-600`, focus ring `ring-blue-500/20` |
| Sidebar | `#060709`, items `#8a8a93` -> active `#16161a`/`#f4f4f5` |
| Radii | controls `rounded-lg` (8px) - cards `rounded-2xl` (16px) - badges `rounded-full` |
| Font | Inter (next/font), tabular-nums for all money/counts |

Status colors come ONLY from `Badge` (`components/ui/shell.tsx`, `toneForStatus`)
or `StatusChip` (`components/operations/status-chip.tsx`). Never hand-pick status colors.

## Component kit — use these, nothing else

### Page scaffolding
- `PageShell` + `PageHeader` (+ `Breadcrumb`) — `components/ui/shell.tsx` — standalone pages.
- `DataWorkspace` — `components/operations/data-workspace.tsx` — list pages
  with metrics + filters (title/description/actions built in).
- `Workspace` + `WorkspaceHeader` + `Section` — `components/workspace/shell.tsx`
  — detail pages (white header band over gray body, sectioned cards).
- `AssociationTabs` — `components/associations/tabs.tsx` — tab strip pattern
  (copy for other tabbed entities; scrollable on mobile).

### Content
- `Surface`, `SectionTitle`, `MetricStrip`/`Metric`, `EmptyState`, `Alert`,
  `Badge` — `components/ui/shell.tsx`
- `MetricStrip` (data-driven variant) — `components/operations/metric-strip.tsx`
- `StatTile` — `components/ui/stat-tile.tsx` — one figure in a dashboard
  grid that needs a tone (danger/warning/success), an icon or a whole-tile
  link. Use `MetricStrip`/`Metric` for plain list-page summary strips.
  Smaller value and no icon on phones, so amounts fit a 2-column grid.
- `DataTable` / `Table,THead,TR,TH,TD` — `components/ui/table.tsx`
- `FilterBar` + `FilterSelect` — `components/operations/filter-bar.tsx`

### Forms
- `NoCompanyNotice` (`components/workspace/no-company-notice.tsx`) — what a
  company page shows an account with no company (a platform operator)
  instead of crashing: `if (!me.portfolio?.id) return <NoCompanyNotice
  title="…page title…" operator={me.is_platform_operator} />`, wrapped in the
  page's own container (`PageShell` in `app/(app)`).
- `Button` (primary/secondary/ghost/danger/link) — `components/ui/button.tsx`
  — a link that looks like a button is `<Link className={buttonClass('primary', 'md')}>`;
  never put a `Button` inside a `Link` (a button inside a link is invalid HTML)
- `CopyButton` — `components/ui/copy-button.tsx` — copy a link or value; says
  "Copied" or "Copy failed" (show the value selectable next to it).
- `Input`, `Select`, `Textarea`, `Label`, `Field` — `components/ui/input.tsx`
- `VendorSelect` — `components/vendors/vendor-select.tsx` — every vendor
  picker. Offers only one association's vendors (fixed `associationId`, or
  the form's `association_id` field) plus the management company. Put the
  association field before the vendor field.
- `OwnerSelect` — `components/owners/owner-select.tsx` — staff owner picker.
  One person has one owner record per association: it follows the form's
  `association_id` field and offers only that association's owners (before
  one is chosen, pass `associationNames` so each option names its
  association). Put the association field before the owner field.
- `SegmentedLinks` / `SegmentedButtons` — `components/ui/segmented.tsx` —
  every pill switcher: links for choices that are URLs (filters, aria-current),
  buttons for choices handled in the page (views, tabs; aria-pressed). 40px
  pills, the current one filled. Not for section navigation (that is
  `AssociationTabs`).
- `RecordSwitcher` — `components/ui/record-switcher.tsx` — portal pages that
  work on one record at a time (insurance, contact details, vendor
  compliance): `SegmentedLinks` to `?record=<id>`, shown only when the login
  has 2+ records.
- Forms live inside `Surface`; one column on mobile, `sm:grid-cols-2` where
  fields pair naturally; primary action bottom-left, `Button` md size.
- `Field` ties its label to its control: a single `Input`/`Select`/`Textarea`
  child is wrapped in the label (no id needed); with several controls pass
  `htmlFor` + an `id` on the one it names. A bare `<label>` needs `htmlFor`
  (`npm run lint` checks).

## Page recipes

### List page
```tsx
<DataWorkspace title="Vendors" description="..." actions={<Link href="/vendors/new" className={buttonClass()}><Plus className="h-4 w-4"/> New vendor</Link>}>
  <MetricStrip metrics={[...]} />
  <div className="mt-5"><FilterBar action="/vendors" searchPlaceholder="Search vendors">...</FilterBar></div>
  <div className="mt-4"><DataTable ... empty={<EmptyState .../>} /></div>
</DataWorkspace>
```

### Detail page
```tsx
<Workspace header={<WorkspaceHeader eyebrow="Vendor" title={v.name} subtitle={...} actions={...} />}>
  <Section title="Contact" padded>...</Section>
  <Section title="Compliance" padded>...</Section>
</Workspace>
```

## Mobile rules (every page)
- Headers stack (`flex-col sm:flex-row`) — handled by shared headers.
- Tables: wrapped in `overflow-x-auto` (handled by `Table`); prefer fewer
  columns + stacked secondary text over wide grids.
- Touch targets >= 40px (`h-10` controls).
- Tasks rail: hidden < xl, floating button opens slide-over (already global).
- Never fixed pixel page widths; max-width container lives in the shells.

## Anti-patterns (instant rejection)
- Zebra-striped tables, raw `<table>` markup, `text-blue-600 hover:underline`
  links as primary navigation, `bg-gray-950` page backgrounds in the manager
  app, uppercase form labels, `rounded` (4px) cards, multiple h1 sizes on one
  page, new shadow values, inline hex colors.
