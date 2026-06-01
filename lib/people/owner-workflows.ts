export type OwnerWorkflowAction =
  | 'create_owner'
  | 'send_portal_activation'
  | 'send_owner_packet'
  | 'preview_owner_packet'
  | 'send_owner_form'
  | 'preview_owner_form'
  | 'setup_owner_ach'
  | 'create_management_agreement'
  | 'preview_management_agreement';

const CONFIRMATION_REQUIRED = new Set<OwnerWorkflowAction>([
  'send_portal_activation',
  'send_owner_packet',
  'send_owner_form',
  'setup_owner_ach',
  'create_management_agreement',
]);

export function requiresConfirmation(action: OwnerWorkflowAction) {
  return CONFIRMATION_REQUIRED.has(action);
}

export const ownerWorkflowCards = [
  {
    title: 'Portal Activation',
    description: 'Send secure activation links and track last invitation status.',
    href: '/owners/activations',
    action: 'send_portal_activation' satisfies OwnerWorkflowAction,
  },
  {
    title: 'Owner Packets',
    description: 'Prepare onboarding packets with association and property context.',
    href: '/owners/packets',
    action: 'send_owner_packet' satisfies OwnerWorkflowAction,
  },
  {
    title: 'Owner Forms',
    description: 'Route owner intake, tax, and management forms from one queue.',
    href: '/owners/forms',
    action: 'send_owner_form' satisfies OwnerWorkflowAction,
  },
  {
    title: 'ACH Setup',
    description: 'Review owner bank setup readiness before enabling payment flows.',
    href: '/owners/ach',
    action: 'setup_owner_ach' satisfies OwnerWorkflowAction,
  },
  {
    title: 'Management Agreement',
    description: 'Draft the agreement package and collect signature details.',
    href: '/owners/management-agreements/new',
    action: 'create_management_agreement' satisfies OwnerWorkflowAction,
  },
];
