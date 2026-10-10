'use client';

import { useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { Alert } from '@/components/ui/shell';

// Shows a refused report run (queueReport redirects back with ?error=...)
// right above the run form, and puts back the output format and unit the
// user had chosen. The server page already restores scope, association,
// period and account from the same URL; these two selects have no server
// default from the URL, so they are set here, and only to an option the
// select really has.
export function ReportRunError() {
  const params = useSearchParams();
  const error = params.get('error');
  const anchor = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!error) return;
    const form = anchor.current?.closest('form');
    if (!form) return;
    for (const [param, name] of [['format', 'output_format'], ['unit', 'param_unit_id']] as const) {
      const value = params.get(param);
      const select = form.querySelector<HTMLSelectElement>(`select[name="${name}"]`);
      if (value && select && [...select.options].some((o) => o.value === value)) select.value = value;
    }
  }, [error, params]);

  if (!error) return null;
  return (
    <>
      <span ref={anchor} hidden />
      <Alert tone="danger" title="The report did not run.">{error}</Alert>
    </>
  );
}
