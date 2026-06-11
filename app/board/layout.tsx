import Sidebar from '@/components/nav/sidebar'
import { boardModules } from '@/lib/navigation/role-modules'
import { requireBoard } from '@/lib/auth/me'
import { createClient } from '@/lib/supabase/server'

async function getAssociationName(associationIds: string[]): Promise<string | undefined> {
  if (!associationIds || associationIds.length === 0) return undefined
  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from('associations')
      .select('name')
      .eq('id', associationIds[0])
      .single()
    return data?.name ?? undefined
  } catch {
    return undefined
  }
}

export default async function BoardLayout({ children }: { children: React.ReactNode }) {
  const me = await requireBoard()
  const associationName = await getAssociationName(me.board_association_ids)

  return (
    <div className="flex min-h-screen">
      <Sidebar
        portfolioName={associationName ?? me.portfolio?.company_name ?? me.portfolio?.name ?? 'Portier369'}
        userEmail={me.email ?? undefined}
        modules={boardModules}
        subtitle="Board portal"
      />
      <main className="h-screen flex-1 overflow-y-auto bg-[#f6f7f9] pt-12 lg:pt-0">
        <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 lg:py-8">{children}</div>
      </main>
    </div>
  )
}
