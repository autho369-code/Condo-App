import { requireOwner } from '@/lib/auth/me';
import { ResidentConversationList } from '@/components/messages/resident-messages';
import { residentThreads, residentUnitOptions } from '@/lib/messages/resident-loaders';

export const dynamic = 'force-dynamic';

export default async function OwnerMessagesPage({ searchParams }: { searchParams: Promise<{ error?: string; compose?: string }> }) {
  const me = await requireOwner();
  const sp = await searchParams;
  const party = { kind: 'owner' as const, ownerIds: me.owner_ids };
  const [{ threads, error: threadsError }, { units, error: unitsError }] = await Promise.all([residentThreads(party), residentUnitOptions(me.resident_unit_ids ?? [])]);
  const loadError = threadsError ?? unitsError;
  // Open compose for a first message only when the threads really loaded empty.
  return <ResidentConversationList base="/portal/messages" threads={threads} units={units} error={sp.error} loadError={loadError} compose={!loadError && (sp.compose === '1' || threads.length === 0)} />;
}
