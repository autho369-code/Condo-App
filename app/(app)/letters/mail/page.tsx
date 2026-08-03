import Link from 'next/link';
import { MailPlus } from 'lucide-react';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { MetricStrip } from '@/components/operations/metric-strip';
import { Button } from '@/components/ui/button';
import { Alert, Badge, EmptyState } from '@/components/ui/shell';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function PhysicalMailPage() {
  await requireStaff();
  const { data: rows } = await (await createClient() as any).from('physical_mail_deliveries').select('id, description, recipient_name, address_city, address_state, mail_class, status, provider, provider_piece_id, provider_url, expected_delivery_date, delivered_at, delivery_verified_at, manual_delivery_note, attempt_count, error_message, created_at, associations(name)').order('created_at', { ascending: false }).limit(500);
  const pieces = rows ?? [];
  const enabled = process.env.PHYSICAL_MAIL_DELIVERY_ENABLED === 'true';
  return <DataWorkspace title="Physical Mail Fulfillment" description="Queue owner letters for provider submission with retry history and delivery evidence." actions={<><Link href="/letters"><Button variant="secondary">Letter templates</Button></Link><Link href="/letters/mail/new"><Button><MailPlus className="h-4 w-4" /> New mail piece</Button></Link></>}>
    <div className="space-y-5">
      {!enabled && <Alert tone="info" title="Provider activation required.">Queueing is available, but fulfillment remains fail-closed until Lob credentials, the return address, and PHYSICAL_MAIL_DELIVERY_ENABLED=true are configured.</Alert>}
      <MetricStrip metrics={[
        { label: 'Queued', value: pieces.filter((piece: any) => ['queued', 'processing'].includes(piece.status)).length, sublabel: 'Awaiting provider' },
        { label: 'Submitted', value: pieces.filter((piece: any) => ['submitted', 'in_transit'].includes(piece.status)).length, sublabel: 'In fulfillment' },
        { label: 'Delivered', value: pieces.filter((piece: any) => piece.status === 'delivered').length, sublabel: 'Delivery evidence' },
        { label: 'Needs attention', value: pieces.filter((piece: any) => ['failed', 'returned'].includes(piece.status)).length, sublabel: 'Review errors' },
      ]} />
      {pieces.length ? <Table><THead><TR><TH>Piece</TH><TH>Recipient</TH><TH>Class</TH><TH>Status</TH><TH>Evidence</TH><TH>Attempts</TH></TR></THead><tbody>{pieces.map((piece: any) => <TR key={piece.id}><TD><div className="font-medium text-gray-900">{piece.description}</div><div className="max-w-sm truncate text-xs text-red-700">{piece.error_message}</div></TD><TD><div>{piece.recipient_name}</div><div className="text-xs text-gray-500">{piece.address_city}, {piece.address_state}{piece.associations?.name ? ` · ${piece.associations.name}` : ''}</div></TD><TD className="capitalize">{piece.mail_class.replace(/_/g, ' ')}</TD><TD><Badge status={piece.status} /></TD><TD><div>{piece.delivered_at ? `Delivered ${date(piece.delivered_at)}` : `Expected ${date(piece.expected_delivery_date)}`}</div>{piece.provider_piece_id && <div className="mt-1 text-xs text-gray-500">{piece.provider === 'manual_usps' ? 'USPS' : 'Provider'}: {piece.provider_piece_id}</div>}{piece.delivery_verified_at && <div className="mt-1 max-w-xs truncate text-xs text-gray-500" title={piece.manual_delivery_note ?? undefined}>Manually verified {date(piece.delivery_verified_at)}</div>}</TD><TD className="tabular-nums">{piece.attempt_count}</TD></TR>)}</tbody></Table> : <div className="rounded-2xl border border-gray-200/70 bg-white"><EmptyState icon={MailPlus} title="No physical mail queued" description="Create a piece from owner contact data and a reviewed letter body." /></div>}
    </div>
  </DataWorkspace>;
}
