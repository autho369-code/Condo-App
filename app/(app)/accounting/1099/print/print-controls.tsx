'use client';

import { Button } from '@/components/ui/button';

/** Print/back toolbar — client-side because it uses window.print/history. */
export function PrintControls({ taxYear, vendorCount }: { taxYear: number; vendorCount: number }) {
  return (
    <div className="no-print mb-4 flex flex-col gap-3 border-b border-gray-200 bg-[#f6f7f9] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <div className="min-w-0">
        <h1 className="text-[15px] font-semibold tracking-[-0.01em] text-gray-950">
          Form 1099-NEC — Tax year {taxYear}
        </h1>
        <p className="text-[13px] text-gray-500">
          {vendorCount} vendor{vendorCount !== 1 ? 's' : ''} · Print on blank paper
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button onClick={() => window.print()}>Print all forms</Button>
        <Button variant="secondary" onClick={() => window.history.back()}>Back</Button>
      </div>
    </div>
  );
}
