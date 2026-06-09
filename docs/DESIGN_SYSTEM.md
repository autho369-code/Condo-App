# Portier369 Design System v1

## Application Shell

Two-panel layout on every page:

```
┌──────────┬────────────────────────────────────────────┐
│          │                                            │
│  NAV     │              CONTENT AREA                  │
│  (dark)  │              (light)                       │
│          │                                            │
│  224px   │              flex-1                        │
│          │                                            │
└──────────┴────────────────────────────────────────────┘
```

- **Left nav:** Fixed 224px dark sidebar (#060709 bg). Never changes. Contains 13 grouped sections.
- **Content:** Light background (#f5f6f8). Full remaining width. Scrollable independently.
- **No third sidebar.** Pages that need a context panel render it inline within the content area.

---

## Sidebar

- **Background:** #060709
- **Borders:** rgba(255,255,255,0.06)
- **Section headers:** 11px, uppercase, tracking-wider, #52525b
- **Nav items:** 13px, font-weight 500, #6b6b72 default → #e4e4e7 active/hover
- **Active state:** bg #111114, text #e4e4e7
- **Height:** 34px per item
- **Padding:** 0 12px
- **Radius:** none (flat items)
- **Collapsed:** 52px wide, icon-only

---

## Tables

All data tables across the application use these rules:

- **Container:** bg-white, rounded-lg, border border-gray-200, overflow-hidden
- **Header row:** bg-gray-50, border-b border-gray-100
- **Header text:** 11px, font-medium, text-gray-500, uppercase, tracking-wide
- **Data rows:** border-b border-gray-50 last:border-0
- **Row hover:** bg-gray-50
- **Cell padding:** px-4 py-2.5
- **Cell text:** 13px, text-gray-900 (primary), text-gray-500 (secondary)
- **Status badges:** 11px font-medium, px-2 py-0.5 rounded border
  - Open/Active: bg-red-50 text-red-700 border-red-200
  - In Progress: bg-blue-50 text-blue-700 border-blue-200
  - Pending: bg-amber-50 text-amber-700 border-amber-200
  - Complete: bg-emerald-50 text-emerald-700 border-emerald-200
  - Waiting: bg-purple-50 text-purple-700 border-purple-200
  - Inactive: bg-gray-50 text-gray-400 border-gray-200
- **Empty state:** py-8 text-center text-xs text-gray-400
- **Section header:** text-xs font-semibold text-gray-700 uppercase tracking-wide, px-4 py-2.5 border-b border-gray-100

---

## Forms

All forms use these rules:

- **Container:** bg-white rounded-lg border border-gray-200 p-5
- **Max width:** max-w-3xl (constrained, not full-width)
- **Section spacing:** space-y-5
- **Label:** text-sm font-medium text-gray-700
- **Input:** h-10 w-full rounded border border-gray-300 bg-white px-3 text-sm
- **Select:** h-10 w-full rounded border border-gray-300 bg-white px-3 text-sm
- **Textarea:** w-full rounded border border-gray-300 px-3 py-2 text-sm
- **Grid:** grid gap-4 md:grid-cols-2 (for field pairs)
- **Actions:** flex justify-end gap-2 pt-4 border-t border-gray-100
- **Focus:** border-blue-500 ring-1 ring-blue-500

---

## Buttons

- **Primary:** bg-gray-900 text-white px-4 h-10 rounded-lg text-sm font-medium hover:bg-gray-800
- **Secondary:** bg-white text-gray-700 px-4 h-10 rounded-lg text-sm font-medium border border-gray-300 hover:bg-gray-50
- **Danger:** bg-red-600 text-white px-4 h-10 rounded-lg text-sm font-medium hover:bg-red-700
- **Ghost:** text-gray-600 px-3 h-8 rounded text-sm hover:bg-gray-100
- **Link:** text-blue-600 text-sm font-medium hover:text-blue-800 (no background, no border)
- **Small:** h-8 px-3 text-xs

---

## Modals

- **Backdrop:** fixed inset-0 bg-black/50 z-50
- **Panel:** bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 p-6
- **Title:** text-lg font-semibold text-gray-900
- **Body:** text-sm text-gray-600 mt-2
- **Actions:** flex justify-end gap-2 mt-6

---

## Typography

- **Font:** Inter (from next/font/google)
- **Page titles:** 18px font-semibold text-gray-900 tracking-[-0.02em]
- **Section headings:** 13px font-semibold text-gray-900
- **Body:** 13px text-gray-700
- **Secondary:** 12px text-gray-500
- **Muted:** 11px text-gray-400
- **Metric values:** 28px font-bold text-gray-900 tabular-nums

---

## Spacing & Layout

- **Page padding:** px-6 py-4
- **Content max-width:** max-w-full (use full width)
- **Section gap:** space-y-3 (between major sections)
- **Card padding:** p-4 (compact), p-5 (standard)
- **Grid columns:** grid-cols-1, md:grid-cols-2, lg:grid-cols-3 (as needed)
- **Metric strip:** grid grid-cols-6 gap-3

---

## Color System

### Light Theme (Content Area)
- **Page bg:** #f5f6f8
- **Card bg:** #ffffff
- **Border:** #e5e7eb (gray-200)
- **Border subtle:** #f3f4f6 (gray-100)
- **Text primary:** #111827 (gray-900)
- **Text secondary:** #6b7280 (gray-500)
- **Text muted:** #9ca3af (gray-400)
- **Link:** #2563eb (blue-600)

### Dark Theme (Sidebar Only)
- **Sidebar bg:** #060709
- **Sidebar border:** #111114
- **Nav text:** #6b6b72 → #e4e4e7 (hover/active)
- **Section headers:** #52525b
- **Active bg:** #111114

---

## Page Structure

Every page must follow this structure:

```tsx
export default async function Page() {
  // Server-side data fetching
  const data = await fetchData();

  return (
    <div className="bg-[#f5f6f8] min-h-full">
      <div className="px-6 py-4 space-y-4">
        {/* Page header */}
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-900 tracking-[-0.02em]">Page Title</h1>
          <div className="flex items-center gap-2">
            {/* Action buttons */}
          </div>
        </div>

        {/* Content sections */}
        {/* Tables, forms, cards — all using the design system */}
      </div>
    </div>
  );
}
```
