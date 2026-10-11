'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { Alert } from '@/components/ui/shell';

// Shows a refused report run (queueReport redirects back with ?error=...)
// right above the run form.
export function ReportRunError() {
  const error = useSearchParams().get('error');
  if (!error) return null;
  return <Alert tone="danger" title="The report did not run.">{error}</Alert>;
}

// A run-form select whose starting value can come back in the URL after a
// refused run (?format=, ?unit=). The default value is used on the server
// and in the browser alike, so React's reset of the form after the action
// lands on the user's choice, not on the page default. Only a value that is
// one of `allowed` is taken from the URL.
export function ReportChoiceSelect({
  param,
  allowed,
  fallback,
  ...props
}: Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'defaultValue'> & {
  param: string;
  allowed: string[];
  fallback: string;
}) {
  const fromUrl = useSearchParams().get(param);
  const value = fromUrl && allowed.includes(fromUrl) ? fromUrl : fallback;
  return <select {...props} defaultValue={value} />;
}
