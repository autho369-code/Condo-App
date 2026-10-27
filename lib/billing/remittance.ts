// How management companies pay Portier369: ACH to the account the platform
// operator enters on /platform-operator/billing (table platform_remittance).

export type Remittance = {
  payee_name: string;
  bank_name: string;
  routing_number: string;
  account_number: string;
  account_type: 'checking' | 'savings';
  instructions: string | null;
  updated_at?: string;
};

export const REMITTANCE_COLUMNS = 'payee_name, bank_name, routing_number, account_number, account_type, instructions, updated_at';

/** ABA routing number: 9 digits with a valid checksum (3-7-1 weights). */
export function isValidRoutingNumber(value: string): boolean {
  if (!/^\d{9}$/.test(value)) return false;
  const d = value.split('').map(Number);
  const sum = 3 * (d[0] + d[3] + d[6]) + 7 * (d[1] + d[4] + d[7]) + (d[2] + d[5] + d[8]);
  return sum % 10 === 0;
}

/** Validates the operator's form. Returns the cleaned record or an error message. */
export function parseRemittance(formData: FormData): { value: Remittance } | { error: string } {
  const text = (name: string) => String(formData.get(name) ?? '').trim();
  const digits = (name: string) => text(name).replace(/[\s-]/g, '');
  const payee = text('payee_name');
  const bank = text('bank_name');
  const routing = digits('routing_number');
  const account = digits('account_number');
  const type = text('account_type');
  const instructions = text('instructions');
  if (!payee || payee.length > 200) return { error: 'Enter the account holder name (up to 200 characters).' };
  if (!bank || bank.length > 200) return { error: 'Enter the bank name (up to 200 characters).' };
  if (!isValidRoutingNumber(routing)) return { error: 'Enter a valid 9-digit ABA routing number.' };
  if (!/^\d{4,17}$/.test(account)) return { error: 'Enter the account number (4 to 17 digits).' };
  if (type !== 'checking' && type !== 'savings') return { error: 'Choose checking or savings.' };
  if (instructions.length > 1000) return { error: 'Keep the payment note under 1,000 characters.' };
  return { value: { payee_name: payee, bank_name: bank, routing_number: routing, account_number: account, account_type: type, instructions: instructions || null } };
}

export function lastFour(account: string): string {
  return account.slice(-4);
}

export function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** The "How to pay" block of the invoice email. */
export function remittanceEmailHtml(r: Remittance, invoiceNumber: string | null): string {
  const row = (label: string, value: string) => `<li>${label}: <strong>${escapeHtml(value)}</strong></li>`;
  return [
    '<p><strong>How to pay (ACH bank transfer)</strong></p>',
    '<ul>',
    row('Account holder', r.payee_name),
    row('Bank', r.bank_name),
    row('Routing number (ABA)', r.routing_number),
    row('Account number', r.account_number),
    row('Account type', r.account_type === 'savings' ? 'Savings' : 'Checking'),
    invoiceNumber ? row('Payment reference', invoiceNumber) : '',
    '</ul>',
    r.instructions ? `<p>${escapeHtml(r.instructions)}</p>` : '',
  ].join('');
}
