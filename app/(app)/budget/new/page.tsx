'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ArrowLeft, Save } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { Alert, PageShell, Surface } from '@/components/ui/shell';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function NewBudgetLinePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [monthlyAmounts, setMonthlyAmounts] = useState<number[]>(Array(12).fill(0));
  const [equalAmount, setEqualAmount] = useState('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const form = new FormData(e.currentTarget);
    const supabase = createClient() as any;

    const { error: rpcError } = await supabase.rpc('upsert_budget_line', {
      p_id: null,
      p_association_id: form.get('association_id'),
      p_gl_account_id: form.get('gl_account_id'),
      p_fiscal_year: parseInt(form.get('fiscal_year') as string, 10),
      p_monthly_amounts: monthlyAmounts,
      p_category: form.get('category'),
      p_notes: form.get('notes') || null,
    });

    if (rpcError) {
      setError(rpcError.message);
      setLoading(false);
      return;
    }

    const assoc = form.get('association_id') as string;
    const year = form.get('fiscal_year') as string;
    router.push(`/budget?association=${assoc}&year=${year}`);
    router.refresh();
  }

  function applyEqualDistribution() {
    const val = parseFloat(equalAmount);
    if (!isNaN(val) && val >= 0) {
      setMonthlyAmounts(Array(12).fill(val));
    }
  }

  return (
    <PageShell className="max-w-2xl">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/budget" className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950">New budget line</h1>
          <p className="mt-1 text-sm text-gray-500">Create a new budget entry for an association</p>
        </div>
      </div>

      <Surface>
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && <Alert tone="danger">{error}</Alert>}

          <Field label="Association">
            <AssociationSelect name="association_id" required />
          </Field>

          <Field label="GL account">
            <GLAccountSelect name="gl_account_id" required />
          </Field>

          <Field label="Fiscal year">
            <Input type="number" name="fiscal_year" defaultValue={new Date().getFullYear()} required />
          </Field>

          <Field label="Category">
            <Select name="category" required defaultValue="expense">
              <option value="income">Income</option>
              <option value="expense">Expense</option>
            </Select>
          </Field>

          {/* Monthly Amounts */}
          <Field label="Monthly amounts">
            <div className="mb-3 flex items-center gap-2">
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="Equal monthly amount"
                value={equalAmount}
                onChange={(e) => setEqualAmount(e.target.value)}
                className="flex-1"
              />
              <Button type="button" variant="secondary" onClick={applyEqualDistribution}>
                Apply to all
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
              {MONTHS.map((month, i) => (
                <div key={month}>
                  <label className="mb-1 block text-xs text-gray-500">{month}</label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={monthlyAmounts[i] || ''}
                    onChange={(e) => {
                      const next = [...monthlyAmounts];
                      next[i] = parseFloat(e.target.value) || 0;
                      setMonthlyAmounts(next);
                    }}
                    placeholder="0"
                    className="px-2 text-center"
                  />
                </div>
              ))}
            </div>
            <div className="mt-2 text-xs tabular-nums text-gray-500">
              Annual total: ${monthlyAmounts.reduce((s, a) => s + a, 0).toFixed(2)}
            </div>
          </Field>

          <Field label="Notes (optional)">
            <Textarea name="notes" rows={2} className="resize-none" />
          </Field>

          {/* Submit */}
          <div className="flex items-center gap-2 pt-2">
            <Button type="submit" disabled={loading}>
              <Save className="h-4 w-4" />
              {loading ? 'Saving…' : 'Save budget line'}
            </Button>
            <Link href="/budget">
              <Button variant="secondary" type="button">Cancel</Button>
            </Link>
          </div>
        </form>
      </Surface>
    </PageShell>
  );
}

// Client-side select components that fetch data
function AssociationSelect({ name, required }: { name: string; required?: boolean }) {
  const [data, setData] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const supabase = createClient() as any;
    supabase.from('associations').select('id, name').order('name').then(({ data: d }: any) => {
      setData(d ?? []);
      setLoaded(true);
    });
  }, []);

  return (
    <Select name={name} required={required}>
      <option value="">{loaded ? 'Select association...' : 'Loading...'}</option>
      {data.map((a: any) => (
        <option key={a.id} value={a.id}>{a.name}</option>
      ))}
    </Select>
  );
}

function GLAccountSelect({ name, required }: { name: string; required?: boolean }) {
  const [data, setData] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const supabase = createClient() as any;
    supabase.from('gl_accounts').select('id, number, name, account_type').order('number').then(({ data: d }: any) => {
      setData(d ?? []);
      setLoaded(true);
    });
  }, []);

  return (
    <Select name={name} required={required}>
      <option value="">{loaded ? 'Select GL account...' : 'Loading...'}</option>
      {data.map((a: any) => (
        <option key={a.id} value={a.id}>
          {a.number} — {a.name} ({a.account_type})
        </option>
      ))}
    </Select>
  );
}
