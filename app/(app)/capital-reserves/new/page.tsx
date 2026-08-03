import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Input, Label, Select, Textarea } from '@/components/ui/input';
import { Alert, Breadcrumb, PageHeader, PageShell, SectionTitle, Surface } from '@/components/ui/shell';
import { requireWorkspaceStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';

import { createReserveStudy } from '../actions';

export const dynamic = 'force-dynamic';

export default async function NewReserveStudyPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireWorkspaceStaff();
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data: associations } = await (supabase as any)
    .from('associations')
    .select('id, name')
    .is('archived_at', null)
    .order('name');
  const currentYear = new Date().getFullYear();

  return (
    <PageShell className="max-w-5xl">
      <Breadcrumb items={[{ label: 'Capital & Reserves', href: '/capital-reserves' }, { label: 'New study' }]} />
      <PageHeader
        title="New reserve study"
        description="Set the financial assumptions first. Components and alternative funding scenarios are added after the study is created."
      />

      {error && <Alert className="mb-5" title="Could not create the study.">{error}</Alert>}

      <Surface>
        <SectionTitle title="Study assumptions" description="Use the latest adopted reserve study or the association's approved planning assumptions as the source." />
        <form action={createReserveStudy} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="association_id">Association</Label>
            <Select id="association_id" name="association_id" required defaultValue="">
              <option value="" disabled>Select association</option>
              {(associations ?? []).map((association: any) => <option key={association.id} value={association.id}>{association.name}</option>)}
            </Select>
          </div>
          <div>
            <Label htmlFor="name">Study name</Label>
            <Input id="name" name="name" required placeholder={`${currentYear} capital reserve plan`} />
          </div>
          <div>
            <Label htmlFor="study_date">Study date</Label>
            <Input id="study_date" name="study_date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
          </div>
          <div>
            <Label htmlFor="prepared_by">Prepared by</Label>
            <Input id="prepared_by" name="prepared_by" placeholder="Firm or reserve specialist" />
          </div>
          <div>
            <Label htmlFor="base_year">Base year</Label>
            <Input id="base_year" name="base_year" type="number" min="2000" max="2200" defaultValue={currentYear} required />
          </div>
          <div>
            <Label htmlFor="horizon_years">Projection horizon</Label>
            <Select id="horizon_years" name="horizon_years" defaultValue="30">
              <option value="10">10 years</option>
              <option value="20">20 years</option>
              <option value="30">30 years</option>
              <option value="40">40 years</option>
              <option value="50">50 years</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="opening_balance">Opening reserve balance ($)</Label>
            <Input id="opening_balance" name="opening_balance" type="number" min="0" step="0.01" defaultValue="0" required />
          </div>
          <div>
            <Label htmlFor="annual_contribution">Annual reserve contribution ($)</Label>
            <Input id="annual_contribution" name="annual_contribution" type="number" min="0" step="0.01" defaultValue="0" required />
          </div>
          <div>
            <Label htmlFor="annual_contribution_growth_rate">Annual contribution growth (%)</Label>
            <Input id="annual_contribution_growth_rate" name="annual_contribution_growth_rate" type="number" min="-25" max="100" step="0.01" defaultValue="0" required />
          </div>
          <div>
            <Label htmlFor="annual_inflation_rate">Replacement cost inflation (%)</Label>
            <Input id="annual_inflation_rate" name="annual_inflation_rate" type="number" min="0" max="25" step="0.01" defaultValue="3" required />
          </div>
          <div>
            <Label htmlFor="annual_interest_rate">Reserve earnings rate (%)</Label>
            <Input id="annual_interest_rate" name="annual_interest_rate" type="number" min="0" max="25" step="0.01" defaultValue="1" required />
          </div>
          <div>
            <Label htmlFor="funding_goal">Funding policy</Label>
            <Select id="funding_goal" name="funding_goal" defaultValue="threshold">
              <option value="baseline">Current contribution plan</option>
              <option value="threshold">Threshold funding</option>
              <option value="full_funding">Full funding</option>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="notes">Source notes</Label>
            <Textarea id="notes" name="notes" placeholder="Study source, board assumptions, statutory requirements, and review notes" />
          </div>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Button type="submit">Create study</Button>
            <Link href="/capital-reserves"><Button type="button" variant="secondary">Cancel</Button></Link>
          </div>
        </form>
      </Surface>
    </PageShell>
  );
}
