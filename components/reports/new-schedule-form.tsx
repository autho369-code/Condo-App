'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { createSchedule } from '@/lib/rpcs/reports';

type Props = {
  definitions: { id: string; name: string; slug: string }[];
};

export function NewScheduleForm({ definitions }: Props) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded border border-brand-200 bg-brand-50 px-4 py-2.5 text-sm font-medium text-brand-700 hover:bg-brand-100 transition-colors"
      >
        + New Scheduled Report
      </button>
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    const form = e.currentTarget;
    const fd = new FormData(form);
    const result = await createSchedule(fd);
    if (result?.error) {
      setError(result.error);
      setSubmitting(false);
    }
    // On success the server action redirects
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-950">New Scheduled Report</h3>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-gray-400 hover:text-gray-600"
        >
          Cancel
        </button>
      </div>

      {error && (
        <p className="rounded bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
      )}

      {/* Report definition */}
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600">Report</label>
        <select
          name="definition_id"
          required
          className="h-9 w-full rounded border border-gray-300 bg-white px-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        >
          <option value="">Select a report</option>
          {definitions.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>

      {/* Name */}
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600">Schedule name</label>
        <input
          name="name"
          required
          placeholder="e.g. Monthly Balance Sheet"
          className="h-9 w-full rounded border border-gray-300 bg-white px-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>

      {/* Frequency */}
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600">Frequency</label>
        <select
          name="frequency"
          required
          className="h-9 w-full rounded border border-gray-300 bg-white px-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        >
          <option value="">Select frequency</option>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="biweekly">Biweekly</option>
          <option value="monthly">Monthly</option>
          <option value="quarterly">Quarterly</option>
          <option value="annually">Annually</option>
        </select>
      </div>

      {/* Recipients */}
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600">
          Recipients <span className="font-normal text-gray-400">(comma-separated emails)</span>
        </label>
        <input
          name="recipients"
          placeholder="e.g. manager@condo.com, board@condo.com"
          className="h-9 w-full rounded border border-gray-300 bg-white px-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>

      {/* Output format */}
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600">Output format</label>
        <select
          name="output_format"
          defaultValue="pdf"
          className="h-9 w-full rounded border border-gray-300 bg-white px-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        >
          <option value="pdf">PDF</option>
          <option value="xlsx">Excel</option>
          <option value="csv">CSV</option>
          <option value="html">HTML</option>
          <option value="json">JSON</option>
        </select>
      </div>

      {/* Delivery channel */}
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600">Delivery</label>
        <select
          name="delivery_channel"
          defaultValue="email"
          className="h-9 w-full rounded border border-gray-300 bg-white px-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        >
          <option value="email">Email</option>
          <option value="portal">Portal</option>
          <option value="webhook">Webhook</option>
          <option value="download_only">Download only</option>
        </select>
      </div>

      <Button type="submit" disabled={submitting} className="w-full">
        {submitting ? 'Saving...' : 'Save schedule'}
      </Button>
    </form>
  );
}
