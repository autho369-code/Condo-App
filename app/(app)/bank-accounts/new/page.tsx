import Link from 'next/link';
import type { ReactNode } from 'react';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { requireStaff } from '@/lib/auth/me';
import { createBankAccount } from '@/lib/rpcs/entities';
import { createClient } from '@/lib/supabase/server';

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
    (supabase as any).from('associations').select('id, name').is('archived_at', null).order('name'),
    (supabase as any).from('gl_accounts').select('id, number, name, account_type').eq('active', true).order('number'),
  ]);

  const cashGLs = (glAccounts ?? []).filter((account: any) =>
    account.account_type === 'cash' || (account.number >= 1000 && account.number < 2000),
  );

  return (
    <DataWorkspace
      title="New bank account"
      description="Create the account record, map it to the association and GL, and capture payment/reconciliation settings safely."
      actions={<Link href="/bank-accounts" className="text-sm font-medium text-ink-600 hover:text-ink-900">Cancel</Link>}
      rail={<SetupRail />}
    >
      <form action={createBankAccount as unknown as (formData: FormData) => Promise<void>} className="space-y-5">
        {return_to && <input type="hidden" name="return_to" value={return_to} />}

        <FormSection title="Bank information" description="Internal account identity and bank classification.">
          <Field label="Account name" required><Input name="name" required placeholder="Operating, reserve, trust" /></Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Bank name" required><Input name="bank_name" required placeholder="Chase, Byline, US Bank" /></Field>
            <Field label="Account type">
              <select name="account_type" defaultValue="checking" className="h-10 w-full rounded border border-ink-200 bg-white px-3 text-sm">
                <option value="checking">Checking</option>
                <option value="savings">Savings</option>
                <option value="money_market">Money Market</option>
                <option value="trust">Trust</option>
              </select>
            </Field>
          </div>
          <p className="text-xs text-ink-500">Routing and account numbers are stored for operations but masked everywhere after save.</p>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Routing number"><Input name="routing_number" inputMode="numeric" placeholder="9-digit ABA" /></Field>
            <Field label="Account number"><Input name="account_number" inputMode="numeric" /></Field>
            <Field label="Next check number"><Input name="next_check_number" type="number" min="1" placeholder="1001" /></Field>
          </div>
        </FormSection>

        <FormSection title="Legal entity" description="Connect the account to the association and chart of accounts.">
          <Field label="Association">
            <select name="association_id" defaultValue={association ?? ''} className="h-10 w-full rounded border border-ink-200 bg-white px-3 text-sm">
              <option value="">Portfolio-level account</option>
              {(associations ?? []).map((row: any) => <option key={row.id} value={row.id}>{row.name}</option>)}
            </select>
          </Field>
          <Field label="GL account">
            <select name="gl_account_id" defaultValue="" className="h-10 w-full rounded border border-ink-200 bg-white px-3 text-sm">
              <option value="">Select cash account</option>
              {cashGLs.map((row: any) => <option key={row.id} value={row.id}>{row.number}: {row.name}</option>)}
            </select>
          </Field>
        </FormSection>

        <FormSection title="Ownership" description="Internal legal ownership notes for checks and bank records.">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Entity name"><Input name="entity_name" placeholder="Association or management entity" /></Field>
            <Field label="Company name"><Input name="company_name" placeholder="Printed check company name" /></Field>
          </div>
          <Field label="Entity address"><Input name="entity_address" placeholder="Legal banking address" /></Field>
        </FormSection>

        <FormSection title="Accounting" description="Payments, deposits, reconciliation, and accounting behavior.">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="payments_enabled" /> Accept online payments into this account</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="auto_reconciliation" /> Enable automatic reconciliation</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="use_printable_deposit_slip" /> Use printable deposit slips</label>
        </FormSection>

        <FormSection title="Check printing" description="Optional check signature and company address guidance.">
          <Field label="Check signature"><Input name="check_signature" placeholder="Signature label or signer name" /></Field>
          <Field label="Company address"><Input name="company_address" placeholder="Address printed on checks" /></Field>
        </FormSection>

        <FormSection title="Notes" description="Internal operating context for accounting staff.">
          <textarea name="description" rows={3} className="w-full rounded border border-ink-200 bg-white px-3 py-2 text-sm" placeholder="Internal notes about this account" />
        </FormSection>

        <FormSection title="Attachments" description="Attach statements, bank letters, or authorization documents after the account is saved.">
          <div className="rounded border border-dashed border-ink-200 bg-cream-50 px-4 py-6 text-center text-sm text-ink-500">Attachment upload is available on the saved account record.</div>
        </FormSection>

        <div className="flex justify-end gap-2">
          <Link href={return_to && return_to.startsWith('/') ? return_to : '/bank-accounts'} className="rounded border border-ink-200 px-4 py-2 text-sm font-medium text-ink-700 hover:bg-cream-50">Cancel</Link>
          <Button type="submit">Create bank account</Button>
        </div>
      </form>
    </DataWorkspace>
  );
}

function FormSection({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="rounded border border-ink-100 bg-white p-5">
      <h2 className="text-sm font-semibold text-ink-900">{title}</h2>
      <p className="mt-1 text-xs text-ink-500">{description}</p>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <Label className="block text-sm">
      {label}{required && <span className="text-red-500"> *</span>}
      <div className="mt-1">{children}</div>
    </Label>
  );
}

function SetupRail() {
  return (
    <div className="space-y-4 text-sm text-ink-600">
      <h2 className="text-sm font-semibold text-ink-900">Setup checklist</h2>
      <p>Save the account first, then attach bank authorization documents and enable provider linking only after staff confirmation.</p>
      <Link href="/bank-accounts/feeds" className="block rounded border border-ink-100 px-3 py-2 font-medium text-ink-700 hover:bg-cream-50">Bank feed setup</Link>
    </div>
  );
}
