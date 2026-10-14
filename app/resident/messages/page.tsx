import { requireTenant } from '@/lib/auth/me';
import { ResidentConversationList } from '@/components/messages/resident-messages';
import { residentThreads, residentUnitOptions, tenantParty } from '@/lib/messages/resident-loaders';

export const dynamic = 'force-dynamic';

export default async function TenantMessagesPage({ searchParams }: { searchParams: Promise<{ error?: string; compose?: string }> }) {
  const me = await requireTenant();
  const sp = await searchParams;
  const party = await tenantParty();
  const [{ threads, error: threadsError }, { units, error: unitsError }] = await Promise.all([residentThreads(party), residentUnitOptions(me.tenant_unit_ids ?? [])]);
  const loadError = threadsError ?? unitsError;
  // Open compose for a first message only when the threads really loaded empty.
  return <ResidentConversationList base="/resident/messages" threads={threads} units={units} error={sp.error} loadError={loadError} compose={!loadError && (sp.compose === '1' || threads.length === 0)} />;
}
