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
    <div className="flex h-full bg-[#060B18]">
      <main className="min-w-0 flex-1 overflow-y-auto px-8 py-8">
        <div className="mb-8 flex items-start justify-between gap-6">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">{title}</h1>
            {description && <p className="mt-2 max-w-xl text-sm text-slate-400 leading-relaxed">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
        {children}
      </main>
      {rail && <aside className="w-80 shrink-0 overflow-y-auto border-l border-slate-800 bg-[#0B1121] p-5">{rail}</aside>}
    </div>
  );
}
