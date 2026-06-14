import Link from 'next/link';
import { LifeBuoy } from 'lucide-react';

export const dynamic = 'force-dynamic';

// Fallback for any /help/* article that doesn't have a dedicated page yet, so
// in-app help links never 404. Specific routes (e.g. /help/settings) take
// precedence over this catch-all.
export default async function HelpFallbackPage({ params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug } = await params;
  const topic = (slug ?? []).join(' / ').replace(/-/g, ' ');

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-50 ring-1 ring-inset ring-gray-200/70">
        <LifeBuoy className="h-7 w-7 text-gray-400" />
      </div>
      <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-gray-950">Help center coming soon</h1>
      {topic && <p className="mt-1.5 text-sm capitalize text-gray-500">Topic: {topic}</p>}
      <p className="mt-3 text-sm leading-6 text-gray-500">
        We&apos;re still writing this help article. In the meantime, reach our team and we&apos;ll walk you through it.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <a href="mailto:hello@portier369.com" className="inline-flex h-10 items-center rounded-xl bg-gray-950 px-4 text-sm font-medium text-white hover:bg-gray-800">Contact support</a>
        <Link href="/dashboard" className="inline-flex h-10 items-center rounded-xl border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50">Back to dashboard</Link>
      </div>
    </div>
  );
}
