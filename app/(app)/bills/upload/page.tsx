import { Breadcrumb, PageHeader, PageShell, SectionTitle, Surface } from '@/components/ui/shell';
import { CsvUploadForm } from '@/components/imports/csv-upload-form';
import { requireFinanceStaff } from '@/lib/auth/me';
import { importBills } from '@/lib/rpcs/imports';

export const dynamic = 'force-dynamic';

const TEMPLATE = [
  'vendor,association,gl,bill_number,bill_date,due_date,amount,memo',
  'ComEd,Granville Courts Condominium Association,6101,0098032222-0926,2026-09-23,2026-10-08,82.38,Common area electricity',
].join('\n');

export default async function UploadBillsPage() {
  await requireFinanceStaff();
  return (
    <PageShell className="max-w-4xl">
      <Breadcrumb items={[{ label: 'Payables', href: '/bills' }, { label: 'Upload bills' }]} />
      <PageHeader title="Upload bills" description="Enter many vendor bills at once from a spreadsheet." />
      <Surface className="mb-6">
        <SectionTitle title="How it works" />
        <ul className="list-disc space-y-1 pl-5 text-sm text-gray-600">
          <li>One bill per row. <strong>vendor</strong> and <strong>association</strong> are names; <strong>gl</strong> is the expense account number.</li>
          <li>Dates are YYYY-MM-DD; leave <strong>due_date</strong> blank to use the bill date.</li>
          <li>Bills are created as drafts and follow each association&apos;s board-approval rules. Submit or approve them from the bills list.</li>
          <li>A bill number already entered for that vendor is rejected, so the same invoice can&apos;t be uploaded twice.</li>
          <li>If any row is wrong, nothing is created and you get the row numbers to fix.</li>
        </ul>
      </Surface>
      <Surface>
        <CsvUploadForm action={importBills} templateCsv={TEMPLATE} templateName="bills-template.csv" submitLabel="Check and create bills" />
      </Surface>
    </PageShell>
  );
}
