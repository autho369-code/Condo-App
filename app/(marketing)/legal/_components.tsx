
export function LegalShell({
  title,
  updated,
  children,
}: {
  title: string
  updated: string
  children: React.ReactNode
}) {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16 lg:py-20">
      <h1 className="text-3xl font-bold tracking-[-0.02em] text-gray-900 sm:text-4xl">{title}</h1>
      <p className="mt-3 text-sm text-gray-500">Last updated: {updated}</p>
      <div className="legal-body mt-10 space-y-6 text-[15px] leading-7 text-gray-600">{children}</div>
    </div>
  )
}

export function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="!mt-10 text-lg font-semibold text-gray-900">{children}</h2>
}
