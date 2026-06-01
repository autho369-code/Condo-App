'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface WorkflowStatus {
  portal: { status: string; sentAt: string | null; lastLogin: string | null };
  packet: { status: string; submittedAt: string | null };
  forms: { total: number; submitted: number };
  ach: { status: string };
  agreement: { status: string; id: string | null };
}

const STATUS_COLORS: Record<string, string> = {
  not_invited: 'text-gray-400 bg-gray-50 border-gray-200',
  sent: 'text-blue-700 bg-blue-50 border-blue-200',
  active: 'text-green-700 bg-green-50 border-green-200',
  completed: 'text-green-700 bg-green-50 border-green-200',
  verified: 'text-green-700 bg-green-50 border-green-200',
  draft: 'text-amber-700 bg-amber-50 border-amber-200',
  not_started: 'text-gray-400 bg-gray-50 border-gray-200',
  invite_sent: 'text-blue-700 bg-blue-50 border-blue-200',
  signed: 'text-green-700 bg-green-50 border-green-200',
  failed: 'text-red-700 bg-red-50 border-red-200',
};

function StatusBadge({ status }: { status: string }) {
  const colors = STATUS_COLORS[status] || STATUS_COLORS.not_started;
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium capitalize ${colors}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

export default function OwnerWorkflowCards({ ownerId }: { ownerId: string }) {
  const [data, setData] = useState<WorkflowStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/owners/${ownerId}/workflows`)
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [ownerId]);

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="h-16 animate-pulse rounded-lg bg-gray-100" />
        ))}
      </div>
    );
  }

  if (!data) return null;

  const cards = [
    {
      title: 'Portal Activation',
      status: data.portal.status,
      detail: data.portal.status === 'active'
        ? `Last login: ${data.portal.lastLogin ? new Date(data.portal.lastLogin).toLocaleDateString() : 'Never'}`
        : data.portal.status === 'sent'
        ? `Sent: ${data.portal.sentAt ? new Date(data.portal.sentAt).toLocaleDateString() : '—'}`
        : 'Not yet invited',
      href: `/owners/activations?owner=${ownerId}`,
      action: data.portal.status === 'not_invited' ? 'Activate' : 'Resend',
      actionHref: `/owners/activations?owner=${ownerId}`,
    },
    {
      title: 'Owner Packet',
      status: data.packet.status === 'completed' ? 'completed' : 'draft',
      detail: data.packet.status === 'completed'
        ? `Completed: ${data.packet.submittedAt ? new Date(data.packet.submittedAt).toLocaleDateString() : '—'}`
        : 'Incomplete — fill out on site',
      href: `/owners/packets/${ownerId}`,
      action: data.packet.status === 'completed' ? 'View' : 'Start',
      actionHref: `/owners/packets/${ownerId}`,
    },
    {
      title: 'Owner Forms',
      status: data.forms.submitted === data.forms.total && data.forms.total > 0 ? 'completed' : 'draft',
      detail: `${data.forms.submitted}/${data.forms.total} forms completed`,
      href: `/owners/forms?owner=${ownerId}`,
      action: 'Open',
      actionHref: `/owners/forms?owner=${ownerId}`,
    },
    {
      title: 'ACH Setup',
      status: data.ach.status || 'not_started',
      detail: data.ach.status === 'not_started'
        ? 'Payment processor not connected'
        : data.ach.status === 'verified'
        ? 'ACH verified and active'
        : 'In progress',
      href: `/owners/forms?owner=${ownerId}&template=ach_setup`,
      action: data.ach.status === 'not_started' ? 'Setup' : 'Manage',
      actionHref: `/owners/forms?owner=${ownerId}&template=ach_setup`,
    },
    {
      title: 'Management Agreement',
      status: data.agreement.status || 'draft',
      detail: data.agreement.id
        ? `Agreement #${data.agreement.id.slice(0, 8)} — ${data.agreement.status.replace(/_/g, ' ')}`
        : 'No agreement on file',
      href: data.agreement.id ? `/owners/agreements/${data.agreement.id}` : `/owners/agreements/new?owner=${ownerId}`,
      action: data.agreement.id ? 'View' : 'Create',
      actionHref: data.agreement.id ? `/owners/agreements/${data.agreement.id}` : `/owners/agreements/new?owner=${ownerId}`,
    },
  ];

  return (
    <div className="space-y-1.5">
      {cards.map((card) => (
        <Link
          key={card.title}
          href={card.actionHref}
          className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 transition-colors hover:border-gray-300 hover:bg-gray-50"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-900">{card.title}</span>
              <StatusBadge status={card.status} />
            </div>
            <p className="mt-0.5 text-xs text-gray-500">{card.detail}</p>
          </div>
          <span className="ml-4 shrink-0 text-xs font-medium text-brand-600">
            {card.action} &rarr;
          </span>
        </Link>
      ))}
    </div>
  );
}
