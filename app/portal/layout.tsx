import OwnerSidebar from '@/components/nav/owner-sidebar'
import { requireOwner } from '@/lib/auth/me'

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const me = await requireOwner()
  return (
    <div className="flex min-h-screen bg-stone-50">
      <OwnerSidebar userName={me.profile?.full_name ?? me.email ?? undefined} />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-6 py-8">{children}</div>
      </main>
    </div>
  )
}
