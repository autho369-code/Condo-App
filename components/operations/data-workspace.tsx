import * as React from 'react';

export function DataWorkspace({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  rail?: React.ReactNode; // accepted but ignored — OperationsPanel handles right panel
}) {
  return (
    <div className="bg-[#f5f6f8] min-h-full">
      <div className="px-6 py-4">
        <div className="mb-4 flex items-start justify-between gap-6">
          <div>
            <h1 className="text-lg font-semibold text-gray-900 tracking-[-0.02em]">{title}</h1>
            {description && <p className="mt-0.5 text-xs text-gray-500">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
        {children}
      </div>
    </div>
  );
}
