// One running import per association and kind (table public.import_locks,
// migration 20261008080000_import_locks.sql). claim_import_lock takes over a
// lock older than 15 minutes, so a crashed import never blocks for long.

export const IMPORT_LOCK_HELD_MESSAGE = 'Another import for this association is already running. Try again in a minute.'

export async function withImportLock<T>(supabase: any, associationId: string, kind: string, fn: () => Promise<T>): Promise<T> {
  // The claim time is the release token: a run only ever deletes its own claim, never a newer one.
  const { data: claimedAt, error } = await supabase.rpc('claim_import_lock', { p_association_id: associationId, p_kind: kind })
  if (error) throw new Error(`Could not start the import: ${error.message}`)
  if (!claimedAt) throw new Error(IMPORT_LOCK_HELD_MESSAGE)
  try {
    return await fn()
  } finally {
    // A failed release only delays the next import until the lock goes stale.
    await supabase.from('import_locks').delete()
      .eq('association_id', associationId).eq('kind', kind).eq('claimed_at', claimedAt)
      .then(() => undefined, () => undefined)
  }
}
