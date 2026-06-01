import { buildActivityRows } from './bank-format';

export type BankActivitySourceRow = {
  id: string;
  date: string;
  payee: string;
  transactionType: string;
  reference: string;
  cleared: boolean;
  cashIn: number;
  cashOut: number;
  description: string;
};

export function toActivityRows(rows: BankActivitySourceRow[], openingBalance = 0) {
  return buildActivityRows(rows, openingBalance);
}
