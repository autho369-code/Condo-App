'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

const MEETING_TYPE_LABELS: Record<string, string> = {
  board_meeting: 'Board Meeting',
  annual_meeting: 'Annual Meeting',
  special_meeting: 'Special Meeting',
  committee_meeting: 'Committee Meeting',
  executive_session: 'Executive Session',
};

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Scheduled',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const STATUS_COLORS: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-emerald-100 text-emerald-800',
  completed: 'bg-slate-100 text-slate-800',
  cancelled: 'bg-red-100 text-red-800',
};

export default function MeetingsPage() {
  const supabase = createClient();
  const [meetings, setMeetings] = useState<any[]>([]);
  const [associations, setAssociations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    association_id: '',
    meeting_type: '',
    status: '',
    search: '',
    dateFrom: '',
    dateTo: '',
  });

  const fetchMeetings = useCallback(async () => {
    setLoading(true);
    const db = supabase as any;
    let query = db
      .from('meetings')
      .select('*, associations(name)')
      .order('scheduledAt', { ascending: false });

    if (filters.association_id) {
      query = query.eq('association_id', filters.association_id);
    }
    if (filters.meeting_type) {
      query = query.eq('meetingType', filters.meeting_type);
    }
    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.search) {
      query = query.ilike('title', `%${filters.search}%`);
    }
    if (filters.dateFrom) {
      query = query.gte('scheduledAt', filters.dateFrom);
    }
    if (filters.dateTo) {
      query = query.lte('scheduledAt', `${filters.dateTo}T23:59:59`);
    }

    const { data, error } = await query;
    if (!error) {
      setMeetings(data || []);
    }
    setLoading(false);
  }, [supabase, filters]);

  const fetchAssociations = useCallback(async () => {
    const db = supabase as any;
    const { data } = await db.from('associations').select('id, name').order('name');
    if (data) setAssociations(data);
  }, [supabase]);

  useEffect(() => {
    fetchMeetings();
    fetchAssociations();
  }, [fetchMeetings, fetchAssociations]);

  function formatDate(d: string | null) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit',
    });
  }

  return (
    <div className="min-h-screen bg-[#060B18] text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-light tracking-tight">Meetings</h1>
            <p className="text-sm text-slate-400 mt-1">
              Board meetings, annual meetings, and sign-in tracking
            </p>
          </div>
          <Link
            href="/meetings/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            New Meeting
          </Link>
        </div>

        {/* Filters */}
        <div className="bg-[#0B1121] border border-[#1E293B] rounded-xl p-4 mb-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <input
              type="text"
              placeholder="Search meetings..."
              value={filters.search}
              onChange={(e) => setFilters((f: any) => ({ ...f, search: e.target.value }))}
              className="bg-[#060B18] border border-[#1E293B] rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
            />
            <select
              value={filters.association_id}
              onChange={(e) => setFilters((f: any) => ({ ...f, association_id: e.target.value }))}
              className="bg-[#060B18] border border-[#1E293B] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50"
            >
              <option value="">All Associations</option>
              {associations.map((a: any) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            <select
              value={filters.meeting_type}
              onChange={(e) => setFilters((f: any) => ({ ...f, meeting_type: e.target.value }))}
              className="bg-[#060B18] border border-[#1E293B] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50"
            >
              <option value="">All Types</option>
              {Object.entries(MEETING_TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <select
              value={filters.status}
              onChange={(e) => setFilters((f: any) => ({ ...f, status: e.target.value }))}
              className="bg-[#060B18] border border-[#1E293B] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50"
            >
              <option value="">All Statuses</option>
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilters((f: any) => ({ ...f, dateFrom: e.target.value }))}
              className="bg-[#060B18] border border-[#1E293B] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50"
              placeholder="From"
            />
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilters((f: any) => ({ ...f, dateTo: e.target.value }))}
              className="bg-[#060B18] border border-[#1E293B] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50"
              placeholder="To"
            />
          </div>
        </div>

        {/* Table */}
        <div className="bg-[#0B1121] border border-[#1E293B] rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-slate-400">Loading meetings...</div>
          ) : meetings.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <p className="text-lg font-medium mb-1">No meetings found</p>
              <p className="text-sm">Meetings will appear here once created. Schedule a board meeting, annual meeting, or special session.</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#1E293B] text-left">
                  <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Meeting</th>
                  <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Association</th>
                  <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Type</th>
                  <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Date & Time</th>
                  <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Quorum</th>
                </tr>
              </thead>
              <tbody>
                {meetings.map((m: any) => (
                  <tr key={m.id} className="border-b border-[#1E293B]/50 hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/meetings/${m.id}`} className="text-sm font-medium text-white hover:text-emerald-400 transition-colors">
                        {m.title}
                      </Link>
                      {m.location && (
                        <div className="text-xs text-slate-500 mt-0.5">{m.location}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-300">
                      {m.associations?.name || '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-400">
                      {MEETING_TYPE_LABELS[m.meetingType] || m.meetingType}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-300">
                      {formatDate(m.scheduledAt)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[m.status] || 'bg-slate-100 text-slate-800'}`}>
                        {STATUS_LABELS[m.status] || m.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-slate-500">—</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
