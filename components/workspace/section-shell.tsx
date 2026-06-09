import * as React from 'react';

export function SectionShell({
  children,
  panel,
  className = '',
}: {
  children: React.ReactNode;
  panel: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-[#f5f6f8] min-h-full ${className}`}>
      <div className="px-6 py-4">
        {children}
      </div>
    </div>
  );
}
