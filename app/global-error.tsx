'use client';

import { ApplicationError } from '@/components/errors/application-error';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="font-sans">
        <ApplicationError error={error} reset={reset} />
      </body>
    </html>
  );
}
