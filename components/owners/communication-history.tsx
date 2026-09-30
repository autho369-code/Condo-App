import { Badge } from '@/components/ui/shell';
import { date } from '@/lib/utils';

export type OwnerEmail = {
  id: string;
  subject: string;
  to_email: string;
  status: string;
  delivery_status: string | null;
  open_count: number | null;
  first_opened_at: string | null;
  last_opened_at: string | null;
  clicked_at: string | null;
  bounced_at: string | null;
  error_message: string | null;
  created_at: string;
  sent_at: string | null;
};
export type OwnerLetter = {
  id: string;
  description: string | null;
  mail_class: string | null;
  status: string;
  expected_delivery_date: string | null;
  delivered_at: string | null;
  submitted_at: string | null;
  created_at: string;
  error_message: string | null;
};

function emailState(e: OwnerEmail): { label: string; tone: 'complete' | 'progress' | 'pending' | 'danger' | 'inactive' | 'info' } {
  if (e.status === 'failed') return { label: 'Failed', tone: 'danger' };
  if (e.delivery_status === 'bounced') return { label: 'Bounced', tone: 'danger' };
  if (e.delivery_status === 'complained') return { label: 'Marked as spam', tone: 'danger' };
  if (e.delivery_status === 'opened' || (e.open_count ?? 0) > 0) {
    const n = e.open_count ?? 0;
    return { label: n > 1 ? `Opened ${n}×` : 'Opened', tone: 'complete' };
  }
  if (e.delivery_status === 'delivered') return { label: 'Delivered', tone: 'info' };
  if (e.delivery_status === 'delayed') return { label: 'Delayed', tone: 'pending' };
  if (e.status === 'sent') return { label: 'Sent', tone: 'progress' };
  return { label: 'Queued', tone: 'inactive' };
}

function letterState(l: OwnerLetter): { label: string; tone: 'complete' | 'progress' | 'pending' | 'danger' | 'inactive' } {
  switch (l.delivered_at ? 'delivered' : l.status) {
    case 'delivered': return { label: 'Delivered', tone: 'complete' };
    case 'returned': return { label: 'Returned', tone: 'danger' };
    case 'failed': return { label: 'Failed', tone: 'danger' };
    case 'cancelled': return { label: 'Cancelled', tone: 'inactive' };
    case 'submitted':
    case 'in_transit': return { label: 'In the mail', tone: 'progress' };
    default: return { label: 'Queued', tone: 'pending' };
  }
}

/**
 * Every email and mailed letter sent to this homeowner, newest first, with
 * delivery and open status (from Resend webhooks) and print-mail tracking.
 */
export function OwnerCommunicationHistory({ emails, letters }: { emails: OwnerEmail[]; letters: OwnerLetter[] }) {
  const rows = [
    ...emails.map((e) => ({ kind: 'email' as const, at: e.sent_at ?? e.created_at, e })),
    ...letters.map((l) => ({ kind: 'letter' as const, at: l.submitted_at ?? l.created_at, l })),
  ].sort((a, b) => (a.at < b.at ? 1 : -1));
  const opened = emails.filter((e) => (e.open_count ?? 0) > 0).length;
  const sent = emails.filter((e) => e.status === 'sent').length;

  return (
    <section id="communications" className="scroll-mt-20 overflow-hidden rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-5 py-3">
        <h2 className="text-sm font-semibold text-gray-900">Emails &amp; letters ({rows.length})</h2>
        {sent > 0 && <span className="text-xs text-gray-500">{opened} of {sent} emails opened</span>}
      </div>
      {rows.length === 0 ? (
        <p className="px-5 py-6 text-center text-sm text-gray-500">Nothing has been emailed or mailed to this homeowner yet.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {rows.slice(0, 100).map((r) => {
            if (r.kind === 'email') {
              const st = emailState(r.e);
              return (
                <li key={`e-${r.e.id}`} className="flex flex-wrap items-start justify-between gap-2 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900">{r.e.subject}</p>
                    <p className="text-xs text-gray-500">
                      Email to {r.e.to_email} · {date(r.at)}
                      {r.e.last_opened_at ? ` · last opened ${date(r.e.last_opened_at)}` : ''}
                      {r.e.clicked_at ? ' · link clicked' : ''}
                    </p>
                    {(r.e.status === 'failed' || r.e.delivery_status === 'bounced') && r.e.error_message && (
                      <p className="mt-0.5 text-xs text-red-700">{r.e.error_message}</p>
                    )}
                  </div>
                  <Badge tone={st.tone}>{st.label}</Badge>
                </li>
              );
            }
            const st = letterState(r.l);
            return (
              <li key={`l-${r.l.id}`} className="flex flex-wrap items-start justify-between gap-2 px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900">{r.l.description ?? 'Mailed letter'}</p>
                  <p className="text-xs text-gray-500">
                    {r.l.mail_class ? `${r.l.mail_class.replace(/_/g, ' ')} letter` : 'Letter'} · {date(r.at)}
                    {r.l.expected_delivery_date && !r.l.delivered_at ? ` · expected ${date(r.l.expected_delivery_date)}` : ''}
                    {r.l.delivered_at ? ` · delivered ${date(r.l.delivered_at)}` : ''}
                  </p>
                  {st.tone === 'danger' && r.l.error_message && <p className="mt-0.5 text-xs text-red-700">{r.l.error_message}</p>}
                </div>
                <Badge tone={st.tone}>{st.label}</Badge>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
