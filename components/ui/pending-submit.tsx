'use client';

import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import type { ComponentProps } from 'react';

/**
 * A submit button that disables itself while its form is being sent, so a
 * double click submits once. Pass `confirm` to ask before a destructive action.
 */
export function PendingSubmit({ children, pendingLabel, disabled, variant, size, className, confirm, 'aria-label': ariaLabel }: { children: React.ReactNode; pendingLabel?: string; disabled?: boolean; variant?: ComponentProps<typeof Button>['variant']; size?: ComponentProps<typeof Button>['size']; className?: string; confirm?: string; 'aria-label'?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant={variant}
      size={size}
      className={className}
      aria-label={ariaLabel}
      disabled={disabled || pending}
      aria-disabled={disabled || pending}
      onClick={confirm ? (event) => {
        // Let the browser's own validation speak first: never ask to confirm
        // a submission that can't go through (e.g. a required field empty).
        const form = event.currentTarget.form;
        if (form && !form.noValidate && !form.checkValidity()) { event.preventDefault(); form.reportValidity(); return; }
        if (!window.confirm(confirm)) event.preventDefault();
      } : undefined}
    >
      {pending ? pendingLabel ?? 'Working…' : children}
    </Button>
  );
}
