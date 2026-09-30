import { Breadcrumb, PageHeader, PageShell, SectionTitle, Surface } from '@/components/ui/shell';
import { CsvUploadForm } from '@/components/imports/csv-upload-form';
import { requireFinanceStaff } from '@/lib/auth/me';
import { importJournalEntries } from '@/lib/rpcs/imports';

export const dynamic = 'force-dynamic';

const TEMPLATE = [
  'entry,date,association,gl,debit,credit,memo',
  'SEP-1,2026-09-30,Granville Courts Condominium Association,6220,500.00,,Reserve contribution',
  'SEP-1,2026-09-30,Granville Courts Condominium Association,1150,,500.00,Reserve contribution',
].join('\n');

export default async function UploadJournalEntriesPage() {
  await requireFinanceStaff();
  return (
    <PageShell className="max-w-4xl">
      <Breadcrumb items={[{ label: 'Journal entries', href: '/journal-entries' }, { label: 'Upload batch' }]} />
      <PageHeader title="Upload journal entries" description="Post many entries at once from a spreadsheet." />
      <Surface className="mb-6">
        <SectionTitle title="How it works" />
        <ul className="list-disc space-y-1 pl-5 text-sm text-gray-600">
          <li>One row per line. Rows with the same <strong>entry</strong> value form one journal entry and must balance.</li>
          <li><strong>association</strong> is the association name; <strong>gl</strong> is the GL account number.</li>
          <li>Put the amount in <strong>debit</strong> or <strong>credit</strong>, not both. <strong>date</strong> is YYYY-MM-DD.</li>
          <li>Every row is checked first. If anything is wrong, nothing is posted and you get the row numbers to fix.</li>
        </ul>
      </Surface>
      <Surface>
        <CsvUploadForm action={importJournalEntries} templateCsv={TEMPLATE} templateName="journal-entries-template.csv" showName submitLabel="Check and post" />
      </Surface>
    </PageShell>
  );
}
