import BoardSidebar from '@/components/nav/board-sidebar'
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
    <div className="flex min-h-screen" style={{ backgroundColor: '#060B18' }}>
      <BoardSidebar userEmail={me.email ?? undefined} associationName={associationName} />
      <main className="flex-1 overflow-y-auto">
        <div className="px-8 py-6">{children}</div>
      </main>
    </div>
  )
}
