'use client';

import { useSearchParams } from 'next/navigation';
import { Alert } from '@/components/ui/shell';

// Shows a refused report run (queueReport redirects back with ?error=...)
// right above the run form, so the user can fix the choice and run again.
export function ReportRunError() {
  const error = useSearchParams().get('error');
  if (!error) return null;
  return <Alert tone="danger" title="The report did not run.">{error}</Alert>;
}
