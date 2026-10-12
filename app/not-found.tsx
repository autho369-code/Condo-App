import Link from 'next/link';
import { headers } from 'next/headers';
import { SearchX } from 'lucide-react';
import { buttonClass } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/shell';
import { workspaceMetadata } from '@/lib/tenant/metadata';

// On a company's address the tab carries the company's name, not ours.
export async function generateMetadata() {
  return { ...(await workspaceMetadata()), title: 'Page not found' };
}

// Rendered per request (headers() below) so it gets this request's script
// nonce; a prerendered 404 would have its scripts blocked by the enforced
// Content Security Policy (lib/server/csp.ts).
export default async function NotFound() {
  await headers();
  return (
    <main className="flex min-h-[60vh] items-center justify-center px-4">
      <h1 className="sr-only">Page not found</h1>
      <EmptyState
        icon={SearchX}
        title="Page not found"
        description="The page you opened does not exist or has moved."
        action={<Link href="/" className={buttonClass()}>Go to the home page</Link>}
      />
    </main>
  );
}
