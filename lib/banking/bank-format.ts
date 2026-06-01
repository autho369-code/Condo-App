export function maskBankNumber(value: string | null | undefined) {
  if (!value) return 'Not provided';
  const lastFour = value.slice(-4);
  return `${'*'.repeat(Math.max(value.length - 4, 0))}${lastFour}`;
}

export function formatBankStatus(value: boolean | null | undefined) {
  return value ? 'Enabled' : 'Not enabled';
}

export type ActivityInput = {
  id: string;
  date: string;
  cashIn: number;
  cashOut: number;
  description: string;
};

export function buildActivityRows<T extends ActivityInput>(rows: T[], openingBalance = 0): Array<T & { runningBalance: number }> {
  let balance = openingBalance;
  return [...rows]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((row) => {
      balance = balance + row.cashIn - row.cashOut;
      return { ...row, runningBalance: balance };
    });
}
