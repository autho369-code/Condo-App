'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ArrowLeft, Save, Trash2 } from 'lucide-react';
import Link from 'next/link';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function EditBudgetLinePage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [line, setLine] = useState<any>(null);
  const [monthlyAmounts, setMonthlyAmounts] = useState<number[]>(Array(12).fill(0));
  const [equalAmount, setEqualAmount] = useState('');
  const [pageLoading, setPageLoading] = useState(true);

  // Load existing budget line
  useEffect(() => {
    async function load() {
      const supabase = createClient() as any;
      const { data } = await supabase
        .from('budget_lines')
        .select('*, gl_accounts!inner(number, name), associations!inner(name)')
        .eq('id', id)
        .single();

      if (data) {
        setLine(data);
        setMonthlyAmounts(data.monthly_amounts ?? Array(12).fill(0));
      }
      setPageLoading(false);
    }
    load();
  }, [id]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const form = new FormData(e.currentTarget);
    const supabase = createClient() as any;

    const { error: rpcError } = await supabase.rpc('upsert_budget_line', {
      p_id: id,
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

  async function handleDelete() {
    if (!confirm('Delete this budget line? This action cannot be undone.')) return;
    setDeleting(true);
    setError('');

    const supabase = createClient() as any;
    const { error: rpcError } = await supabase.rpc('delete_budget_line', { p_id: id });

    if (rpcError) {
      setError(rpcError.message);
      setDeleting(false);
      return;
    }

    router.push(`/budget?association=${line?.association_id ?? ''}&year=${line?.fiscal_year ?? ''}`);
    router.refresh();
  }

  function applyEqualDistribution() {
    const val = parseFloat(equalAmount);
    if (!isNaN(val) && val >= 0) {
      setMonthlyAmounts(Array(12).fill(val));
    }
  }

  if (pageLoading) {
    return (
      <div className="p-5">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 bg-[#1E293B] rounded" />
          <div className="h-96 bg-[#1E293B] rounded-xl" />
        </div>
      </div>
    );
  }

  if (!line) {
    return (
      <div className="p-5">
        <h1 className="text-2xl font-bold text-white">Budget Line Not Found</h1>
        <p className="mt-2 text-slate-400">The requested budget line does not exist.</p>
        <Link href="/budget" className="mt-4 inline-block text-emerald-400 hover:text-emerald-300">← Back to Budget</Link>
      </div>
    );
  }

  return (
    <div className="p-5 max-w-2xl space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/budget" className="p-1.5 rounded-lg hover:bg-[#1E293B] text-slate-400 hover:text-white">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Edit Budget Line</h1>
          <p className="mt-1 text-sm text-slate-400">
            {line.gl_accounts?.number} — {line.gl_accounts?.name} ({line.associations?.name}, FY{line.fiscal_year})
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-400">{error}</div>
        )}

        {/* Association */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Association</label>
          <AssociationSelect name="association_id" defaultValue={line.association_id} />
        </div>

        {/* GL Account */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">GL Account</label>
          <GLAccountSelect name="gl_account_id" defaultValue={line.gl_account_id} />
        </div>

        {/* Fiscal Year */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Fiscal Year</label>
          <input
            type="number"
            name="fiscal_year"
            defaultValue={line.fiscal_year}
            required
            className="w-full rounded-lg border border-[#1E293B] bg-[#0B1121] px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        {/* Category */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Category</label>
          <select
            name="category"
            required
            defaultValue={line.category}
            className="w-full rounded-lg border border-[#1E293B] bg-[#0B1121] px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="income">Income</option>
            <option value="expense">Expense</option>
          </select>
        </div>

        {/* Monthly Amounts */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Monthly Amounts</label>
          <div className="flex items-center gap-2 mb-3">
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="Equal monthly amount"
              value={equalAmount}
              onChange={(e) => setEqualAmount(e.target.value)}
              className="flex-1 rounded-lg border border-[#1E293B] bg-[#0B1121] px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <button
              type="button"
              onClick={applyEqualDistribution}
              className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
            >
              Apply to All
            </button>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {MONTHS.map((month, i) => (
              <div key={month}>
                <label className="block text-xs text-slate-500 mb-1">{month}</label>
                <input
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
                  className="w-full rounded-lg border border-[#1E293B] bg-[#0B1121] px-2 py-1.5 text-sm text-white text-center focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            ))}
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Annual total: ${monthlyAmounts.reduce((s, a) => s + a, 0).toFixed(2)}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Notes (optional)</label>
          <textarea
            name="notes"
            rows={2}
            defaultValue={line.notes ?? ''}
            className="w-full rounded-lg border border-[#1E293B] bg-[#0B1121] px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors"
          >
            <Save className="h-4 w-4" />
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
          <Link
            href="/budget"
            className="rounded-lg border border-[#1E293B] px-4 py-2.5 text-sm text-slate-300 hover:bg-[#1E293B] hover:text-white transition-colors"
          >
            Cancel
          </Link>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="ml-auto inline-flex items-center gap-2 rounded-lg border border-red-500/30 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 disabled:opacity-50 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
            {deleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </form>
    </div>
  );
}

function AssociationSelect({ name, defaultValue }: { name: string; defaultValue?: string }) {
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    const supabase = createClient() as any;
    supabase.from('associations').select('id, name').order('name').then(({ data: d }: any) => {
      setData(d ?? []);
    });
  }, []);

  return (
    <select
      name={name}
      required
      defaultValue={defaultValue}
      className="w-full rounded-lg border border-[#1E293B] bg-[#0B1121] px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
    >
      {data.map((a: any) => (
        <option key={a.id} value={a.id}>{a.name}</option>
      ))}
    </select>
  );
}

function GLAccountSelect({ name, defaultValue }: { name: string; defaultValue?: string }) {
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    const supabase = createClient() as any;
    supabase.from('gl_accounts').select('id, number, name, account_type').order('number').then(({ data: d }: any) => {
      setData(d ?? []);
    });
  }, []);

  return (
    <select
      name={name}
      required
      defaultValue={defaultValue}
      className="w-full rounded-lg border border-[#1E293B] bg-[#0B1121] px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
    >
      {data.map((a: any) => (
        <option key={a.id} value={a.id}>
          {a.number} — {a.name} ({a.account_type})
        </option>
      ))}
    </select>
  );
}
