import { StatusChip } from '@/components/operations/status-chip';

export function ApprovalStatusChip({ po }: { po: { approval_status: string; status: string; approval_required?: boolean } }) {
  if (po.status === 'cancelled') return <StatusChip tone="neutral">Cancelled</StatusChip>;
  switch (po.approval_status) {
    case 'draft':
      return <StatusChip tone="neutral">Draft</StatusChip>;
    case 'pending_approval':
      return <StatusChip tone="warning">Awaiting board vote</StatusChip>;
    case 'approved':
      return <StatusChip tone="success">Approved</StatusChip>;
    case 'rejected':
      return <StatusChip tone="danger">Rejected</StatusChip>;
    default:
      return <StatusChip tone="neutral">{po.approval_status}</StatusChip>;
  }
}

export function OrderStatusChip({ status }: { status: string }) {
  switch (status) {
    case 'billed':
      return <StatusChip tone="info">Billed</StatusChip>;
    case 'approved':
      return <StatusChip tone="info">Issued to vendor</StatusChip>;
    default:
      return null;
  }
}
