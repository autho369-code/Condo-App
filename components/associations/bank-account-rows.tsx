'use client';
import { useState } from 'react';

type GLAccount = { id: string; number: number; name: string };

export default function BankAccountRows({ glAccounts }: { glAccounts: GLAccount[] }) {
  const [rows, setRows] = useState<number[]>([0]);
  return (
    <div className="space-y-3">
      {rows.map((i) => (
        <div key={i} className="grid grid-cols-12 items-end gap-3">
          <div className="col-span-5">
            <label className="mb-1 block text-xs font-medium text-gray-700">
              Cash GL Account <span className="text-red-500">*</span>
            </label>
            <select
              name={`bank_gl_account_id_${i}`}
              required={i === 0}
              className="h-10 w-full rounded border border-gray-300 bg-white px-3 text-sm"
            >
              <option value="">Select…</option>
              {glAccounts.map((gl) => (
                <option key={gl.id} value={gl.id}>{gl.number}: {gl.name}</option>
              ))}
            </select>
          </div>
          <div className="col-span-6">
            <label className="mb-1 block text-xs font-medium text-gray-700">
              Bank Account <span className="text-red-500">*</span>
            </label>
            <input
              name={`bank_account_name_${i}`}
              required={i === 0}
              placeholder="Start typing to search"
              className="h-10 w-full rounded border border-gray-300 bg-white px-3 text-sm placeholder:text-gray-400"
            />
            <p className="mt-0.5 text-xs text-gray-500 text-center">(Operating and Escrow Account)</p>
          </div>
          <div className="col-span-1">
            {rows.length > 1 && (
              <button
                type="button"
                onClick={() => setRows((xs) => xs.filter((x) => x !== i))}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-gray-500 hover:bg-gray-300"
                aria-label="Remove"
              >
                ×
              </button>
            )}
          </div>
        </div>
      ))}

      <div className="pt-2 text-center">
        <button
          type="button"
          onClick={() => setRows((xs) => [...xs, (xs[xs.length - 1] ?? 0) + 1])}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-green-700 hover:underline"
        >
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-green-100 text-green-700">+</span>
          Add another bank account
        </button>
      </div>
    </div>
  );
}
