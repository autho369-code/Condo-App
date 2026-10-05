// Company-admin dashboards fire many reads in parallel. A failed read used to
// be swallowed and rendered as zeros, so a broken query looked like an empty
// portfolio. Pages collect every failure here and render one <Alert>.

type ErrorLike = { message?: string | null } | string | null | undefined

type ResultLike = { error?: ErrorLike } | null | undefined

/**
 * Map of label -> query result (a Supabase response, or a fetchAllRows()
 * result whose `error` is a string). Returns "label: message" for each failed
 * read, in insertion order.
 */
export function collectLoadErrors(results: Record<string, ResultLike>): string[] {
  const out: string[] = []
  for (const [label, result] of Object.entries(results)) {
    const err = result?.error
    if (!err) continue
    const message = typeof err === 'string' ? err : err.message || 'Unknown error'
    out.push(`${label}: ${message}`)
  }
  return out
}
