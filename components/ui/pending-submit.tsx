'use client';

import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import type { ComponentProps } from 'react';

/** A submit button that disables itself while its form is being sent, so a double click submits once. */
export function PendingSubmit({ children, pendingLabel, disabled, variant }: { children: React.ReactNode; pendingLabel?: string; disabled?: boolean; variant?: ComponentProps<typeof Button>['variant'] }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} disabled={disabled || pending} aria-disabled={disabled || pending}>
      {pending ? pendingLabel ?? 'Working…' : children}
    </Button>
  );
}
