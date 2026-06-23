'use client';

// Client shell for the import page: tab switcher + association picker, wiring the
// selected association into the shared CsvUploader's server action. The two
// server actions are passed in from the server page (they are 'use server'
// exports) and bound to the chosen association id at call time.
import * as React from 'react';
import { CsvUploader, type ImportSummary } from '@/components/import/csv-uploader';

type Association = { id: string; name: string };

type Props = {
  associations: Association[];
  importOwners: (associationId: string, rows: Record<string, string>[]) => Promise<ImportSummary>;
  importOpeningBalances: (associationId: string, rows: Record<string, string>[]) => Promise<ImportSummary>;
};

const OWNER_COLUMNS = [
  'unit_number',
  'owner_first_name',
  'owner_last_name',
  'owner_email',
  'owner_phone',
  'ownership_pct',
  'monthly_dues',
  'move_in_date',
];

const BALANCE_COLUMNS = ['unit_number', 'opening_balance', 'as_of_date', 'memo'];

const selectCls =
  'h-10 w-full max-w-sm rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20';

export function ImportClient({ associations, importOwners, importOpeningBalances }: Props) {
  const [tab, setTab] = React.useState<'owners' | 'balances'>('owners');
  const [associationId, setAssociationId] = React.useState('');

  const hasAssociation = associationId !== '';

  return (
    <div className="max-w-5xl space-y-5">
      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-gray-200 bg-white p-1 text-sm font-medium">
        {([
          ['owners', 'Owners & Units'],
          ['balances', 'Opening Balances'],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={
              tab === key
                ? 'flex-1 rounded-lg bg-gray-950 px-3 py-2 text-white'
                : 'flex-1 rounded-lg px-3 py-2 text-gray-600 hover:bg-gray-50'
            }
          >
            {label}
          </button>
        ))}
      </div>

      {/* Association picker (required for both imports) */}
      <div className="rounded-2xl border border-gray-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <label htmlFor="association" className="mb-1.5 block text-sm font-medium text-gray-900">
          Target association <span className="text-red-500">*</span>
        </label>
        <select
          id="association"
          value={associationId}
          onChange={(e) => setAssociationId(e.target.value)}
          className={selectCls}
        >
          <option value="">Select association</option>
          {associations.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
        <p className="mt-1.5 text-xs text-gray-500">
          {tab === 'owners'
            ? 'Owners, units, and dues will be imported into this association. A default building is created if none exists.'
            : 'Opening balances post as charges against units in this association, so each unit’s receivables reflect the carried-over balance.'}
        </p>
      </div>

      {!hasAssociation && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Select a target association above to enable the upload.
        </div>
      )}

      {hasAssociation && tab === 'owners' && (
        <CsvUploader
          key={`owners-${associationId}`}
          expectedColumns={OWNER_COLUMNS}
          templateHref="/owners/import/template"
          noun="owners"
          validateRow={(row) => {
            if (!row.unit_number) return { ok: false, reason: 'unit_number required' };
            if (!row.owner_first_name) return { ok: false, reason: 'owner_first_name required' };
            if (!row.owner_last_name) return { ok: false, reason: 'owner_last_name required' };
            if (!row.owner_email) return { ok: false, reason: 'owner_email required' };
            return { ok: true };
          }}
          action={(rows) => importOwners(associationId, rows)}
        />
      )}

      {hasAssociation && tab === 'balances' && (
        <CsvUploader
          key={`balances-${associationId}`}
          expectedColumns={BALANCE_COLUMNS}
          templateHref="/owners/import/balances/template"
          noun="balances"
          validateRow={(row) => {
            if (!row.unit_number) return { ok: false, reason: 'unit_number required' };
            const n = Number((row.opening_balance ?? '').replace(/[$,]/g, ''));
            if (!row.opening_balance || !Number.isFinite(n)) return { ok: false, reason: 'opening_balance must be a number' };
            return { ok: true };
          }}
          action={(rows) => importOpeningBalances(associationId, rows)}
        />
      )}
    </div>
  );
}
