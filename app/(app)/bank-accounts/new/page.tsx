import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { Input, Label } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { createBankAccount } from '@/lib/rpcs/entities';

export const dynamic = 'force-dynamic';

export default async function NewBankAccountPage({
  searchParams,
}: {
  searchParams: Promise<{ association?: string; return_to?: string }>;
}) {
  await requireStaff();
  const { association, return_to } = await searchParams;
  const supabase = await createClient();

  const [{ data: associations }, { data: glAccounts }] = await Promise.all([
    supabase.from('associations').select('id, name').is('archived_at', null).order('name'),
    // GL accounts suitable for bank accounts: cash / asset class (1000s)
    supabase.from('gl_accounts')
      .select('id, number, name, account_type')
      .eq('active', true)
      .order('number'),
  ]);

  const cashGLs = (glAccounts ?? []).filter((g: any) =>
    g.account_type === 'cash' || (g.number >= 1000 && g.number < 2000),
  );

  return (
    <div className="mx-auto max-w-3xl px-8 py-6 space-y-4">
      <nav className="text-xs font-semibold uppercase tracking-wider text-gray-500">
        <Link href="/bank-accounts" className="hover:text-brand-600">Bank Accounts</Link> · New
      </nav>
      <h1 className="text-2xl font-semibold text-gray-900">New Bank Account</h1>
      <p className="text-sm text-gray-500">
        Adds a bank account record to your portfolio. Assign it to an association to use for that HOA&apos;s receivables and payables.
      </p>

      <form action={createBankAccount} className="space-y-5 rounded border border-gray-200 bg-white p-5">
        {return_to && <input type="hidden" name="return_to" value={return_to} />}

        {/* -------- Basic -------- */}
        <div>
          <Label htmlFor="name">Account name <span className="text-red-500">*</span></Label>
          <Input id="name" name="name" required placeholder="e.g. Operating, Reserve, Trust" />
          <p className="mt-1 text-xs text-gray-500">What you call it internally (shows on statements and checks).</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="bank_name">Bank name <span className="text-red-500">*</span></Label>
            <Input id="bank_name" name="bank_name" required placeholder="e.g. Chase, Wells Fargo" />
          </div>
          <div>
            <Label htmlFor="account_type">Account type</Label>
            <select id="account_type" name="account_type" defaultValue="checking"
              className="h-10 w-full rounded border border-gray-300 bg-white px-3 text-sm">
              <option value="checking">Checking</option>
              <option value="savings">Savings</option>
              <option value="money_market">Money Market</option>
              <option value="trust">Trust</option>
            </select>
          </div>
        </div>

        {/* -------- Association assignment -------- */}
        <div>
          <Label htmlFor="association_id">Association</Label>
          <select
            id="association_id"
            name="association_id"
            defaultValue={association ?? ''}
            className="h-10 w-full rounded border border-gray-300 bg-white px-3 text-sm"
          >
            <option value="">Portfolio-level (no specific association)</option>
            {(associations ?? []).map((a: any) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500">
            Leave unset for portfolio-level accounts (e.g. management firm operating account).
          </p>
        </div>

        {/* -------- GL Account -------- */}
        <div>
          <Label htmlFor="gl_account_id">GL Account</Label>
          <select
            id="gl_account_id"
            name="gl_account_id"
            className="h-10 w-full rounded border border-gray-300 bg-white px-3 text-sm"
            defaultValue=""
          >
            <option value="">Select…</option>
            {cashGLs.map((g: any) => (
              <option key={g.id} value={g.id}>{g.number}: {g.name}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500">
            The chart-of-accounts entry this bank maps to. Typically a 1xxx asset account — &ldquo;Operating&rdquo;, &ldquo;Reserve&rdquo;, etc.
            {cashGLs.length === 0 && (
              <> <Link href="/gl-accounts" className="text-blue-700 hover:underline">Add GL accounts first →</Link></>
            )}
          </p>
        </div>

        {/* -------- Banking details -------- */}
        <div className="rounded border border-gray-200 bg-gray-50 p-4">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Banking details (optional)</div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="routing_number">Routing number</Label>
              <Input id="routing_number" name="routing_number" inputMode="numeric" placeholder="9-digit ABA" />
            </div>
            <div>
              <Label htmlFor="account_number">Account number</Label>
              <Input id="account_number" name="account_number" inputMode="numeric" />
            </div>
            <div>
              <Label htmlFor="next_check_number">Next check number</Label>
              <Input id="next_check_number" name="next_check_number" type="number" min="1" placeholder="1001" />
            </div>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Only needed if you plan to print checks or enable online payments. Can be filled in later.
          </p>
        </div>

        {/* -------- Flags -------- */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="payments_enabled" />
            Accept online payments into this account
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="auto_reconciliation" />
            Enable automatic reconciliation
          </label>
        </div>

        <div>
          <Label htmlFor="description">Description</Label>
          <textarea id="description" name="description" rows={2}
            placeholder="Internal notes about this account"
            className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm" />
        </div>

        {/* -------- Submit -------- */}
        <div className="flex items-center justify-between border-t border-gray-100 pt-5">
          <Link href={return_to && return_to.startsWith('/') ? return_to : '/bank-accounts'}
            className="text-sm text-gray-600 hover:text-gray-900">Cancel</Link>
          <Button type="submit" size="lg">Create Bank Account</Button>
        </div>
      </form>
    </div>
  );
}
