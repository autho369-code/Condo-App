'use client';

import { ApplicationError } from '@/components/errors/application-error';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ApplicationError error={error} reset={reset} />;
}
