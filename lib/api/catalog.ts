export const DEVELOPER_API_SCOPES = [
  { value: 'read:associations', label: 'Associations', description: 'Association directory and address metadata' },
  { value: 'read:work_orders', label: 'Work orders', description: 'Operational status, schedule, assignment IDs, and priorities' },
  { value: 'read:vendors', label: 'Vendors', description: 'Vendor directory and compliance expiration dates' },
  { value: 'read:violations', label: 'Violations', description: 'Compliance status and deadline metadata' },
  { value: 'read:reserves', label: 'Reserve plans', description: 'Capital reserve study assumptions and approval status' },
] as const;

export const WEBHOOK_EVENTS = [
  'charge.created',
  'charge.updated',
  'charge.voided',
  'payment.received',
  'payment.failed',
  'payment.refunded',
  'work_order.created',
  'work_order.status_changed',
  'work_order.completed',
  'service_request.created',
  'service_request.resolved',
  'bill.created',
  'bill.approved',
  'bill.paid',
  'violation.created',
  'violation.resolved',
  'notice.sent',
  'statement.generated',
  'owner.created',
  'owner.updated',
  'inspection.completed',
] as const;

export const DEVELOPER_API_ENDPOINTS = [
  { scope: 'read:associations', method: 'GET', path: '/api/v1/associations' },
  { scope: 'read:work_orders', method: 'GET', path: '/api/v1/work-orders' },
  { scope: 'read:vendors', method: 'GET', path: '/api/v1/vendors' },
  { scope: 'read:violations', method: 'GET', path: '/api/v1/violations' },
  { scope: 'read:reserves', method: 'GET', path: '/api/v1/reserve-plans' },
] as const;
