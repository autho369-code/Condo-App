import * as React from 'react';
import { Search } from 'lucide-react';

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
    <form
      action={action}
      className="flex flex-wrap items-end gap-3 rounded-2xl border border-gray-200/70 bg-white p-3 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:p-4"
    >
      <div className="relative min-w-0 flex-1 basis-56">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          name={searchName}
          defaultValue={searchDefault}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          className="h-10 w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
        />
      </div>
      {children}
      <button
        type="submit"
        className="h-10 rounded-lg bg-gray-950 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-gray-800"
      >
        Apply
      </button>
    </form>
  );
}

/** Labeled select for use inside FilterBar. */
export function FilterSelect({
  label,
  name,
  defaultValue,
  children,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="text-[12px] font-medium text-gray-500">
      {label}
      <select
        name={name}
        defaultValue={defaultValue}
        className="mt-1 block h-10 min-w-36 cursor-pointer rounded-lg border border-gray-300 bg-white px-3 text-sm font-normal text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
      >
        {children}
      </select>
    </label>
  );
}
