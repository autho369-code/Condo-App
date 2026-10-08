'use client';

import { useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import type { EventClickArg, EventDropArg, EventInput } from '@fullcalendar/core';
import type { EventResizeDoneArg } from '@fullcalendar/interaction';
import { listCalendarEvents, updateCalendarEventDates } from '@/lib/rpcs/calendar';
import { EVENT_TYPES, type CalendarEventType } from '@/lib/operations/calendar';
import { Alert } from '@/components/ui/shell';

const EVENT_TYPE_COLORS: Record<CalendarEventType, { bg: string; text: string; border: string }> = {
  board_meeting: { bg: '#1E40AF', text: '#DBEAFE', border: '#3B82F6' },
  annual_meeting_election: { bg: '#92400E', text: '#FEF3C7', border: '#F59E0B' },
  vendor_service: { bg: '#3730A3', text: '#E0E7FF', border: '#6366F1' },
  elevator_reservation: { bg: '#5B21B6', text: '#EDE9FE', border: '#8B5CF6' },
  move_in_move_out: { bg: '#115E59', text: '#CCFBF1', border: '#14B8A6' },
  water_shutoff: { bg: '#991B1B', text: '#FEE2E2', border: '#EF4444' },
  pest_control: { bg: '#9A3412', text: '#FFEDD5', border: '#F97316' },
  landscaping: { bg: '#065F46', text: '#D1FAE5', border: '#10B981' },
  inspection: { bg: '#155E75', text: '#CFFAFE', border: '#06B6D4' },
  insurance_expiration: { bg: '#9F1239', text: '#FFE4E6', border: '#F43F5E' },
  contract_renewal: { bg: '#9D174D', text: '#FCE7F3', border: '#EC4899' },
  assessment_deadline: { bg: '#3F6212', text: '#ECFCCB', border: '#84CC16' },
  custom_event: { bg: '#374151', text: '#E5E7EB', border: '#6B7280' },
};

function eventColor(type: string) { return EVENT_TYPE_COLORS[type as CalendarEventType] ?? EVENT_TYPE_COLORS.custom_event; }

interface CalendarEvent {
  id: string; title: string; start_datetime: string; end_datetime: string | null;
  all_day: boolean; event_type: string; location: string | null;
  operations_status: string; association_name?: string | null;
}

const toFcEvent = (e: CalendarEvent): EventInput => ({
  id: e.id, title: e.association_name ? `${e.title} · ${e.association_name}` : e.title,
  start: e.start_datetime, end: e.end_datetime ?? undefined, allDay: e.all_day,
  extendedProps: { title: e.title, event_type: e.event_type, location: e.location, operations_status: e.operations_status, association_name: e.association_name },
  backgroundColor: eventColor(e.event_type).bg, borderColor: eventColor(e.event_type).border, textColor: eventColor(e.event_type).text,
});

export default function CalendarGrid({ associations, initialAssocId, initialType }: {
  associations: { id: string; name: string }[]; initialAssocId: string; initialType: string;
}) {
  const router = useRouter();
  const calendarRef = useRef<FullCalendar>(null);
  const [assocId, setAssocId] = useState(initialAssocId);
  const [typeFilter, setTypeFilter] = useState(initialType);
  const [viewMode, setViewMode] = useState<string>('dayGridMonth');
  const [problem, setProblem] = useState<string | null>(null);
  // A move that worked but left something to fix (not a failure).
  const [notice, setNotice] = useState<string | null>(null);

  // Load whatever range is on screen, so any month (past or future) shows
  // its events instead of a fixed window around today.
  const loadEvents = useCallback(
    (info: { startStr: string; endStr: string }, success: (events: EventInput[]) => void, failure: (error: Error) => void) => {
      listCalendarEvents(info.startStr, info.endStr, initialAssocId, initialType)
        .then((result) => {
          if (result.error) { setProblem(`Could not load events: ${result.error}`); failure(new Error(result.error)); return; }
          setProblem(result.truncated ? 'Too many events in this range to show them all. Filter by association or event type.' : null);
          success(result.events.map(toFcEvent));
        })
        .catch((err: unknown) => {
          const message = err instanceof Error ? err.message : 'unknown error';
          setProblem(`Could not load events: ${message}`);
          failure(err instanceof Error ? err : new Error(message));
        });
    },
    [initialAssocId, initialType],
  );

  const handleMove = useCallback(async (info: EventDropArg | EventResizeDoneArg) => {
    const name = String(info.event.extendedProps.title ?? info.event.title);
    try {
      const result = await updateCalendarEventDates(info.event.id, info.event.startStr, info.event.endStr || null, info.event.allDay);
      if (result && 'error' in result && result.error) { info.revert(); setNotice(null); setProblem(`Could not move "${name}": ${result.error}`); return; }
      setProblem(null);
      setNotice(result && 'warning' in result && result.warning ? `"${name}": ${result.warning}` : null);
    } catch (err) {
      info.revert();
      setNotice(null);
      setProblem(`Could not move "${name}": ${err instanceof Error ? err.message : 'unknown error'}`);
    }
  }, []);

  const handleEventClick = useCallback((clickInfo: EventClickArg) => {
    clickInfo.jsEvent.preventDefault();
    router.push(`/calendar/${clickInfo.event.id}`);
  }, [router]);

  const navigate = (a: string, t: string) => {
    const url = new URL(window.location.href);
    if (a) url.searchParams.set('assoc', a); else url.searchParams.delete('assoc');
    if (t) url.searchParams.set('type', t); else url.searchParams.delete('type');
    window.location.href = url.toString();
  };

  const switchView = (mode: string) => { setViewMode(mode); calendarRef.current?.getApi()?.changeView(mode); };
  const hasFilter = assocId || typeFilter;

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 bg-white px-5 py-2.5">
        <div className="flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
          {[{ key: 'dayGridMonth', label: 'Month' }, { key: 'timeGridWeek', label: 'Week' }, { key: 'timeGridDay', label: 'Day' }, { key: 'listMonth', label: 'Agenda' }].map((v) => (
            <button key={v.key} type="button" onClick={() => switchView(v.key)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === v.key ? 'bg-white text-gray-900 shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700'}`}>
              {v.label}
            </button>
          ))}
        </div>
        <div className="h-6 w-px bg-gray-200" />
        <select value={assocId} onChange={(e) => { setAssocId(e.target.value); navigate(e.target.value, typeFilter); }}
          className="h-9 rounded border border-gray-200 bg-white px-3 text-xs text-gray-700">
          <option value="">All associations</option>
          {associations.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); navigate(assocId, e.target.value); }}
          className="h-9 rounded border border-gray-200 bg-white px-3 text-xs text-gray-700">
          <option value="">All event types</option>
          {EVENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        {hasFilter && <Link href="/calendar" className="text-xs text-gray-500 hover:text-gray-700">Clear filters</Link>}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 border-b border-gray-100 bg-white px-5 py-2">
        {EVENT_TYPES.map((t) => {
          const c = EVENT_TYPE_COLORS[t.value as CalendarEventType] ?? EVENT_TYPE_COLORS.custom_event;
          return <span key={t.value} className="inline-flex items-center gap-1.5 text-[11px] text-gray-500">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: c.bg, border: `1px solid ${c.border}` }} />{t.label}
          </span>;
        })}
      </div>

      {problem && <Alert tone="danger" className="rounded-none border-x-0 border-t-0">{problem}</Alert>}
      {notice && <Alert tone="warning" className="rounded-none border-x-0 border-t-0">{notice}</Alert>}

      {/* Calendar */}
      <div className="h-[calc(100vh-330px)] min-h-[560px] overflow-hidden bg-white p-3">
        <FullCalendar ref={calendarRef} plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]} initialView={viewMode}
          events={loadEvents} editable={true} eventStartEditable={true} eventDurationEditable={true}
          eventDrop={handleMove} eventResize={handleMove} eventClick={handleEventClick}
          noEventsContent="No events in this period"
          headerToolbar={{ left: 'prev,next today', center: 'title', right: '' }}
          height="100%"
          nowIndicator={true} dayMaxEvents={3} contentHeight="100%"
          eventTimeFormat={{ hour: 'numeric', minute: '2-digit', meridiem: 'short' }} />
      </div>
  
    </div>
  );
}
