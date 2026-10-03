import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Alert } from '@/components/ui/shell';
import { requireFinanceStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { fetchAllRows } from '@/lib/supabase/fetch-all';
import { GL_ACCOUNT_TYPES, glWriteError } from '@/lib/gl/accounts';

export const dynamic = 'force-dynamic';

const ACCOUNT_TYPES = GL_ACCOUNT_TYPES;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const inputCls = 'h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20';

// Edit or deactivate a GL account. Type and association can only change while
// nothing uses the account (no ledger lines, bank accounts, loans, charge
// categories, ...), so history and linked setups keep their meaning.
async function updateGlAccount(formData: FormData) {
  'use server';
  await requireFinanceStaff();
  const id = String(formData.get('id') ?? '');
  if (!UUID.test(id)) redirect('/gl-accounts');
  const fail = (m: string): never => redirect(`/gl-accounts/${id}?error=${encodeURIComponent(m)}`);
  const db = (await createClient()) as any;

  const { data: current } = await db.from('gl_accounts').select('id, portfolio_id, account_type, association_id').eq('id', id).maybeSingle();
  if (!current) fail('GL account not found.');

  const number = parseInt(String(formData.get('number') ?? ''), 10);
  const name = String(formData.get('name') ?? '').trim();
  const accountType = String(formData.get('account_type') ?? '');
  const associationId = String(formData.get('association_id') ?? '') || null;
  const parentId = String(formData.get('sub_account_of_id') ?? '') || null;
  if (parentId && !UUID.test(parentId)) fail('Choose a valid parent account.');
  if (parentId === id) fail('An account cannot be its own sub-account.');
  if (!Number.isFinite(number) || number < 1000 || number > 9999) fail('Account number must be between 1000 and 9999.');
  if (!name) fail('Enter an account name.');
  if (!ACCOUNT_TYPES.includes(accountType)) fail('Select an account type.');
  if (associationId && !UUID.test(associationId)) fail('Choose a valid association.');
  // The association must be one the caller can see, in the account's company.
  if (associationId && associationId !== current.association_id) {
    const { data: assocRow } = await db.from('associations').select('id, portfolio_id').eq('id', associationId).maybeSingle();
    if (!assocRow || assocRow.portfolio_id !== current.portfolio_id) fail('Choose one of your associations.');
  }

  if (accountType !== current.account_type || associationId !== current.association_id) {
    const { data: inUse, error: inUseError } = await db.rpc('gl_account_in_use', { p_gl_account_id: id });
    if (inUseError) fail(inUseError.message);
    if (inUse) fail('This account is already used (ledger entries, a bank account, loan, charge category or similar), so its type and association cannot change. Create a new account instead.');
  }

  const { data, error } = await db.from('gl_accounts').update({
    number,
    name,
    account_type: accountType,
    association_id: associationId,
    sub_account_of_id: parentId,
    description: String(formData.get('description') ?? '').trim() || null,
    include_on_cash_flow: formData.get('include_on_cash_flow') === 'on',
    subject_to_management_fees: formData.get('subject_to_management_fees') === 'on',
    active: formData.get('active') === 'on',
  }).eq('id', id).select('id').maybeSingle();
  if (error) fail(glWriteError(error.message));
  if (!data) fail('You do not have permission to change this account.');
  revalidatePath('/gl-accounts');
  redirect('/gl-accounts?saved=1');
}

export default async function EditGlAccountPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  await requireFinanceStaff();
  const { id } = await params;
  const sp = await searchParams;
  if (!UUID.test(id)) notFound();
  const db = (await createClient()) as any;
  const [{ data: account }, { data: associations }, { data: inUse }, { rows: parents }] = await Promise.all([
    db.from('gl_accounts').select('id, number, name, account_type, association_id, sub_account_of_id, description, include_on_cash_flow, subject_to_management_fees, active, associations(id, name, archived_at)').eq('id', id).maybeSingle(),
    db.from('associations').select('id, name').is('archived_at', null).order('name'),
    db.rpc('gl_account_in_use', { p_gl_account_id: id }),
    fetchAllRows<any>(() => db.from('gl_accounts').select('id, number, name, active').neq('id', id).order('number').order('id')),
  ]);
  if (!account) notFound();
  const locked = inUse === true;
  // Keep the account's current association selectable even if it is archived,
  // so saving another field never clears it.
  const assocOptions = [...((associations ?? []) as Array<{ id: string; name: string }>)];
  if (account.associations && !assocOptions.some((a) => a.id === account.associations.id)) {
    assocOptions.push({ id: account.associations.id, name: `${account.associations.name} (archived)` });
  }

  return (
    <DataWorkspace
      title={`${account.number} · ${account.name}`}
      description="Edit this general ledger account, or mark it inactive so it is no longer offered for new entries."
      actions={<Link href="/gl-accounts"><Button variant="secondary">Back to GL accounts</Button></Link>}
    >
      <form action={updateGlAccount} className="max-w-2xl space-y-5 rounded-2xl border border-gray-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        {sp.error && <Alert tone="danger" title="Could not save the account">{sp.error}</Alert>}
        <input type="hidden" name="id" value={account.id} />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <Label htmlFor="number">Account number <span className="text-red-500">*</span></Label>
            <Input id="number" name="number" type="number" min={1000} max={9999} required defaultValue={account.number} />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="name">Account name <span className="text-red-500">*</span></Label>
            <Input id="name" name="name" required defaultValue={account.name} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="account_type">Account type <span className="text-red-500">*</span></Label>
            <select id="account_type" name="account_type" required defaultValue={account.account_type} className={`${inputCls} capitalize`}>
              {ACCOUNT_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div>
            <Label htmlFor="association_id">Association</Label>
            <select id="association_id" name="association_id" defaultValue={account.association_id ?? ''} className={inputCls}>
              <option value="">Portfolio-wide</option>
              {assocOptions.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
        </div>
        {locked && (
          <p className="text-xs text-gray-500">This account is already in use, so its type and association can&apos;t be changed.</p>
        )}

        <div>
          <Label htmlFor="sub_account_of_id">Sub-account of</Label>
          <select id="sub_account_of_id" name="sub_account_of_id" defaultValue={account.sub_account_of_id ?? ''} className={inputCls}>
            <option value="">None — a top-level account</option>
            {(parents ?? []).filter((a: any) => a.active || a.id === account.sub_account_of_id).map((a: any) => (
              <option key={a.id} value={a.id}>{a.number} · {a.name}{a.active ? '' : ' (inactive)'}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-400">A sub-account has the same type as its parent and rolls up under it.</p>
        </div>

        <div>
          <Label htmlFor="description">Description</Label>
          <Input id="description" name="description" defaultValue={account.description ?? ''} />
        </div>

        <div className="space-y-2 border-t border-gray-100 pt-4">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" name="active" defaultChecked={account.active} className="accent-blue-600" /> Active (offered for new entries)
          </label>
          <p className="pl-6 text-xs text-gray-400">A balance-sheet account with a balance, or an account used by a bank account, active sub-accounts or the GL account map, can&apos;t be deactivated.</p>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" name="include_on_cash_flow" defaultChecked={account.include_on_cash_flow} className="accent-blue-600" /> Include on cash flow statement
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" name="subject_to_management_fees" defaultChecked={account.subject_to_management_fees} className="accent-blue-600" /> Subject to management fees
          </label>
        </div>

        <div className="flex items-center justify-between border-t border-gray-100 pt-5">
          <Link href="/gl-accounts" className="text-sm text-gray-600 hover:text-gray-900">Cancel</Link>
          <Button type="submit" size="lg">Save account</Button>
        </div>
      </form>
    </DataWorkspace>
  );
}
