// Downloadable CSV template for the Owners & Units importer.
import { NextResponse } from 'next/server';

const HEADERS = [
  'unit_number',
  'owner_first_name',
  'owner_last_name',
  'owner_email',
  'owner_phone',
  'ownership_pct',
  'monthly_dues',
  'move_in_date',
];

const EXAMPLE = ['101', 'Jane', 'Doe', 'jane.doe@example.com', '(312) 555-0100', '100', '350.00', '2024-01-15'];

export function GET() {
  const csv = `${HEADERS.join(',')}\n${EXAMPLE.join(',')}\n`;
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="owners-units-template.csv"',
    },
  });
}
