import Sidebar from '@/components/nav/sidebar'
import { platformOperatorModules } from '@/lib/navigation/role-modules'
import { requirePlatformOperator } from '@/lib/auth/me'

export default async function PlatformOperatorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const me = await requirePlatformOperator()

  return (
    <div className="flex min-h-screen">
      <Sidebar
        portfolioName="Portier369"
        userEmail={me.email ?? undefined}
        modules={platformOperatorModules}
        subtitle="Platform operations"
      />
      <main className="h-screen flex-1 overflow-y-auto bg-[#f6f7f9] pt-12 lg:pt-0">
        <div className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">{children}</div>
      </main>
    </div>
  )
}
