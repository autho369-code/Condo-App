// Receipt methods staff record at the office. Must match the
// payments_method_check constraint (migration post_receivables_to_gl).
export const RECEIPT_METHODS = [
  { value: 'check', label: 'Check' },
  { value: 'cash', label: 'Cash' },
  { value: 'money_order', label: 'Money order' },
  { value: 'cashiers_check', label: 'Cashier’s check' },
  { value: 'ach', label: 'ACH / bank transfer' },
  { value: 'wire', label: 'Wire' },
  { value: 'card', label: 'Card' },
  { value: 'online', label: 'Online portal' },
  { value: 'manual', label: 'Manual adjustment' },
  { value: 'other', label: 'Other' },
] as const;
export type ReceiptMethod = (typeof RECEIPT_METHODS)[number]['value'];
export const isReceiptMethod = (v: string): v is ReceiptMethod => RECEIPT_METHODS.some((m) => m.value === v);
export const receiptMethodLabel = (v: string | null | undefined) => RECEIPT_METHODS.find((m) => m.value === v)?.label ?? (v ?? '—');
