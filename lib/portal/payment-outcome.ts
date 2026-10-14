// What the owner's payment result page says for a payment that did not end
// up paid (payment_intents.status). Pure: unit-tested.

export type PaymentNotCompleted = { title: string; body: (amount: string) => string };

const NOT_COMPLETED: Record<string, PaymentNotCompleted> = {
  failed: {
    title: 'Payment did not go through',
    body: (a) => `Your ${a} payment could not be completed. Nothing was charged — please try again or use another payment method.`,
  },
  canceled: {
    title: 'Payment canceled',
    body: (a) => `Your ${a} payment was canceled. Nothing was charged.`,
  },
  returned: {
    title: 'This payment was returned',
    body: (a) => `Your ${a} payment was returned by your bank, so it no longer counts toward your balance.`,
  },
  refunded: {
    title: 'This payment was refunded',
    body: (a) => `Your ${a} payment was refunded, so it no longer counts toward your balance.`,
  },
  chargeback: {
    title: 'This payment was disputed',
    // A dispute can be for part of the payment: the ledger shows the amount
    // actually taken back, so this never claims the whole payment was.
    body: (a) => `Your ${a} payment was disputed with your bank or card issuer. Your ledger shows any amount taken back from your balance. Contact your management company with any questions.`,
  },
};

/** The not-completed wording for a status, or null when the payment is paid or on its way. */
export function paymentNotCompleted(status: string | null | undefined): PaymentNotCompleted | null {
  return (status && NOT_COMPLETED[status]) || null;
}
