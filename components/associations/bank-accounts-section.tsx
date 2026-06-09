'use client';

import { useState } from 'react';

export function BankAccountsSection() {
  const [count, setCount] = useState(1);

  return (
    <div>
      <p className="mb-3 text-xs text-gray-500">Add bank accounts for this association. These appear on income statements and financial reports.</p>
      <div className="space-y-4">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="rounded border border-gray-200 bg-gray-50 p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-gray-600">Account {i + 1}</p>
              {count > 1 && (
                <button type="button" onClick={() => setCount(count - 1)} className="text-xs text-red-500 hover:text-red-700">Remove</button>
              )}
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Account Name</label>
                <input type="text" name={`bank_name_${i}`} placeholder="Operating, Reserve, etc." className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Bank Name</label>
                <input type="text" name={`bank_bank_name_${i}`} placeholder="Chase, BofA..." className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Purpose</label>
                <select name={`bank_purpose_${i}`} className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none">
                  <option value="">— Select —</option>
                  <option value="operating">Operating</option>
                  <option value="reserve">Reserve</option>
                  <option value="special_assessment">Special Assessment</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Account Number</label>
                <input type="text" name={`bank_account_number_${i}`} className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Routing Number</label>
                <input type="text" name={`bank_routing_number_${i}`} className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none" />
              </div>
            </div>
          </div>
        ))}
      </div>
      <button type="button" onClick={() => setCount(count + 1)} className="mt-3 text-sm text-blue-600 hover:text-blue-800 font-medium">
        + Add account
      </button>
    </div>
  );
}
