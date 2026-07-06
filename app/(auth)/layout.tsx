import Link from 'next/link';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[#060709]">
      {/* Brand panel — hidden on mobile */}
      <aside className="relative hidden w-[44%] flex-col justify-between overflow-hidden p-12 lg:flex">
        {/* Ambient glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-40 -left-40 h-[560px] w-[560px] rounded-full opacity-[0.13]"
          style={{ background: 'radial-gradient(circle, #6d8dff 0%, transparent 70%)' }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-56 -right-24 h-[480px] w-[480px] rounded-full opacity-[0.07]"
          style={{ background: 'radial-gradient(circle, #c9a86a 0%, transparent 70%)' }}
        />
        {/* Hairline grid texture */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)',
            backgroundSize: '88px 88px',
          }}
        />

        {/* Brand mark */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 bg-white/[0.06] text-[15px] font-semibold tracking-tight text-white">
            P
          </div>
          <span className="text-[15px] font-semibold tracking-[-0.01em] text-white">
            Portier369
          </span>
        </div>

        {/* Statement */}
        <div className="relative z-10 max-w-md">
          <h2 className="text-[34px] font-semibold leading-[1.15] tracking-[-0.025em] text-white">
            White-glove operations for every association.
          </h2>
          <p className="mt-4 text-[15px] leading-7 text-zinc-400">
            Accounting, maintenance, violations, and reporting — handled with the
            precision your owners and boards expect.
          </p>

          <dl className="mt-10 grid grid-cols-3 gap-6 border-t border-white/[0.08] pt-8">
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-[0.12em] text-zinc-500">
                Associations
              </dt>
              <dd className="mt-1 text-[22px] font-semibold tabular-nums tracking-tight text-white">
                Unlimited
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-[0.12em] text-zinc-500">
                Accounting
              </dt>
              <dd className="mt-1 text-[22px] font-semibold tabular-nums tracking-tight text-white">
                Full GL
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-[0.12em] text-zinc-500">
                Portals
              </dt>
              <dd className="mt-1 text-[22px] font-semibold tabular-nums tracking-tight text-white">
                3 roles
              </dd>
            </div>
          </dl>
        </div>

        {/* Staff entry points + footer line */}
        <div className="relative z-10 space-y-5">
          <div className="flex flex-wrap gap-2">
            <Link
              href="/login?mode=admin"
              className="inline-flex h-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] px-4 text-[13px] font-medium text-zinc-300 transition-colors hover:border-white/20 hover:bg-white/[0.07] hover:text-white"
            >
              Operator
            </Link>
            <Link
              href="/login?mode=company_admin"
              className="inline-flex h-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] px-4 text-[13px] font-medium text-zinc-300 transition-colors hover:border-white/20 hover:bg-white/[0.07] hover:text-white"
            >
              Company Admin
            </Link>
          </div>
          <p className="text-[12px] text-zinc-600">
            The operating system for community management.
          </p>
        </div>
      </aside>

      {/* Auth panel */}
      <main className="flex flex-1 items-center justify-center bg-[#f7f7f8] px-4 py-10 sm:px-8">
        <div className="w-full max-w-[420px]">
          {/* Mobile brand mark */}
          <div className="mb-8 flex items-center justify-center gap-2.5 lg:hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-950 text-sm font-semibold text-white">
              P
            </div>
            <span className="text-[15px] font-semibold tracking-tight text-gray-950">Portier369</span>
          </div>
          {children}

          {/* Staff entry points — visible on every screen size */}
          <footer className="mt-8 border-t border-gray-200/80 pt-5 text-center">
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-gray-400">Staff access</p>
            <div className="mt-2 flex items-center justify-center gap-4 text-[13px]">
              <Link href="/login?mode=company_admin" className="font-medium text-gray-500 underline-offset-4 transition-colors hover:text-gray-900 hover:underline">
                Company admin sign in
              </Link>
              <span aria-hidden className="text-gray-300">·</span>
              <Link href="/login?mode=admin" className="font-medium text-gray-500 underline-offset-4 transition-colors hover:text-gray-900 hover:underline">
                Platform operator sign in
              </Link>
            </div>
          </footer>
        </div>
      </main>
    </div>
  );
}
