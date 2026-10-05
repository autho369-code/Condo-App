'use client';

import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import type { ComponentProps } from 'react';

/**
 * A submit button that disables itself while its form is being sent, so a
 * double click submits once. Pass `confirm` to ask before a destructive action.
 */
export function PendingSubmit({ children, pendingLabel, disabled, variant, size, className, confirm }: { children: React.ReactNode; pendingLabel?: string; disabled?: boolean; variant?: ComponentProps<typeof Button>['variant']; size?: ComponentProps<typeof Button>['size']; className?: string; confirm?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant={variant}
      size={size}
      className={className}
      disabled={disabled || pending}
      aria-disabled={disabled || pending}
      onClick={confirm ? (event) => { if (!window.confirm(confirm)) event.preventDefault(); } : undefined}
    >
      {pending ? pendingLabel ?? 'Working…' : children}
    </Button>
  );
}
