import PlatformOperatorSidebar from '@/components/nav/platform-operator-sidebar'
import { requirePlatformOperator } from '@/lib/auth/me'

export default async function PlatformOperatorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const me = await requirePlatformOperator()

  return (
    <div className="flex min-h-screen bg-white">
      <PlatformOperatorSidebar userEmail={me.email ?? undefined} />
      <main className="flex-1 overflow-y-auto">
        <div className="px-8 py-6">{children}</div>
      </main>
    </div>
  )
}
