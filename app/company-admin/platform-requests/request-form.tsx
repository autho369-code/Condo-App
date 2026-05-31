'use client';

import { useState } from 'react';
import { submitPlatformRequest } from './actions';
import { Button } from '@/components/ui/button';
import { Send, Loader2 } from 'lucide-react';

const REQUEST_TYPES = [
  { value: 'more_doors', label: 'Request More Doors' },
  { value: 'plan_upgrade', label: 'Plan Upgrade' },
  { value: 'plan_downgrade', label: 'Plan Downgrade' },
  { value: 'billing_review', label: 'Billing Review' },
  { value: 'technical_support', label: 'Technical Support' },
  { value: 'new_feature', label: 'New Feature Request' },
  { value: 'data_import', label: 'Data Import' },
  { value: 'new_association', label: 'New Association Setup' },
  { value: 'white_glove_setup', label: 'White Glove Setup' },
  { value: 'urgent_issue', label: 'Urgent Issue' },
];

const PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

export default function RequestForm() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const formData = new FormData(e.currentTarget);

    try {
      await submitPlatformRequest(formData);
    } catch (err: any) {
      setError(err?.message ?? 'An unexpected error occurred.');
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Request Type */}
      <div>
        <label htmlFor="request_type" className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">
          Request Type
        </label>
        <select
          id="request_type"
          name="request_type"
          required
          defaultValue=""
          className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20"
        >
          <option value="" disabled>Select request type...</option>
          {REQUEST_TYPES.map((rt) => (
            <option key={rt.value} value={rt.value}>{rt.label}</option>
          ))}
        </select>
      </div>

      {/* Priority */}
      <div>
        <label htmlFor="priority" className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">
          Priority
        </label>
        <select
          id="priority"
          name="priority"
          required
          defaultValue=""
          className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20"
        >
          <option value="" disabled>Select priority...</option>
          {PRIORITIES.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
      </div>

      {/* Title */}
      <div>
        <label htmlFor="title" className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">
          Title
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          placeholder="Brief summary of your request"
          className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-300 placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20"
        />
      </div>

      {/* Description */}
      <div>
        <label htmlFor="description" className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          required
          rows={5}
          placeholder="Provide details about your request"
          className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-300 placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 resize-vertical"
        />
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      <Button
        type="submit"
        disabled={submitting}
        className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Submitting...
          </>
        ) : (
          <>
            <Send className="h-4 w-4" />
            Submit Request
          </>
        )}
      </Button>
    </form>
  );
}
