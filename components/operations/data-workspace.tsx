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
    <div className="min-h-full bg-gray-50">
      <main data-workspace-main className="px-8 py-6">
        <div className="mb-6 flex items-start justify-between gap-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-950">{title}</h1>
            {description && <p className="mt-1 max-w-3xl text-sm text-gray-500">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
        {children}
      </main>
    </div>
  );
}
