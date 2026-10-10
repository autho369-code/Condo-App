import * as React from 'react';
import { PageHeader } from '@/components/ui/shell';

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
    <div className="min-h-full bg-canvas">
      <main data-workspace-main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <PageHeader title={title} description={description} actions={actions} />
        {children}
      </main>
    </div>
  );
}
