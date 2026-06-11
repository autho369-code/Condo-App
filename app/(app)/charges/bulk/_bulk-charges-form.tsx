'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/input';
import { Alert, SectionTitle, Surface } from '@/components/ui/shell';
import { createBulkCharges } from '@/lib/rpcs/bulk-operations';
import { money } from '@/lib/utils';

interface Association { id: string; name: string; }
interface Category { id: string; name: string; code: string; charge_type: string; is_assessment: boolean; default_amount: number; }
interface UnitInfo {
  unit_id: string;
  unit_number: string;
  association_name: string;
  owner_name: string | null;
  current_dues: number;
  occupancy_id: string | null;
}

export function BulkChargesForm({
  associations,
  categories,
  portfolioId,
}: {
  associations: Association[];
  categories: Category[];
  portfolioId: string | undefined;
}) {
  const [selectedAssoc, setSelectedAssoc] = useState<string>('');
  const [units, setUnits] = useState<UnitInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedUnits, setSelectedUnits] = useState<Set<string>>(new Set());
  const [categoryId, setCategoryId] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [dueDate, setDueDate] = useState<string>('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const assessmentCategories = categories.filter((c) => c.is_assessment);

  // Load units when association changes
  async function loadUnits(assocId: string) {
    setSelectedAssoc(assocId);
    setSelectedUnits(new Set());
    if (!assocId) { setUnits([]); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/bulk/units?association_id=${assocId}`);
      const data = await res.json();
      setUnits(data.units ?? []);
    } catch (e) {
      setUnits([]);
    }
    setLoading(false);
  }

  function toggleUnit(id: string) {
    setSelectedUnits((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function selectAll() { setSelectedUnits(new Set(units.map((u) => u.unit_id))); }
  function clearAll() { setSelectedUnits(new Set()); }

  const previewTotal = useMemo(() => {
    const a = parseFloat(amount) || 0;
    return selectedUnits.size * a;
  }, [amount, selectedUnits.size]);

  async function handleSubmit() {
    if (selectedUnits.size === 0) { setError('Select at least one unit'); return; }
    setSending(true);
    setError(null);
    const fd = new FormData();
    fd.set('description', description || 'Assessment charge');
    fd.set('due_date', dueDate);
    if (categoryId) fd.set('charge_category_id', categoryId);
    for (const uid of selectedUnits) {
      fd.append('unit_ids', uid);
      fd.append('amounts', amount || '0');
    }
    try {
      const r = await createBulkCharges(fd);
      if (r.error) setError(r.error);
      else setResult(r);
    } catch (e: any) {
      setError(e.message || 'Failed');
    }
    setSending(false);
  }

  if (result) {
    return (
      <Surface className="max-w-4xl text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <h3 className="text-[15px] font-semibold text-gray-950">Charges created</h3>
        <p className="mt-1 text-sm text-gray-500">
          {result.count} charge{result.count !== 1 ? 's' : ''} created for {selectedUnits.size} unit{selectedUnits.size !== 1 ? 's' : ''}.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Button onClick={() => { setResult(null); setSelectedUnits(new Set()); setAmount(''); setDescription(''); }}>
            Create another batch
          </Button>
          <Link href="/charges"><Button variant="secondary">Back to receivables</Button></Link>
        </div>
      </Surface>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      {/* Step 1: Select Association */}
      <Surface>
        <SectionTitle title="1. Select association" />
        <Select
          value={selectedAssoc}
          onChange={(e) => loadUnits(e.target.value)}
          className="max-w-md"
        >
          <option value="">Choose an association…</option>
          {associations.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </Select>
      </Surface>

      {/* Step 2: Select Units */}
      {selectedAssoc && (
        <Surface>
          <SectionTitle
            title="2. Select units"
            actions={
              units.length > 0 && (
                <div className="flex gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={selectAll}>Select all</Button>
                  <Button type="button" variant="ghost" size="sm" onClick={clearAll}>Clear</Button>
                </div>
              )
            }
          />
          {loading ? (
            <p className="text-sm text-gray-500">Loading units…</p>
          ) : units.length === 0 ? (
            <p className="text-sm text-gray-500">No units found in this association.</p>
          ) : (
            <div className="max-h-64 overflow-y-auto rounded-lg border border-gray-100">
              {units.map((u) => (
                <label key={u.unit_id}
                  className={`flex cursor-pointer items-center gap-3 border-b border-gray-100 px-3 py-2.5 text-sm last:border-0 hover:bg-gray-50 ${selectedUnits.has(u.unit_id) ? 'bg-blue-50/50' : ''}`}>
                  <input type="checkbox" checked={selectedUnits.has(u.unit_id)} onChange={() => toggleUnit(u.unit_id)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600" />
                  <span className="w-16 font-medium text-gray-900">{u.unit_number}</span>
                  <span className="text-gray-500">{u.owner_name ?? 'Vacant'}</span>
                  <span className="ml-auto text-xs text-gray-400">Dues: {money(u.current_dues)}</span>
                </label>
              ))}
            </div>
          )}
          <p className="mt-2 text-xs text-gray-500">{selectedUnits.size} of {units.length} units selected</p>
        </Surface>
      )}

      {/* Step 3: Charge Details */}
      {selectedAssoc && units.length > 0 && (
        <Surface className="space-y-4">
          <SectionTitle title="3. Charge details" className="mb-0" />

          <Field label="Charge category">
            <Select
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value);
                const cat = categories.find((c) => c.id === e.target.value);
                if (cat?.default_amount) setAmount(String(cat.default_amount));
              }}
              className="max-w-md"
            >
              <option value="">Select category…</option>
              {assessmentCategories.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
              ))}
            </Select>
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Amount per unit ($)">
              <Input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
            </Field>
            <Field label="Due date">
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </Field>
          </div>

          <Field label="Description">
            <Input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Assessment increase, special assessment, etc." />
          </Field>

          {/* Preview */}
          <Alert tone="info" title="Preview:">
            {selectedUnits.size} units × {money(parseFloat(amount) || 0)} = <span className="tabular-nums">{money(previewTotal)}</span>
          </Alert>

          {error && <Alert tone="danger">{error}</Alert>}

          <Button onClick={handleSubmit} disabled={sending || selectedUnits.size === 0}>
            {sending ? 'Creating…' : `Create ${selectedUnits.size} charge${selectedUnits.size !== 1 ? 's' : ''}`}
          </Button>
        </Surface>
      )}
    </div>
  );
}
