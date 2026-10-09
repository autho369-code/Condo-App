import { notFound } from 'next/navigation';
import { requireOwner } from '@/lib/auth/me';
import { ResidentConversation } from '@/components/messages/resident-messages';
import { residentThread } from '@/lib/messages/resident-loaders';

export const dynamic = 'force-dynamic';

export default async function OwnerConversationPage({
  params, searchParams,
}: { params: Promise<{ id: string }>; searchParams: Promise<{ sent?: string; error?: string }> }) {
  const me = await requireOwner();
  const { id } = await params;
  const sp = await searchParams;
  const party = { kind: 'owner' as const, ownerIds: me.owner_ids };
  const loaded = await residentThread(id, party);
  if (!loaded) notFound();
  return <ResidentConversation base="/portal/messages" thread={loaded.thread} messages={loaded.messages} sent={sp.sent === '1'} error={sp.error} />;
}
