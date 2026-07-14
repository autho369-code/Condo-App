import { createClient } from '@/lib/supabase/server';
import { requirePortfolioAdmin } from '@/lib/auth/me';
import { Input, Label, Select } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, PageHeader, PageShell, Surface } from '@/components/ui/shell';
import { StatusChip } from '@/components/operations/status-chip';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { OPERATING_DOCS, REQUIRED_OPERATING_TYPES } from '@/lib/associations/operating-docs';

export const dynamic = 'force-dynamic';

async function createAssociation(formData: FormData) {
  'use server';
  const failTo = (msg: string) => {
    redirect(`/onboard?error=${encodeURIComponent(msg)}`);
  };
  const supabase = await createClient();
  const me = await (await import('@/lib/auth/me')).requirePortfolioAdmin();
  if (!me.auth_user_id) failTo('Could not determine current user.');
  const { error } = await (supabase as any).from('associations').insert({
    portfolio_id: me.portfolio.id,
    name:    formData.get('name') as string,
    address: formData.get('address') as string,
    city:    formData.get('city') as string,
    state:   formData.get('state') as string,
    zip:     formData.get('zip') as string,
    fiscal_year_start: parseInt(formData.get('fiscal_year_start') as string) || 1,
    status:  'active',
    created_by: me.auth_user_id,
  });
  if (error) failTo(error.message);
  revalidatePath('/onboard');
}

async function finishOnboarding() {
  'use server';
  redirect('/dashboard');
}

export default async function OnboardPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const me = await requirePortfolioAdmin();
  const { error: errorMessage } = await searchParams;
  const supabase = await createClient();

  const [{ data: assocRows }, { count: unitCount }, { count: ownerCount }, { count: staffCount }, { data: subscription }] = await Promise.all([
    (supabase as any).from('associations').select('id, name').eq('portfolio_id', me.portfolio.id).is('archived_at', null),
    (supabase as any).from('units').select('*', { count: 'exact', head: true }),
    (supabase as any).from('owners').select('*', { count: 'exact', head: true }).eq('portfolio_id', me.portfolio.id),
    (supabase as any).from('profiles').select('*', { count: 'exact', head: true }).eq('portfolio_id', me.portfolio.id).eq('hoa_role', 'manager'),
    (supabase as any).from('subscriptions').select('*').eq('portfolio_id', me.portfolio.id).maybeSingle(),
  ]);
  const associations = assocRows ?? [];
  const associationCount = associations.length;

  // Operating documents: every client must have all required types on file.
  const missingDocsByAssoc: { id: string; name: string; missing: string[] }[] = [];
  if (associationCount > 0) {
    const { data: docRows } = await (supabase as any)
      .from('documents')
      .select('entity_id, doc_type')
      .eq('entity_type', 'association')
      .in('entity_id', associations.map((a: any) => a.id))
      .in('doc_type', REQUIRED_OPERATING_TYPES);
    const typesByAssoc = new Map<string, Set<string>>();
    for (const d of docRows ?? []) {
      const set = typesByAssoc.get(d.entity_id) ?? new Set<string>();
      set.add(d.doc_type);
      typesByAssoc.set(d.entity_id, set);
    }
    for (const a of associations) {
      const have = typesByAssoc.get(a.id) ?? new Set<string>();
      const missing = OPERATING_DOCS.filter((o) => o.required && !have.has(o.type)).map((o) => o.label);
      if (missing.length > 0) missingDocsByAssoc.push({ id: a.id, name: a.name, missing });
    }
  }
  const operatingDocsDone = associationCount > 0 && missingDocsByAssoc.length === 0;

  // Step status
  const steps = [
    { key: '1', label: 'Add your first association', done: associationCount > 0 },
    { key: '2', label: 'Add buildings + units',      done: (unitCount ?? 0) > 0 },
    { key: '3', label: 'Import owners',          done: (ownerCount ?? 0) > 0 },
    { key: '4', label: 'Upload operating documents',  done: operatingDocsDone },
    { key: '5', label: 'Invite your team',           done: (staffCount ?? 0) > 1 },
    { key: '6', label: 'Set up payment instructions + finish', done: false },
  ];
  const progress = Math.round(steps.filter((s) => s.done).length / steps.length * 100);

  return (
    <PageShell className="max-w-4xl">
      <PageHeader
        title={`Welcome to ${me.portfolio.company_name}`}
        description="Let's get your first association running. Should take about 30 minutes."
      />

      <div className="space-y-6">
        <div>
          <div className="h-2 overflow-hidden rounded-full bg-gray-100">
            <div className="h-full bg-gray-950 transition-all" style={{ width: `${progress}%` }} />
          </div>
          <div className="mt-1 text-xs text-gray-500">{progress}% complete · {steps.filter((s) => s.done).length} of {steps.length}</div>
        </div>

        {errorMessage && <Alert tone="danger" title="Something went wrong:">{errorMessage}</Alert>}

        {/* Operating documents — every new client starts here */}
        <Surface>
          <h2 className="mb-1 text-[15px] font-semibold tracking-[-0.01em] text-gray-950">Your operating documents</h2>
          <p className="text-sm text-gray-600">
            Keep these open while you set up — they walk through every step below and the day-to-day operations after launch.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a href="/manuals/Portier369-Company-Admin-Guide.pdf" target="_blank" rel="noopener noreferrer">
              <Button variant="secondary">Company Admin Guide (PDF)</Button>
            </a>
            <a href="/manuals/Portier369-Manager-Runbook.pdf" target="_blank" rel="noopener noreferrer">
              <Button variant="secondary">Manager Runbook (PDF)</Button>
            </a>
          </div>
        </Surface>

        {/* Trial countdown */}
        {subscription?.status === 'trialing' && subscription.trial_ends_at && (
          <Alert tone="info">
            You&apos;re on a free trial. {Math.max(0, Math.round((new Date(subscription.trial_ends_at).getTime() - Date.now()) / 86400000))} days remaining.
            No charges until your trial ends.
          </Alert>
        )}

        {/* STEP 1 */}
        <Surface>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-gray-950">
              {steps[0].done ? '✓ ' : '1 — '}{steps[0].label}
            </h2>
            {steps[0].done && <StatusChip tone="success">Done</StatusChip>}
          </div>
          {steps[0].done ? (
            <p className="text-sm text-gray-600">
              Great — you have {associationCount} association{(associationCount ?? 0) === 1 ? '' : 's'} set up.
              <Link href="/associations" className="ml-1 font-medium text-gray-700 hover:text-gray-950 hover:underline">Manage</Link>
            </p>
          ) : (
            <form action={createAssociation as any} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="name">Association name</Label>
                <Input id="name" name="name" required placeholder="e.g. Granville Courts Condominium Association" />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="address">Street address</Label>
                <Input id="address" name="address" required />
              </div>
              <div><Label htmlFor="city">City</Label><Input id="city" name="city" required /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label htmlFor="state">State</Label><Input id="state" name="state" maxLength={2} required /></div>
                <div><Label htmlFor="zip">ZIP</Label><Input id="zip" name="zip" required /></div>
              </div>
              <div>
                <Label htmlFor="fiscal_year_start">Fiscal year starts</Label>
                <Select id="fiscal_year_start" name="fiscal_year_start" defaultValue={1}>
                  {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m, i) => (
                    <option key={i + 1} value={i + 1}>{m}</option>
                  ))}
                </Select>
              </div>
              <div className="sm:col-span-2"><Button type="submit">Create association</Button></div>
            </form>
          )}
        </Surface>

        {/* STEP 2-3 (links to existing pages) */}
        {[
          { ...steps[1], href: '/associations', desc: 'Open the association you just created and add its buildings and units.' },
          { ...steps[2], href: '/owners',       desc: 'Add owner contact info. We\'ll match them to units in the next step.' },
        ].map((s, i) => (
          <Surface key={s.key}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-gray-950">
                {s.done ? '✓ ' : `${i + 2} — `}{s.label}
              </h2>
              {s.done && <StatusChip tone="success">Done</StatusChip>}
            </div>
            <p className="text-sm text-gray-600">{s.desc}</p>
            <div className="mt-4">
              <Link href={s.href}>
                <Button variant={s.done ? 'secondary' : 'primary'}>
                  {s.done ? 'Manage' : 'Open'}
                </Button>
              </Link>
            </div>
          </Surface>
        ))}

        {/* STEP 4 — Operating documents (required for every client) */}
        <Surface>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-gray-950">
              {steps[3].done ? '✓ ' : '4 — '}{steps[3].label}
            </h2>
            {steps[3].done && <StatusChip tone="success">Done</StatusChip>}
          </div>
          <p className="text-sm text-gray-600">
            Every client needs its operating documents on file: {OPERATING_DOCS.filter((o) => o.required).map((o) => o.label).join(', ')}.
            Owners and board members see them in their portals under Governing Documents.
          </p>
          {missingDocsByAssoc.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {missingDocsByAssoc.map((a) => (
                <li key={a.id} className="text-sm text-gray-600">
                  <Link href={`/associations/${a.id}/documents`} className="font-medium text-amber-700 hover:underline">{a.name}</Link>
                  <span className="text-gray-500"> — missing: {a.missing.join(', ')}</span>
                </li>
              ))}
            </ul>
          )}
          {associationCount > 0 && (
            <div className="mt-4">
              <Link href={missingDocsByAssoc.length > 0 ? `/associations/${missingDocsByAssoc[0].id}/documents` : '/associations'}>
                <Button variant={steps[3].done ? 'secondary' : 'primary'}>
                  {steps[3].done ? 'Manage' : 'Upload documents'}
                </Button>
              </Link>
            </div>
          )}
        </Surface>

        {/* STEP 5 — Invite your team */}
        <Surface>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-gray-950">
              {steps[4].done ? '✓ ' : '5 — '}{steps[4].label}
            </h2>
            {steps[4].done && <StatusChip tone="success">Done</StatusChip>}
          </div>
          <p className="text-sm text-gray-600">Add accountants, property managers, and on-site staff.</p>
          <div className="mt-4">
            <Link href="/settings">
              <Button variant={steps[4].done ? 'secondary' : 'primary'}>
                {steps[4].done ? 'Manage' : 'Open'}
              </Button>
            </Link>
          </div>
        </Surface>

        {/* STEP 6 — Payment instructions + finish */}
        <Surface>
          <h2 className="mb-3 text-[15px] font-semibold tracking-[-0.01em] text-gray-950">
            6 — Set up payment instructions
          </h2>
          <p className="text-sm text-gray-600">
            Tell owners how to pay assessments. Open each association&apos;s profile and add your
            payment instructions (mailing address for checks, bank details for transfers). Owners
            see these on their &ldquo;How to Pay&rdquo; page, and managers record received payments manually.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/associations">
              <Button variant="secondary">Open associations →</Button>
            </Link>
            <form action={finishOnboarding as any}>
              <Button type="submit">I&apos;m set — go to dashboard</Button>
            </form>
          </div>
        </Surface>
      </div>
    </PageShell>
  );
}
