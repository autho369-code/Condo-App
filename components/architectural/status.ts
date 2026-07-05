import type { Tone } from '@/components/operations/status-chip';

export const ARC_STATUS_TONE: Record<string, Tone> = {
  submitted:    'info',
  under_review: 'warning',
  more_info:    'warning',
  approved:     'success',
  denied:       'danger',
  withdrawn:    'neutral',
};

export function arcStatusLabel(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
