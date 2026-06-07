export type InventoryWorkflowAction =
  | 'create_item'
  | 'adjust_stock'
  | 'generate_report'
  | 'manage_categories';

const CONFIRMATION_REQUIRED = new Set<InventoryWorkflowAction>([]);

export function requiresInventoryConfirmation(action: InventoryWorkflowAction) {
  return CONFIRMATION_REQUIRED.has(action);
}

export const inventoryWorkflowCards = [
  {
    title: 'New Inventory Item',
    description: 'Add a new part, supply, or consumable to the managed inventory.',
    href: '/inventory/new',
    action: 'create_item' satisfies InventoryWorkflowAction,
  },
  {
    title: 'Adjust Stock Levels',
    description: 'Bulk-adjust quantities on hand after a physical count or restock.',
    href: '/inventory/adjust',
    action: 'adjust_stock' satisfies InventoryWorkflowAction,
  },
  {
    title: 'Inventory Report',
    description: 'View low-stock items, valuation summary, and restock recommendations.',
    href: '/reports/inventory',
    action: 'generate_report' satisfies InventoryWorkflowAction,
  },
  {
    title: 'Manage Categories',
    description: 'Organize items by category to simplify browsing and reporting.',
    href: '/inventory/categories',
    action: 'manage_categories' satisfies InventoryWorkflowAction,
  },
];
