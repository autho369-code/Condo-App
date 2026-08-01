import Link from 'next/link';
import { ArrowLeft, ArrowRight, CheckCircle2, LifeBuoy } from 'lucide-react';
import { notFound } from 'next/navigation';
import { requireStaff } from '@/lib/auth/me';
import { getHelpArticle } from '@/lib/help/articles';

export const dynamic = 'force-dynamic';

export default async function HelpArticlePage({ params }: { params: Promise<{ slug?: string[] }> }) {
  await requireStaff();
  const { slug } = await params;
  const article = slug?.length === 1 ? getHelpArticle(slug[0]) : undefined;

  if (!article) notFound();

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-10 sm:py-16">
      <article className="mx-auto max-w-3xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-6 py-7 sm:px-10 sm:py-9">
          <Link href="/associations" className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-900">
            <ArrowLeft className="h-4 w-4" />
            Back to associations
          </Link>
          <div className="mt-7 flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-950 text-white">
            <LifeBuoy className="h-6 w-6" />
          </div>
          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">Portier help</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-gray-950">{article.title}</h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-gray-600">{article.summary}</p>
        </div>

        <div className="px-6 py-8 sm:px-10 sm:py-10">
          <h2 className="text-base font-semibold text-gray-950">Recommended workflow</h2>
          <ol className="mt-5 space-y-5">
            {article.steps.map((step, index) => (
              <li key={step} className="flex gap-4">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Step {index + 1}</p>
                  <p className="mt-1 text-sm leading-6 text-gray-700">{step}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-9 flex flex-wrap items-center gap-3 border-t border-gray-100 pt-7">
            <Link href={article.action.href} className="inline-flex h-10 items-center gap-2 rounded-xl bg-gray-950 px-4 text-sm font-medium text-white hover:bg-gray-800">
              {article.action.label}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a href="mailto:hello@portier369.com" className="inline-flex h-10 items-center rounded-xl border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Contact support
            </a>
          </div>
        </div>
      </article>
    </main>
  );
}
