'use client';

import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import type { ComponentProps } from 'react';

/** A submit button that disables itself while its form is being sent, so a double click submits once. */
export function PendingSubmit({ children, pendingLabel, disabled, variant, size }: { children: React.ReactNode; pendingLabel?: string; disabled?: boolean; variant?: ComponentProps<typeof Button>['variant']; size?: ComponentProps<typeof Button>['size'] }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} size={size} disabled={disabled || pending} aria-disabled={disabled || pending}>
      {pending ? pendingLabel ?? 'Working…' : children}
    </Button>
  );
}
