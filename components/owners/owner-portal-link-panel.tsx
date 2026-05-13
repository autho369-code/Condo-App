'use client';

import { useActionState } from 'react';

import {
  generateOwnerPortalAccessLink,
  initialOwnerPortalLinkState,
} from '@/lib/auth/owner-portal-link-actions';
import type { OwnerPortalStatus } from '@/lib/auth/owner-portal';

function linkLabel(kind: 'invite' | 'recovery' | null) {
  return kind === 'invite' ? 'Sign-up link' : 'Password reset link';
}

export function OwnerPortalLinkPanel({
  ownerId,
  status,
}: {
  ownerId: string;
  status: OwnerPortalStatus;
}) {
  const [state, action, pending] = useActionState(generateOwnerPortalAccessLink, initialOwnerPortalLinkState);
  const canGenerate = status !== 'missing_email';
  const buttonLabel = status === 'needs_invite' ? 'Show sign-up link' : 'Show reset link';

  return (
    <div className="space-y-3 rounded border border-ink-100 bg-cream-50 p-3">
      <form action={action}>
        <input type="hidden" name="owner_id" value={ownerId} />
        <button
          type="submit"
          disabled={!canGenerate || pending}
          className="inline-flex h-9 items-center rounded-md border border-ink-300 bg-white px-3 text-sm font-medium text-ink-800 hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? 'Creating link...' : buttonLabel}
        </button>
      </form>

      {state.error && (
        <div className="rounded border border-bordeaux-200 bg-bordeaux-50 px-3 py-2 text-xs text-bordeaux-700">
          {state.error}
        </div>
      )}

      {state.ok && state.actionLink && (
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-500">
            {linkLabel(state.kind)} for {state.email}
          </div>
          <textarea
            readOnly
            value={state.actionLink}
            rows={3}
            className="w-full resize-none rounded border border-ink-200 bg-white px-3 py-2 font-mono text-xs text-ink-800"
            onFocus={(event) => event.currentTarget.select()}
          />
          <div className="text-xs text-ink-500">
            Select the link to copy it. Supabase auth links expire, so send it soon after generating.
          </div>
        </div>
      )}
    </div>
  );
}
