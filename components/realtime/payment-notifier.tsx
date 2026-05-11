'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/toast/toaster';
import { money } from '@/lib/utils';

// =============================================================================
// PaymentNotifier
// =============================================================================
// Subscribes to INSERTs on the `payment_intents` table (RLS scopes to the
// portfolio) and shows a toast whenever a payment lands. Only attaches when
// the staffer's role can actually act on payments (gated server-side via the
// `enabled` prop the layout sets).
// =============================================================================

type Props = { enabled: boolean };

export function PaymentNotifier({ enabled }: Props) {
  const toast = useToast();
  const router = useRouter();
  const subscribed = useRef(false);

  useEffect(() => {
    if (!enabled || subscribed.current) return;
    subscribed.current = true;
    const supabase = createClient();

    const channel = supabase
      .channel('portier:payment-intents')
      .on(
        'postgres_changes' as any,
        { event: 'INSERT', schema: 'public', table: 'payment_intents' },
        (payload: any) => {
          const row = payload.new as any;
          // Only celebrate succeeded / processing — declines stay silent unless
          // the staffer goes looking.
          if (!row || (row.status !== 'succeeded' && row.status !== 'processing')) return;

          const amount = money(row.amount);
          const method = (row.method ?? 'payment').toUpperCase();

          toast.action(
            <>
              {amount} <span className="text-ink-600">received</span>
            </>,
            {
              variant: row.status === 'succeeded' ? 'success' : 'info',
              detail: (
                <>via {method}{row.unit_id ? ` · unit ${String(row.unit_id).slice(0,6)}` : ''}</>
              ),
              actionLabel: 'View',
              onAction: () => router.push(`/charges?focus=${row.unit_id ?? ''}`),
              duration: 9000,
            },
          );
        },
      )
      .on(
        'postgres_changes' as any,
        { event: 'UPDATE', schema: 'public', table: 'payment_intents' },
        (payload: any) => {
          const next = payload.new as any;
          const prev = payload.old as any;
          // Surface transitions: processing → succeeded/failed
          if (prev?.status === next?.status) return;
          if (next?.status === 'succeeded') {
            toast.success(<>{money(next.amount)} <span className="text-ink-600">cleared</span></>, {
              detail: 'Posted to the unit ledger.',
              duration: 8000,
            });
          } else if (next?.status === 'failed') {
            toast.error(<>{money(next.amount)} payment failed</>, {
              detail: next.failure_reason ?? 'Bank declined the transfer.',
              actionLabel: 'Open',
              onAction: () => router.push(`/charges?focus=${next.unit_id ?? ''}`),
              duration: 12000,
            });
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      subscribed.current = false;
    };
  }, [enabled, toast, router]);

  return null;
}
