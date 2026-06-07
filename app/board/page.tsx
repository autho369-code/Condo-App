import { redirect } from 'next/navigation'
import { requireBoard } from '@/lib/auth/me'

export default async function BoardPage() {
  await requireBoard()
  redirect('/board/violations')
}
