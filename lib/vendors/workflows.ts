export type VendorWorkflowAction =
  | 'create_vendor'
  | 'setup_vendor_ach'
  | 'send_w9_request'
  | 'request_vendor_documents'
  | 'preview_vendor_form'
  | 'send_vendor_form'
  | 'schedule_document_reminder';

const CONFIRMATION_REQUIRED = new Set<VendorWorkflowAction>([
  'setup_vendor_ach',
  'send_w9_request',
  'request_vendor_documents',
  'send_vendor_form',
  'schedule_document_reminder',
]);

export function requiresVendorConfirmation(action: VendorWorkflowAction) {
  return CONFIRMATION_REQUIRED.has(action);
}

export const vendorWorkflowCards = [
  {
    title: 'ACH Setup',
    description: 'Collect routing details and validate vendor payout readiness.',
    href: '/vendors/ach',
    action: 'setup_vendor_ach' satisfies VendorWorkflowAction,
  },
  {
    title: 'Request W-9',
    description: 'Find vendors over the filing threshold and request tax documents.',
    href: '/vendors/w9',
    action: 'send_w9_request' satisfies VendorWorkflowAction,
  },
  {
    title: 'Vendor Documents',
    description: 'Track insurance, licenses, expirations, and reminder cadence.',
    href: '/vendors/compliance',
    action: 'request_vendor_documents' satisfies VendorWorkflowAction,
  },
  {
    title: 'Vendor Forms',
    description: 'Preview and send vendor intake forms without leaving the workspace.',
    href: '/vendors/forms',
    action: 'send_vendor_form' satisfies VendorWorkflowAction,
  },
];
