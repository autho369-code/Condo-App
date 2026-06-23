// Downloadable CSV template for the Opening Balances importer.
import { NextResponse } from 'next/server';

const HEADERS = ['unit_number', 'opening_balance', 'as_of_date', 'memo'];

const EXAMPLE = ['101', '125.00', '2024-01-01', 'Opening balance carried over'];

export function GET() {
  const csv = `${HEADERS.join(',')}\n${EXAMPLE.join(',')}\n`;
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="opening-balances-template.csv"',
    },
  });
}
