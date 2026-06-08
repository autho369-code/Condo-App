export type LockBoxWorkflowAction =
  | 'add_lock_box'
  | 'record_assignment'
  | 'return_key';

export const lockBoxWorkflowCards = [
  {
    title: 'Add Lock Box',
    description: 'Register a new physical lock box with location, serial number, and combination.',
    href: '/lock-boxes?action=new',
    action: 'add_lock_box' satisfies LockBoxWorkflowAction,
  },
  {
    title: 'Record Assignment',
    description: 'Assign a lock box to a vendor or staff member with access dates.',
    href: '/lock-boxes?action=assign',
    action: 'record_assignment' satisfies LockBoxWorkflowAction,
  },
  {
    title: 'Return Keys',
    description: 'Record key returns and deactivate outdated lock box assignments.',
    href: '/lock-boxes?action=return',
    action: 'return_key' satisfies LockBoxWorkflowAction,
  },
];
