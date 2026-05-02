import { createClient } from '@/lib/supabase/server';
import { requirePortfolioAdmin } from '@/lib/auth/me';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/card';
import { Input, Label } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

async function createAssociation(formData: FormData) {
  'use server';
  const supabase = await createClient();
  const me = await (await import('@/lib/auth/me')).requirePortfolioAdmin();
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
  if (error) return { error: error.message };
  revalidatePath('/onboard');
}

async function finishOnboarding() {
  'use server';
  redirect('/dashboard');
}

export default async function OnboardPage() {
  const me = await requirePortfolioAdmin();
  const supabase = await createClient();

  const [{ count: associationCount }, { count: unitCount }, { count: ownerCount }, { count: staffCount }, { data: subscription }] = await Promise.all([
    (supabase as any).from('associations').select('*', { count: 'exact', head: true }).eq('portfolio_id', me.portfolio.id),
    (supabase as any).from('units').select('*', { count: 'exact', head: true }),
    (supabase as any).from('owners').select('*', { count: 'exact', head: true }).eq('portfolio_id', me.portfolio.id),
    (supabase as any).from('profiles').select('*', { count: 'exact', head: true }).eq('portfolio_id', me.portfolio.id).eq('hoa_role', 'manager'),
    (supabase as any).from('subscriptions').select('*').eq('portfolio_id', me.portfolio.id).maybeSingle(),
  ]);

  // Step status
  const steps = [
    { key: '1', label: 'Add your first association', done: (associationCount ?? 0) > 0 },
    { key: '2', label: 'Add buildings + units',      done: (unitCount ?? 0) > 0 },
    { key: '3', label: 'Import owners',          done: (ownerCount ?? 0) > 0 },
    { key: '4', label: 'Invite your team',           done: (staffCount ?? 0) > 1 },
    { key: '5', label: 'Connect Stripe + finish',    done: false },
  ];
  const progress = Math.round(steps.filter((s) => s.done).length / steps.length * 100);

  return (
    <div className="mx-auto h-full max-w-7xl overflow-y-auto px-8 py-6">
      <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold">Welcome to {me.portfolio.company_name}</h1>
        <p className="mt-2 text-gray-600">Let&apos;s get your first association running. Should take about 30 minutes.</p>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-gray-100">
          <div className="h-full bg-brand-600 transition-all" style={{ width: `${progress}%` }} />
        </div>
        <div className="mt-1 text-xs text-gray-500">{progress}% complete · {steps.filter((s) => s.done).length} of {steps.length}</div>
      </header>

      {/* Trial countdown */}
      {subscription?.status === 'trialing' && subscription.trial_ends_at && (
        <div className="rounded-md border border-brand-200 bg-brand-50 p-4 text-sm">
          You&apos;re on a free trial. {Math.max(0, Math.round((new Date(subscription.trial_ends_at).getTime() - Date.now()) / 86400000))} days remaining.
          No charges until your trial ends.
        </div>
      )}

      {/* STEP 1 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{steps[0].done ? '✓ ' : '1 — '}{steps[0].label}</CardTitle>
            {steps[0].done && <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">Done</span>}
          </div>
        </CardHeader>
        <CardBody>
          {steps[0].done ? (
            <p className="text-sm text-gray-600">Great — you have {associationCount} association{(associationCount ?? 0) === 1 ? '' : 's'} set up.
              <Link href="/associations" className="ml-1 text-brand-600 hover:underline">Manage</Link></p>
          ) : (
            <form action={createAssociation as any} className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="md:col-span-2">
                <Label htmlFor="name">Association name</Label>
                <Input id="name" name="name" required placeholder="e.g. Granville Courts Condominium Association" />
              </div>
              <div className="md:col-span-2">
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
                <select id="fiscal_year_start" name="fiscal_year_start" defaultValue={1}
                  className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm">
                  {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((m, i) => (
                    <option key={i+1} value={i+1}>{m}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2 flex justify-end"><Button type="submit">Create association</Button></div>
            </form>
          )}
        </CardBody>
      </Card>

      {/* STEP 2-4 (links to existing pages) */}
      {[
        { ...steps[1], href: '/associations', desc: 'Open the association you just created and add its buildings and units.' },
        { ...steps[2], href: '/owners',       desc: 'Add owner contact info. We\'ll match them to units in the next step.' },
        { ...steps[3], href: '/settings',     desc: 'Add accountants, property managers, and on-site staff.' },
      ].map((s, i) => (
        <Card key={s.key}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{s.done ? '✓ ' : `${i+2} — `}{s.label}</CardTitle>
              {s.done && <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">Done</span>}
            </div>
          </CardHeader>
          <CardBody>
            <p className="text-sm text-gray-600">{s.desc}</p>
            <div className="mt-4">
              <Link href={s.href}>
                <Button variant={s.done ? 'secondary' : 'primary'}>
                  {s.done ? 'Manage' : 'Open'}
                </Button>
              </Link>
            </div>
          </CardBody>
        </Card>
      ))}

      {/* STEP 5 — Stripe + finish */}
      <Card>
        <CardHeader><CardTitle>5 — Connect Stripe (optional but recommended)</CardTitle></CardHeader>
        <CardBody>
          <p className="text-sm text-gray-600">
            Connect a Stripe account so owners can pay assessments online via ACH or card.
            You can also skip this and use manual check entry only.
          </p>
          <div className="mt-4 flex gap-2">
            <a href="https://dashboard.stripe.com/register" target="_blank" rel="noopener noreferrer">
              <Button variant="secondary">Sign up for Stripe →</Button>
            </a>
            <form action={finishOnboarding as any}>
              <Button type="submit">I&apos;m set — go to dashboard</Button>
            </form>
          </div>
        </CardBody>
      </Card>
      </div>
    </div>
  );
}
