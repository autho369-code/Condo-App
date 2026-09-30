import { notFound } from 'next/navigation';
import { requireTenant } from '@/lib/auth/me';
import { ResidentConversation } from '@/components/messages/resident-messages';
import { residentThread, tenantParty } from '@/lib/messages/resident-loaders';

export const dynamic = 'force-dynamic';

export default async function TenantConversationPage({
  params, searchParams,
}: { params: Promise<{ id: string }>; searchParams: Promise<{ sent?: string; error?: string }> }) {
  await requireTenant();
  const { id } = await params;
  const sp = await searchParams;
  const party = await tenantParty();
  const loaded = await residentThread(id, party);
  if (!loaded) notFound();
  return <ResidentConversation base="/resident/messages" thread={loaded.thread} messages={loaded.messages} sent={sp.sent === '1'} error={sp.error} />;
}
