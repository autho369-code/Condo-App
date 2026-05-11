import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { Card, CardHeader, CardTitle, CardSubtitle, CardBody } from '@/components/ui/card';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { StatusChip } from '@/components/operations/status-chip';
import { createClient } from '@/lib/supabase/server';
import { date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const STATUS_TONE: Record<string, 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent'> = {
  new: 'accent',
  contacted: 'info',
  qualified: 'warning',
  converted: 'success',
  declined: 'neutral',
  spam: 'danger',
};

async function updateLeadStatus(formData: FormData) {
  'use server';
  const id = formData.get('id') as string;
  const status = formData.get('status') as string;
  const supabase = await createClient();
  await (supabase as any).from('marketing_leads').update({ status }).eq('id', id);
  revalidatePath('/platform/leads');
}

export default async function LeadsPage() {
  const supabase = await createClient();
  const { data: leads } = await (supabase as any)
    .from('marketing_leads')
    .select('*')
    .order('created_at', { ascending: false });

  const all = (leads ?? []) as any[];
  const byStatus = all.reduce<Record<string, number>>((acc, l) => {
    acc[l.status] = (acc[l.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-7">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-ink-100 pb-7">
        <div className="max-w-2xl">
          <div className="eyebrow">Sales pipeline</div>
          <h1 className="mt-2 font-display text-4xl tracking-editorial text-ink-900">Access requests</h1>
          <p className="mt-3 text-[15px] text-ink-500 leading-relaxed">
            Inbound from <span className="font-mono text-ink-700">/request-access</span> on the marketing site.
            Qualify, schedule the call, then provision the portfolio.
          </p>
        </div>
        <Link href="/platform/portfolios">
          <Button size="md" variant="outline">Open client directory →</Button>
        </Link>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        {(['new','contacted','qualified','converted','declined','spam'] as const).map((s) => (
          <div key={s} className="rounded-lg border border-ink-100 bg-white px-4 py-3 shadow-soft-sm">
            <div className="eyebrow">{s}</div>
            <div className="mt-1.5 font-display text-2xl number-plate text-ink-900">{byStatus[s] ?? 0}</div>
          </div>
        ))}
      </div>

      {all.length === 0 ? (
        <Card>
          <CardBody className="py-14 text-center">
            <div className="font-display text-2xl tracking-editorial text-ink-900">No requests yet.</div>
            <div className="mt-2 text-sm text-ink-500">
              The form is live at{' '}
              <Link href="/request-access" className="font-mono text-champagne-700 underline decoration-champagne-300 underline-offset-4 hover:decoration-champagne-500">
                /request-access
              </Link>.
            </div>
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Inbound queue</CardTitle>
            <CardSubtitle>Most recent first. Update status inline to move through the pipeline.</CardSubtitle>
          </CardHeader>
          <CardBody className="px-0 py-0">
            <Table>
              <THead>
                <TR>
                  <TH>Contact</TH>
                  <TH>Company</TH>
                  <TH>Size</TH>
                  <TH>Current platform</TH>
                  <TH>Received</TH>
                  <TH>Status</TH>
                  <TH>Move</TH>
                </TR>
              </THead>
              <tbody>
                {all.map((lead) => (
                  <TR key={lead.id}>
                    <TD>
                      <div className="font-medium text-ink-900">{lead.contact_name}</div>
                      <a href={`mailto:${lead.contact_email}`} className="text-[12.5px] text-champagne-700 underline decoration-champagne-300 underline-offset-4 hover:decoration-champagne-500">
                        {lead.contact_email}
                      </a>
                      {lead.contact_phone && (
                        <div className="text-[12px] text-ink-500 mt-0.5">{lead.contact_phone}</div>
                      )}
                    </TD>
                    <TD className="font-medium text-ink-900">{lead.company_name}</TD>
                    <TD>{lead.portfolio_size ?? '—'}</TD>
                    <TD>{lead.current_platform ?? '—'}</TD>
                    <TD className="text-xs text-ink-500">{date(lead.created_at)}</TD>
                    <TD>
                      <StatusChip tone={STATUS_TONE[lead.status] ?? 'neutral'}>{lead.status}</StatusChip>
                    </TD>
                    <TD>
                      <form action={updateLeadStatus as any} className="flex items-center gap-2">
                        <input type="hidden" name="id" value={lead.id} />
                        <select
                          name="status"
                          defaultValue={lead.status}
                          className="h-8 rounded-md border border-ink-200 bg-white px-2 text-[12.5px] text-ink-900 focus:border-champagne-500 focus:outline-none focus:ring-2 focus:ring-champagne-200/60"
                        >
                          {Object.keys(STATUS_TONE).map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <Button type="submit" size="sm" variant="outline">Save</Button>
                      </form>
                    </TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
