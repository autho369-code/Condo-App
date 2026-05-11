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
    <div className="flex h-full bg-cream-50">
      <main data-workspace-main className="min-w-0 flex-1 overflow-y-auto px-8 py-6">
        <div className="mb-6 flex items-start justify-between gap-6">
          <div>
            <h1 className="text-2xl font-semibold text-ink-900">{title}</h1>
            {description && <p className="mt-1 max-w-3xl text-sm text-ink-500">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
        {children}
      </main>
      {rail && <aside data-workspace-rail className="w-80 shrink-0 overflow-y-auto border-l border-ink-100 bg-white p-5">{rail}</aside>}
    </div>
  );
}
