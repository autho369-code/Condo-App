import * as React from 'react';

export function FilterBar({
  action,
  children,
  searchName = 'q',
  searchDefault = '',
  searchPlaceholder = 'Search',
}: {
  action: string;
  children?: React.ReactNode;
  searchName?: string;
  searchDefault?: string;
  searchPlaceholder?: string;
}) {
  return (
    <form action={action} className="flex flex-wrap items-end gap-3 rounded border border-gray-200 bg-white p-3">
      <label className="min-w-64 flex-1 text-xs font-medium uppercase text-slate-400">
        Search
        <input
          name={searchName}
          defaultValue={searchDefault}
          placeholder={searchPlaceholder}
          className="mt-1 h-9 w-full rounded border border-gray-300 px-3 text-sm normal-case text-gray-900"
        />
      </label>
      {children}
      <button type="submit" className="h-9 rounded bg-gray-950 px-4 text-sm font-medium text-white">
        Apply
      </button>
    </form>
  );
}
