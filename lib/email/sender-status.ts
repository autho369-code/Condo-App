import type { Tone } from '@/components/operations/status-chip';

/** How a sender domain's verification status reads in the app. */
export const SENDER_STATUS: Record<string, { tone: Tone; label: string }> = {
  verified: { tone: 'success', label: 'Verified' },
  pending: { tone: 'warning', label: 'Checking DNS' },
  not_started: { tone: 'warning', label: 'Waiting for DNS records' },
  partially_verified: { tone: 'warning', label: 'Partly verified' },
  partially_failed: { tone: 'danger', label: 'Some records failed' },
  failed: { tone: 'danger', label: 'Verification failed' },
  temporary_failure: { tone: 'warning', label: 'Temporary failure' },
};

export function senderStatus(status: string): { tone: Tone; label: string } {
  return SENDER_STATUS[status] ?? { tone: 'neutral', label: status };
}

/** Chip tone for one DNS record's status. */
export function recordTone(status: string): Tone {
  return status === 'verified' ? 'success' : status === 'failed' ? 'danger' : 'warning';
}
