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

// ownership_pct is the UNIT's share of the whole association (all units add
// up to 100), not the owner's share of the unit. A co-owner row repeats the
// unit and can leave ownership_pct and monthly_dues blank: the first owner
// row of a unit is its primary owner and carries the unit's dues.
const EXAMPLES = [
  ['101', 'Jane', 'Doe', 'jane.doe@example.com', '(312) 555-0100', '1.25', '350.00', '2024-01-15'],
  ['101', 'John', 'Doe', 'john.doe@example.com', '', '', '', '2024-01-15'],
];

export function GET() {
  const csv = `${[HEADERS, ...EXAMPLES].map((row) => row.join(',')).join('\n')}\n`;
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="owners-units-template.csv"',
    },
  });
}
