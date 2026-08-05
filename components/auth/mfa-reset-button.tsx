'use client';

import { Button } from '@/components/ui/button';

export function MfaResetButton({
  action,
  userId,
  variant = 'secondary',
}: {
  action: (formData: FormData) => Promise<void>;
  userId: string;
  variant?: 'secondary' | 'ghost';
}) {
  return (
    <form action={action}>
      <input type="hidden" name="user_id" value={userId} />
      <input type="hidden" name="manager_id" value={userId} />
      <Button
        type="submit"
        variant={variant}
        size={variant === 'ghost' ? 'sm' : 'md'}
        onClick={(event) => {
          if (!window.confirm('Reset this user’s authenticator? They will need to enroll a new one before accessing protected areas.')) {
            event.preventDefault();
          }
        }}
      >
        Reset MFA
      </Button>
    </form>
  );
}
