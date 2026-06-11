'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { CalendarDays, Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { EmptyState, PageHeader, PageShell, Surface } from '@/components/ui/shell';
import { StatusChip, type Tone } from '@/components/operations/status-chip';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';

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

const STATUS_TONES: Record<string, Tone> = {
  scheduled: 'info',
  in_progress: 'success',
  completed: 'neutral',
  cancelled: 'danger',
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
    <PageShell>
      <PageHeader
        title="Meetings"
        description="Board meetings, annual meetings, and sign-in tracking"
        actions={
          <Link href="/meetings/new">
            <Button><Plus className="h-4 w-4" /> New meeting</Button>
          </Link>
        }
      />

      {/* Filters */}
      <Surface padded={false} className="mb-6 p-3 sm:p-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <Input
            type="text"
            placeholder="Search meetings…"
            aria-label="Search meetings"
            value={filters.search}
            onChange={(e) => setFilters((f: any) => ({ ...f, search: e.target.value }))}
          />
          <Select
            value={filters.association_id}
            aria-label="Association"
            onChange={(e) => setFilters((f: any) => ({ ...f, association_id: e.target.value }))}
          >
            <option value="">All Associations</option>
            {associations.map((a: any) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </Select>
          <Select
            value={filters.meeting_type}
            aria-label="Meeting type"
            onChange={(e) => setFilters((f: any) => ({ ...f, meeting_type: e.target.value }))}
          >
            <option value="">All Types</option>
            {Object.entries(MEETING_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </Select>
          <Select
            value={filters.status}
            aria-label="Status"
            onChange={(e) => setFilters((f: any) => ({ ...f, status: e.target.value }))}
          >
            <option value="">All Statuses</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </Select>
          <Input
            type="date"
            aria-label="From date"
            value={filters.dateFrom}
            onChange={(e) => setFilters((f: any) => ({ ...f, dateFrom: e.target.value }))}
          />
          <Input
            type="date"
            aria-label="To date"
            value={filters.dateTo}
            onChange={(e) => setFilters((f: any) => ({ ...f, dateTo: e.target.value }))}
          />
        </div>
      </Surface>

      {/* Table */}
      {loading ? (
        <div className="rounded-2xl border border-gray-200/70 bg-white py-16 text-center text-sm text-gray-400 shadow-sm">
          Loading meetings…
        </div>
      ) : meetings.length === 0 ? (
        <div className="rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <EmptyState
            icon={CalendarDays}
            title="No meetings found"
            description="Meetings will appear here once created. Schedule a board meeting, annual meeting, or special session."
            action={
              <Link href="/meetings/new">
                <Button><Plus className="h-4 w-4" /> New meeting</Button>
              </Link>
            }
          />
        </div>
      ) : (
        <Table>
          <THead>
            <tr>
              <TH>Meeting</TH>
              <TH>Association</TH>
              <TH>Type</TH>
              <TH>Date & Time</TH>
              <TH>Status</TH>
              <TH>Quorum</TH>
            </tr>
          </THead>
          <tbody>
            {meetings.map((m: any) => (
              <TR key={m.id}>
                <TD>
                  <Link href={`/meetings/${m.id}`} className="font-medium text-gray-900 hover:text-gray-950 hover:underline">
                    {m.title}
                  </Link>
                  {m.location && (
                    <div className="mt-0.5 text-xs text-gray-500">{m.location}</div>
                  )}
                </TD>
                <TD>{m.associations?.name || '—'}</TD>
                <TD className="text-gray-600">{MEETING_TYPE_LABELS[m.meetingType] || m.meetingType}</TD>
                <TD className="whitespace-nowrap">{formatDate(m.scheduledAt)}</TD>
                <TD>
                  <StatusChip tone={STATUS_TONES[m.status] ?? 'neutral'}>
                    {STATUS_LABELS[m.status] || m.status}
                  </StatusChip>
                </TD>
                <TD>
                  <span className="text-xs text-gray-400">—</span>
                </TD>
              </TR>
            ))}
          </tbody>
        </Table>
      )}
    </PageShell>
  );
}
