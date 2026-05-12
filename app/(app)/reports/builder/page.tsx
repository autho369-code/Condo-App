import Link from 'next/link';
import { requireStaff } from '@/lib/auth/me';
import { Workspace, WorkspaceHeader, Section } from '@/components/reports/workspace';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

export default async function ReportBuilderPage() {
  await requireStaff();

  return (
    <Workspace
      header={
        <WorkspaceHeader
          eyebrow={<Link href="/reports" className="hover:text-brand-600">Reports</Link>}
          title="Report Builder"
          subtitle="Create report presets and custom layouts from the report catalog."
          actions={
            <Link href="/reports">
              <Button variant="secondary" size="sm">Back to Reports</Button>
            </Link>
          }
        />
      }
      rail={
        <div className="space-y-5">
          <RailSection title="Tasks">
            <RailLink href="/reports">Reports</RailLink>
            <RailLink href="/scheduled-reports">Scheduled Reports</RailLink>
            <RailLink href="/reports/runs">Run History</RailLink>
          </RailSection>
          <RailSection title="Help Topics">
            <RailLink href="/reports/builder">Report Builder</RailLink>
            <RailLink href="/reports">Reports</RailLink>
            <RailLink href="/reports/pricing_metrics">Pricing Metrics</RailLink>
          </RailSection>
          <RailSection title="Useful Links">
            <RailLink href="/metrics">Metrics</RailLink>
            <RailLink href="/surveys/maintenance/responses">Maintenance Survey Responses</RailLink>
            <RailLink href="/bank-accounts/activity">Banking Activity</RailLink>
          </RailSection>
        </div>
      }
    >
      <Section title="Builder">
        <div className="px-5 py-8 text-sm text-gray-600">
          Report Builder is reserved for the custom report workflow. Use the report catalog to run or save standard reports while this workspace is being built out.
        </div>
      </Section>
    </Workspace>
  );
}

function RailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-sm font-semibold text-gray-700">{title}</div>
      <ul className="space-y-1.5">{children}</ul>
    </div>
  );
}

function RailLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link href={href} className="block text-sm text-blue-700 hover:underline">{children}</Link>
    </li>
  );
}
