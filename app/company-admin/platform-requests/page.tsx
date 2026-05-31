import { createClient } from '@/lib/supabase/server';
import { requireCompanyAdmin } from '@/lib/auth/me';
import { date } from '@/lib/utils';
import RequestForm from './request-form';
import {
  MessageSquare,
  Clock,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ChevronDown,
} from 'lucide-react';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-slate-400/10 text-slate-400 border-slate-500/20',
  medium: 'bg-blue-400/10 text-blue-400 border-blue-500/20',
  high: 'bg-amber-400/10 text-amber-400 border-amber-500/20',
  urgent: 'bg-red-400/10 text-red-400 border-red-500/20',
};

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-amber-400/10 text-amber-400 border-amber-500/20',
  in_progress: 'bg-blue-400/10 text-blue-400 border-blue-500/20',
  resolved: 'bg-emerald-400/10 text-emerald-400 border-emerald-500/20',
  closed: 'bg-slate-400/10 text-slate-400 border-slate-500/20',
  cancelled: 'bg-slate-400/10 text-slate-400 border-slate-500/20',
};

const TYPE_LABELS: Record<string, string> = {
  more_doors: 'More Doors',
  plan_upgrade: 'Plan Upgrade',
  plan_downgrade: 'Plan Downgrade',
  billing_review: 'Billing Review',
  technical_support: 'Technical Support',
  new_feature: 'New Feature',
  data_import: 'Data Import',
  new_association: 'New Association',
  white_glove_setup: 'White Glove Setup',
  urgent_issue: 'Urgent Issue',
};

function labelFor(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function badge(label: string, colorMap: Record<string, string>, fallback: string) {
  const colors = colorMap[label] ?? fallback;
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${colors}`}>
      {TYPE_LABELS[label] ?? labelFor(label)}
    </span>
  );
}

function truncate(str: string | null, max: number): string {
  if (!str) return '—';
  return str.length > max ? str.slice(0, max) + '...' : str;
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                       */
/* -------------------------------------------------------------------------- */

export default async function PlatformRequestsPage() {
  const me = await requireCompanyAdmin();
  const supabase = await createClient();
  const db = supabase as any;
  const portfolioId = me.portfolio?.id;

  if (!portfolioId) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <MessageSquare className="h-12 w-12 text-slate-600 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-white">No company assigned</h2>
          <p className="text-sm text-slate-400 mt-1">Contact the platform operator to set up your company.</p>
        </div>
      </div>
    );
  }

  // Fetch existing requests
  const { data: requests } = await db
    .from('platform_requests')
    .select('*')
    .eq('portfolio_id', portfolioId)
    .order('created_at', { ascending: false });

  const requestList = (requests ?? []) as any[];

  // Stats
  const openCount = requestList.filter((r) => r.status === 'open' || r.status === 'in_progress').length;
  const resolvedCount = requestList.filter((r) => r.status === 'resolved').length;
  const totalCount = requestList.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400">Company Admin</p>
          <h1 className="mt-1 text-xl font-bold text-white">Platform Requests</h1>
          <p className="mt-1 text-sm text-slate-400">
            Communicate directly with the platform operator
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-400" />
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Open</p>
          </div>
          <p className="mt-1 text-xl font-bold text-white tabular-nums">{openCount}</p>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Resolved</p>
          </div>
          <p className="mt-1 text-xl font-bold text-white tabular-nums">{resolvedCount}</p>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-slate-400" />
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total</p>
          </div>
          <p className="mt-1 text-xl font-bold text-white tabular-nums">{totalCount}</p>
        </div>
      </div>

      {/* New Request Form */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
        <div className="border-b border-white/[0.04] px-5 py-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            New Request
          </h2>
        </div>
        <div className="px-5 py-4">
          <RequestForm />
        </div>
      </div>

      {/* Request History */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
        <div className="border-b border-white/[0.04] px-5 py-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Request History
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-white/[0.02]">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Type</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Priority</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Title</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Response</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Created</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {requestList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-500">
                    No platform requests yet. Submit your first request above.
                  </td>
                </tr>
              ) : (
                requestList.map((r) => (
                  <tr key={r.id} className="hover:bg-white/[0.02] transition">
                    <td className="px-4 py-3">
                      {badge(r.request_type, {}, 'bg-slate-400/10 text-slate-400 border-slate-500/20')}
                    </td>
                    <td className="px-4 py-3">
                      {badge(r.priority, PRIORITY_COLORS, 'bg-slate-400/10 text-slate-400 border-slate-500/20')}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-300 max-w-[200px] truncate" title={r.title}>
                      {r.title}
                    </td>
                    <td className="px-4 py-3">
                      {badge(r.status, STATUS_COLORS, 'bg-slate-400/10 text-slate-400 border-slate-500/20')}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-400 max-w-[250px] truncate" title={r.platform_response}>
                      {truncate(r.platform_response, 80)}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-400 tabular-nums whitespace-nowrap">
                      {date(r.created_at)}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-400 tabular-nums whitespace-nowrap">
                      {date(r.updated_at)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
