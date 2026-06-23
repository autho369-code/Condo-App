'use server'

// Board sign-off on an approval request. Calls the SECURITY DEFINER RPC which
// records the per-member digital signature, recomputes tallies, and resolves the
// request by its voting scheme. Fails loud by redirecting back with ?error=.
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireBoard } from '@/lib/auth/me'

function s(fd: FormData, k: string): string | null {
  const v = fd.get(k)
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null
}
function fail(message: string): never {
  redirect(`/board/approvals?error=${encodeURIComponent(message)}`)
}

export async function castApproval(formData: FormData) {
  await requireBoard()

  const requestId = s(formData, 'request_id')
  const decision = s(formData, 'decision')
  if (!requestId) fail('No approval request specified.')
  if (!decision) fail('Choose Approve, Reject, or Abstain.')

  const supabase = await createClient()
  const { error } = await (supabase as any).rpc('cast_board_approval', {
    p_request_id: requestId,
    p_decision: decision,
    p_signature: s(formData, 'signature'),
    p_comment: s(formData, 'comment'),
  })
  if (error) fail(error.message || 'Could not record your decision.')

  revalidatePath('/board/approvals')
  redirect('/board/approvals?signed=1')
}
