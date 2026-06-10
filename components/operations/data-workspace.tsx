import * as React from 'react';

export function DataWorkspace({
  title,
  description,
  actions,
  children,
  rail,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  rail?: React.ReactNode;
}) {
  return (
    <div className="min-h-full bg-[#f7f7f8]">
      <main data-workspace-main className="px-8 py-6">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
          <div className="min-w-0">
            <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950">{title}</h1>
            {description && <p className="mt-1.5 max-w-3xl text-[13px] leading-6 text-gray-500">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
        {children}
      </main>
    </div>
  );
}
