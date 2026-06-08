'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// Inline sync button — triggers Plaid transaction sync
export function RefreshButton({ plaidItemId }: { plaidItemId: string }) {
  const [syncing, setSyncing] = useState(false);
  const router = useRouter();

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/plaid/transactions/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plaid_item_id: plaidItemId }),
      });

      const data = await res.json();

      if (res.ok) {
        router.refresh();
      } else {
        alert(data.error || 'Sync failed');
      }
    } catch (err) {
      alert('Sync failed. Check connection and try again.');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <button
      onClick={handleSync}
      disabled={syncing}
      className="ml-auto flex items-center gap-1 rounded border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
    >
      <svg
        className={`h-3 w-3 ${syncing ? 'animate-spin' : ''}`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
        />
      </svg>
      {syncing ? 'Syncing…' : 'Sync'}
    </button>
  );
}
