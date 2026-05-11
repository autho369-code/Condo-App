import * as React from 'react';

export function SectionShell({
  children,
  panel,
  className = 'bg-gray-50',
}: {
  children: React.ReactNode;
  panel: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex h-screen overflow-hidden ${className}`}>
      <div className="min-w-0 flex-1 overflow-auto">
        <div className="h-full min-w-[760px] [&_[data-workspace-rail]]:hidden">
          {children}
        </div>
      </div>
      {panel}
    </div>
  );
}
