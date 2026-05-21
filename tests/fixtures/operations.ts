export const bankAccounts = [
  {
    id: 'bank-1',
    name: 'Winchester Court - Chase Checking',
    bank_name: 'Chase',
    account_number: '1234567890',
    routing_number: '071000013',
    payments_enabled: true,
    auto_reconciliation: false,
    last_reconciliation_date: '2026-03-31',
  },
  {
    id: 'bank-2',
    name: 'Reserve Savings',
    bank_name: 'Byline Bank',
    account_number: null,
    routing_number: null,
    payments_enabled: false,
    auto_reconciliation: false,
    last_reconciliation_date: null,
  },
];

export const reportDefinitions = [
  {
    id: 'r1',
    slug: 'bank_reconciliation',
    name: 'Bank Reconciliation',
    category: 'accounting',
    description: 'Reconcile bank accounts',
    active: true,
  },
  {
    id: 'r2',
    slug: 'owner_ledger',
    name: 'Owner Ledger',
    category: 'association',
    description: 'Owner account activity',
    active: true,
  },
  {
    id: 'r3',
    slug: 'violation_log',
    name: 'Violation Log',
    category: 'compliance',
    description: 'Violation activity',
    active: true,
  },
];
