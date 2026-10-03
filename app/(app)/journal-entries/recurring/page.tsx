import { redirect } from 'next/navigation';

// Recurring journal entries are a tab of the Journal Entries page; keep the
// path (and any result flags) working.
export default async function RecurringJournalEntriesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const params = new URLSearchParams({ tab: 'recurring' });
  for (const key of ['saved', 'archived', 'posted', 'through', 'error']) {
    const v = sp[key];
    if (v) params.set(key, v);
  }
  redirect(`/journal-entries?${params.toString()}`);
}
