'use client';

import { useState, useMemo } from 'react';
import { CreditCard, Plus, Search, ArrowUpDown, Receipt, DollarSign, AlertTriangle } from 'lucide-react';
import { money, date } from '@/lib/utils';

interface OwnerReceipt {
  id: string;
  receiptNumber?: string;
  amount: number;
  paymentMethod: string;
  checkNumber?: string;
  memo?: string;
  receivedDate: string;
  unit?: { unitNumber: string } | null;
  association?: { name: string } | null;
}

interface OwnerCharge {
  id: string;
  type: string;
  description: string;
  amount: number;
  dueDate?: string | null;
  status: string;
  paidAmount: number;
  unit?: { unitNumber: string } | null;
  association?: { name: string } | null;
  glAccount?: { name: string; number: number } | null;
  createdAt: string;
}

interface Association {
  id: string;
  name: string;
}

const TABS = [
  { key: 'receipts', label: 'Receipts' },
  { key: 'charges', label: 'Charges' },
  { key: 'bank-deposits', label: 'Bank Deposits' },
  { key: 'owner-delinquencies', label: 'Owner Delinquencies' },
  { key: 'chargeback-insights', label: 'Chargeback Insights' },
];

const statusColors: Record<string, string> = {
  paid: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25',
  unpaid: 'bg-red-500/15 text-red-400 border border-red-500/25',
  partial: 'bg-amber-500/15 text-amber-400 border border-amber-500/25',
  credited: 'bg-blue-500/15 text-blue-400 border border-blue-500/25',
  waived: 'bg-slate-500/15 text-slate-400 border border-slate-500/25',
};

export function ReceivablesClient({
  initialReceipts,
  initialCharges,
  associations,
}: {
  initialReceipts: OwnerReceipt[];
  initialCharges: OwnerCharge[];
  associations: Association[];
}) {
  const [tab, setTab] = useState('receipts');
  const [receipts] = useState<OwnerReceipt[]>(initialReceipts);
  const [charges] = useState<OwnerCharge[]>(initialCharges);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<string>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const toggleSort = (field: string) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  // Summary stats
  const totalReceipts = receipts.reduce((s, r) => s + r.amount, 0);
  const totalCharges = charges.reduce((s, c) => s + c.amount, 0);
  const unpaidCharges = charges.filter(c => c.status === 'unpaid');
  const totalUnpaid = unpaidCharges.reduce((s, c) => s + (c.amount - c.paidAmount), 0);

  const filteredReceipts = useMemo(() => {
    let items = receipts.filter(r =>
      `${r.unit?.unitNumber || ''} ${r.association?.name || ''} ${r.receiptNumber || ''} ${r.memo || ''}`
        .toLowerCase().includes(search.toLowerCase())
    );
    items.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'date') cmp = new Date(a.receivedDate).getTime() - new Date(b.receivedDate).getTime();
      else if (sortField === 'amount') cmp = a.amount - b.amount;
      else if (sortField === 'payer') cmp = (a.unit?.unitNumber || '').localeCompare(b.unit?.unitNumber || '');
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return items;
  }, [receipts, search, sortField, sortDir]);

  const filteredCharges = useMemo(() => {
    let items = charges.filter(c =>
      `${c.unit?.unitNumber || ''} ${c.association?.name || ''} ${c.description} ${c.type}`
        .toLowerCase().includes(search.toLowerCase())
    );
    items.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'date') cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      else if (sortField === 'amount') cmp = a.amount - b.amount;
      else if (sortField === 'payer') cmp = (a.unit?.unitNumber || '').localeCompare(b.unit?.unitNumber || '');
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return items;
  }, [charges, search, sortField, sortDir]);

  return (
    <div className="mx-auto h-full max-w-7xl overflow-y-auto px-8 py-8 bg-[#060B18]">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15">
                <CreditCard className="h-5 w-5 text-emerald-400" />
              </div>
              Receivables
            </h1>
            <p className="text-sm text-slate-400 mt-2 leading-relaxed">Receipts, charges, and owner account management.</p>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="rounded-xl border border-slate-800 bg-[#0B1121] p-5 hover:border-emerald-500/30 transition-all group relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="relative">
              <div className="flex items-center gap-2 text-slate-500 text-[10px] font-semibold uppercase tracking-wider mb-2">
                <Receipt className="h-3.5 w-3.5" /> Total Receipts
              </div>
              <span className="text-3xl font-bold text-white tabular-nums">{money(totalReceipts)}</span>
            </div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-[#0B1121] p-5 hover:border-emerald-500/30 transition-all group relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="relative">
              <div className="flex items-center gap-2 text-slate-500 text-[10px] font-semibold uppercase tracking-wider mb-2">
                <DollarSign className="h-3.5 w-3.5" /> Total Charges
              </div>
              <span className="text-3xl font-bold text-white tabular-nums">{money(totalCharges)}</span>
            </div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-[#0B1121] p-5 hover:border-red-500/30 transition-all group relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-red-500/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="relative">
              <div className="flex items-center gap-2 text-red-400 text-[10px] font-semibold uppercase tracking-wider mb-2">
                <AlertTriangle className="h-3.5 w-3.5" /> Unpaid Balance
              </div>
              <span className="text-3xl font-bold text-red-400 tabular-nums">{money(totalUnpaid)}</span>
            </div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-[#0B1121] p-5 hover:border-emerald-500/30 transition-all group relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="relative">
              <div className="flex items-center gap-2 text-slate-500 text-[10px] font-semibold uppercase tracking-wider mb-2">
                <CreditCard className="h-3.5 w-3.5" /> Delinquent Owners
              </div>
              <span className="text-3xl font-bold text-white tabular-nums">{unpaidCharges.length}</span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-slate-800">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setSearch(''); }}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-slate-500 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Click here to search"
            className="w-full h-10 pl-10 pr-4 bg-[#0B1121] border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-colors"
          />
        </div>

        {/* Table */}
        <div className="rounded-xl border border-slate-800 bg-[#0B1121] overflow-hidden">
          {tab === 'receipts' ? (
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800 text-left">
                  <th className="px-5 py-3.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 cursor-pointer" onClick={() => toggleSort('date')}>
                    <span className="flex items-center gap-1">Date <ArrowUpDown className="h-3 w-3" /></span>
                  </th>
                  <th className="px-5 py-3.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 cursor-pointer" onClick={() => toggleSort('payer')}>
                    <span className="flex items-center gap-1">Payer <ArrowUpDown className="h-3 w-3" /></span>
                  </th>
                  <th className="px-5 py-3.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">GL Account</th>
                  <th className="px-5 py-3.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Property – Unit</th>
                  <th className="px-5 py-3.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 text-right cursor-pointer" onClick={() => toggleSort('amount')}>
                    <span className="flex items-center gap-1 justify-end">Amount <ArrowUpDown className="h-3 w-3" /></span>
                  </th>
                  <th className="px-5 py-3.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Reference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {filteredReceipts.length === 0 ? (
                  <tr><td colSpan={6} className="px-5 py-12 text-center text-slate-500">No receipts found.</td></tr>
                ) : filteredReceipts.map(r => (
                  <tr key={r.id} className="hover:bg-slate-800/20 transition-colors">
                    <td className="px-5 py-3.5 text-sm text-slate-300">{date(r.receivedDate)}</td>
                    <td className="px-5 py-3.5 text-sm text-white">
                      {r.unit?.unitNumber || 'N/A'}
                      <span className="text-slate-500 text-xs ml-1">({r.paymentMethod === 'ach' ? 'Paid online' : r.paymentMethod || 'N/A'})</span>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-slate-400">2300: Prepaid Assessments</td>
                    <td className="px-5 py-3.5 text-sm text-slate-400">
                      {r.association?.name || '—'}
                      {r.unit?.unitNumber ? ` – ${r.unit.unitNumber}` : ''}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-emerald-400 text-right font-medium tabular-nums">{money(r.amount)}</td>
                    <td className="px-5 py-3.5 text-sm text-slate-500 font-mono text-xs">{r.receiptNumber || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : tab === 'charges' ? (
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800 text-left">
                  <th className="px-5 py-3.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 cursor-pointer" onClick={() => toggleSort('date')}>
                    <span className="flex items-center gap-1">Date <ArrowUpDown className="h-3 w-3" /></span>
                  </th>
                  <th className="px-5 py-3.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 cursor-pointer" onClick={() => toggleSort('payer')}>
                    <span className="flex items-center gap-1">Owner <ArrowUpDown className="h-3 w-3" /></span>
                  </th>
                  <th className="px-5 py-3.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Type</th>
                  <th className="px-5 py-3.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Description</th>
                  <th className="px-5 py-3.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Association</th>
                  <th className="px-5 py-3.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 text-right cursor-pointer" onClick={() => toggleSort('amount')}>
                    <span className="flex items-center gap-1 justify-end">Amount <ArrowUpDown className="h-3 w-3" /></span>
                  </th>
                  <th className="px-5 py-3.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {filteredCharges.length === 0 ? (
                  <tr><td colSpan={7} className="px-5 py-12 text-center text-slate-500">No charges found.</td></tr>
                ) : filteredCharges.map(c => (
                  <tr key={c.id} className="hover:bg-slate-800/20 transition-colors">
                    <td className="px-5 py-3.5 text-sm text-slate-300">{date(c.createdAt)}</td>
                    <td className="px-5 py-3.5 text-sm text-white">{c.unit?.unitNumber || 'N/A'}</td>
                    <td className="px-5 py-3.5 text-sm text-slate-400 capitalize">{c.type.replace(/_/g, ' ')}</td>
                    <td className="px-5 py-3.5 text-sm text-slate-400 max-w-[200px] truncate">{c.description}</td>
                    <td className="px-5 py-3.5 text-sm text-slate-400">{c.association?.name || '—'}</td>
                    <td className="px-5 py-3.5 text-sm text-right font-medium text-white tabular-nums">{money(c.amount)}</td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${statusColors[c.status] || statusColors.unpaid}`}>
                        {c.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : tab === 'bank-deposits' ? (
            <div className="px-6 py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/15 mx-auto mb-3">
                <DollarSign className="h-5 w-5 text-emerald-400" />
              </div>
              <h3 className="text-base font-bold text-white mb-2">Bank Deposits</h3>
              <p className="text-slate-400 text-sm max-w-md mx-auto leading-relaxed">Track and manage bank deposits for all associations. Create deposit slips and reconcile with bank statements.</p>
            </div>
          ) : tab === 'owner-delinquencies' ? (
            <div className="px-6 py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/15 mx-auto mb-3">
                <AlertTriangle className="h-5 w-5 text-amber-400" />
              </div>
              <h3 className="text-base font-bold text-white mb-2">Owner Delinquencies</h3>
              <p className="text-slate-400 text-sm max-w-md mx-auto leading-relaxed">View owners with overdue balances, track delinquency history, and manage collection workflows.</p>
            </div>
          ) : tab === 'chargeback-insights' ? (
            <div className="px-6 py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-500/15 mx-auto mb-3">
                <CreditCard className="h-5 w-5 text-red-400" />
              </div>
              <h3 className="text-base font-bold text-white mb-2">Chargeback Insights</h3>
              <p className="text-slate-400 text-sm max-w-md mx-auto leading-relaxed">Monitor payment chargebacks, dispute statuses, and identify patterns to reduce future chargebacks.</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
