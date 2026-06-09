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
    <div className={`min-h-full ${className}`}>
      {children}
    </div>
  );
}
