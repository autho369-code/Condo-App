import { StatusChip } from '@/components/operations/status-chip';

export function RequestStatus({ status, expiresAt }: { status: string; expiresAt?: string | null }) {
  if (status === 'sent' && expiresAt && new Date(expiresAt) < new Date()) return <StatusChip tone="danger">Expired</StatusChip>;
  switch (status) {
    case 'sent': return <StatusChip tone="warning">Awaiting signatures</StatusChip>;
    case 'completed': return <StatusChip tone="success">Completed</StatusChip>;
    case 'declined': return <StatusChip tone="danger">Declined</StatusChip>;
    case 'voided': return <StatusChip tone="neutral">Voided</StatusChip>;
    default: return <StatusChip tone="neutral">{status}</StatusChip>;
  }
}

export function SignerStatus({ status }: { status: string }) {
  switch (status) {
    case 'signed': return <StatusChip tone="success">Signed</StatusChip>;
    case 'viewed': return <StatusChip tone="info">Viewed</StatusChip>;
    case 'declined': return <StatusChip tone="danger">Declined</StatusChip>;
    default: return <StatusChip tone="neutral">Not opened</StatusChip>;
  }
}

export const SUBJECT_LABEL: Record<string, string> = {
  document: 'Document',
  board_resolution: 'Board resolution',
  architectural_request: 'Architectural decision',
  vendor_agreement: 'Vendor agreement',
  management_agreement: 'Management agreement',
  year_end_package: 'Year-end package',
};

export const fmtDateTime = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }) : '—';
