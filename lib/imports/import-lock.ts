// One running import per association and kind (table public.import_locks,
// migration 20261008080000_import_locks.sql). claim_import_lock takes over a
// lock older than 15 minutes, so a crashed import never blocks for long.

export const IMPORT_LOCK_HELD_MESSAGE = 'Another import for this association is already running. Try again in a minute.'

export async function withImportLock<T>(supabase: any, associationId: string, kind: string, fn: () => Promise<T>): Promise<T> {
  const { data: claimed, error } = await supabase.rpc('claim_import_lock', { p_association_id: associationId, p_kind: kind })
  if (error) throw new Error(`Could not start the import: ${error.message}`)
  if (claimed !== true) throw new Error(IMPORT_LOCK_HELD_MESSAGE)
  try {
    return await fn()
  } finally {
    const userId: string | undefined = await supabase.auth.getUser().then(
      (res: { data?: { user?: { id?: string } | null } }) => res?.data?.user?.id,
      () => undefined,
    )
    let release = supabase.from('import_locks').delete().eq('association_id', associationId).eq('kind', kind)
    if (userId) release = release.eq('claimed_by', userId)
    // A failed release only delays the next import until the lock goes stale.
    await release.then(() => undefined, () => undefined)
  }
}
