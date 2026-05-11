import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { acceptInvitation } from '@/lib/auth/actions';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Editorial accept-invitation flow.
 *  - missing token  → polite empty state
 *  - signed-out     → present sign in / request access alongside the invitation
 *  - signed-in      → call acceptInvitation, then show success or error
 */
export default async function AcceptInvitationPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <Shell
        eyebrow="Invitation"
        title="No invitation token"
        italic="provided."
        body="The link you followed is missing its invitation token. Please check the message you received, or ask the person who invited you to send a new link."
      >
        <Link href="/">
          <Button size="md" variant="outline">Back to home</Button>
        </Link>
      </Shell>
    );
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const next = `/accept-invitation?token=${encodeURIComponent(token)}`;

  if (!user) {
    return (
      <Shell
        eyebrow="Invitation"
        title="You've been invited to"
        italic="Portier."
        body="Sign in or create an account first — we'll attach the invitation to your profile so you land in the right workspace."
      >
        <div className="flex flex-wrap gap-3">
          <Link href={`/login?next=${encodeURIComponent(next)}`}>
            <Button size="md" variant="primary">Sign in</Button>
          </Link>
          <Link href={`/request-access?next=${encodeURIComponent(next)}`}>
            <Button size="md" variant="outline">Create account</Button>
          </Link>
        </div>
      </Shell>
    );
  }

  // Authenticated — actually attempt acceptance
  const result = await acceptInvitation(token);

  if (result.error) {
    return (
      <Shell
        eyebrow="Invitation problem"
        title="We couldn't accept"
        italic="this invitation."
        body={result.error}
      >
        <div className="flex flex-wrap gap-3">
          <Link href="/dashboard"><Button size="md" variant="primary">Continue to workspace</Button></Link>
          <Link href="/"><Button size="md" variant="outline">Back to home</Button></Link>
        </div>
      </Shell>
    );
  }

  return (
    <Shell
      eyebrow="Welcome"
      title="You're in."
      italic="Welcome aboard."
      body="Your invitation was accepted and your account is ready. Step into your workspace whenever you'd like."
    >
      <Link href="/dashboard">
        <Button size="lg" variant="accent">Open your workspace →</Button>
      </Link>
    </Shell>
  );
}

// ---- internal layout primitive ---------------------------------------------

function Shell({
  eyebrow,
  title,
  italic,
  body,
  children,
}: {
  eyebrow: string;
  title: string;
  italic?: string;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-9">
      <header>
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-500">
          {eyebrow}
        </div>
        <h1 className="mt-3 font-display text-4xl tracking-editorial text-ink-900 md:text-5xl">
          {title}
          {italic && (
            <>
              {' '}
              <span className="italic text-champagne-700">{italic}</span>
            </>
          )}
        </h1>
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-ink-500">
          {body}
        </p>
      </header>

      <div className="rounded-lg border border-ink-100 bg-white p-7 shadow-soft-sm">
        {children}
      </div>
    </div>
  );
}
