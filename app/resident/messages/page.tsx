import { requireTenant } from '@/lib/auth/me';
import { ResidentConversationList } from '@/components/messages/resident-messages';
import { residentThreads, residentUnitOptions, tenantParty } from '@/lib/messages/resident-loaders';

export const dynamic = 'force-dynamic';

export default async function TenantMessagesPage({ searchParams }: { searchParams: Promise<{ error?: string; compose?: string }> }) {
  const me = await requireTenant();
  const sp = await searchParams;
  const party = await tenantParty();
  const [threads, units] = await Promise.all([residentThreads(party), residentUnitOptions(me.tenant_unit_ids ?? [])]);
  return <ResidentConversationList base="/resident/messages" threads={threads} units={units} error={sp.error} compose={sp.compose === '1' || threads.length === 0} />;
}
