import RoleShell from '@/components/nav/role-shell'
import { boardModules } from '@/lib/navigation/role-modules'
import { requireBoard } from '@/lib/auth/me'
import { createClient } from '@/lib/supabase/server'
import { workspaceMetadata } from '@/lib/tenant/metadata'
import { NEUTRAL_COMPANY_NAME } from '@/lib/tenant/neutral-name';

export const generateMetadata = workspaceMetadata

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

  // Board members who are also owners get both portals on one login.
  const modules = me.owner_id
    ? [boardModules[0], { label: 'My Owner Portal', href: '/portal' }, ...boardModules.slice(1)]
    : boardModules

  return (
    <RoleShell
      portfolioName={associationName ?? me.portfolio?.company_name ?? me.portfolio?.name ?? NEUTRAL_COMPANY_NAME}
      userEmail={me.email ?? undefined}
      modules={modules}
      subtitle="Board portal"
      brandColor={me.portfolio?.brand_color ?? null}
      width="portal"
    >
      {children}
    </RoleShell>
  )
}
