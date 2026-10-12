'use client';

import { useId, useState } from 'react';
import { Input, Select } from '@/components/ui/input';

export function BankAccountsSection() {
  const [count, setCount] = useState(1);
  const uid = useId();

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
                <label htmlFor={`${uid}-bank-name-${i}`} className="block text-xs text-gray-500 mb-1">Account Name</label>
                <Input id={`${uid}-bank-name-${i}`} type="text" name={`bank_name_${i}`} placeholder="Operating, Reserve, etc." />
              </div>
              <div>
                <label htmlFor={`${uid}-bank-bank-name-${i}`} className="block text-xs text-gray-500 mb-1">Bank Name</label>
                <Input id={`${uid}-bank-bank-name-${i}`} type="text" name={`bank_bank_name_${i}`} placeholder="Chase, BofA..." />
              </div>
              <div>
                <label htmlFor={`${uid}-bank-purpose-${i}`} className="block text-xs text-gray-500 mb-1">Purpose</label>
                <Select id={`${uid}-bank-purpose-${i}`} name={`bank_purpose_${i}`}>
                  <option value="">— Select —</option>
                  <option value="operating">Operating</option>
                  <option value="reserve">Reserve</option>
                  <option value="special_assessment">Special Assessment</option>
                  <option value="other">Other</option>
                </Select>
              </div>
              <div>
                <label htmlFor={`${uid}-bank-account-number-${i}`} className="block text-xs text-gray-500 mb-1">Account Number</label>
                <Input id={`${uid}-bank-account-number-${i}`} type="text" name={`bank_account_number_${i}`} />
              </div>
              <div>
                <label htmlFor={`${uid}-bank-routing-number-${i}`} className="block text-xs text-gray-500 mb-1">Routing Number</label>
                <Input id={`${uid}-bank-routing-number-${i}`} type="text" name={`bank_routing_number_${i}`} />
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
