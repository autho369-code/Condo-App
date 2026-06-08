'use client';

import { useState, useCallback, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import type { EventClickArg, EventDropArg, DatesSetArg } from '@fullcalendar/core';
import { updateCalendarEventDates } from '@/lib/rpcs/calendar';
import { EVENT_TYPES, eventTypeLabel, type CalendarEventType } from '@/lib/operations/calendar';

// Color map for event types — 13 distinct colors for the 13 event types
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

function eventColor(type: string) {
  const c = EVENT_TYPE_COLORS[type as CalendarEventType] ?? EVENT_TYPE_COLORS.custom_event;
  return c;
}

interface CalendarEvent {
  id: string;
  title: string;
  start_datetime: string;
  end_datetime: string | null;
  all_day: boolean;
  event_type: string;
  location: string | null;
  operations_status: string;
  association_name?: string;
}

interface CalendarGridProps {
  events: CalendarEvent[];
  associations: { id: string; name: string }[];
  initialAssocId: string;
  initialType: string;
}

export default function CalendarGrid({
  events,
  associations,
  initialAssocId,
  initialType,
}: CalendarGridProps) {
  const calendarRef = useRef<FullCalendar>(null);
  const [assocId, setAssocId] = useState(initialAssocId);
  const [typeFilter, setTypeFilter] = useState(initialType);
  const [viewMode, setViewMode] = useState<string>('dayGridMonth');

  const fcEvents = events.map((e) => ({
    id: e.id,
    title: e.title,
    start: e.start_datetime,
    end: e.end_datetime ?? undefined,
    allDay: e.all_day,
    // Store extra data for display
    extendedProps: {
      event_type: e.event_type,
      location: e.location,
      operations_status: e.operations_status,
      association_name: e.association_name,
    },
    ...eventColor(e.event_type),
    backgroundColor: eventColor(e.event_type).bg,
    borderColor: eventColor(e.event_type).border,
    textColor: eventColor(e.event_type).text,
  }));

  const handleEventDrop = useCallback(async (dropInfo: EventDropArg) => {
    const { event } = dropInfo;
    const start = event.startStr;
    const end = event.endStr;
    const allDay = event.allDay;

    const result = await updateCalendarEventDates(
      event.id,
      start,
      end || null,
      allDay,
    );

    if (result?.error) {
      dropInfo.revert();
      console.error('Failed to reschedule:', result.error);
    }
  }, []);

  const handleEventClick = useCallback((clickInfo: EventClickArg) => {
    // Open event detail or navigate — for now just log
    const props = clickInfo.event.extendedProps;
    const label = eventTypeLabel(props.event_type);
    alert(
      `${clickInfo.event.title}\nType: ${label}\nStatus: ${props.operations_status}\n${props.association_name ? `Association: ${props.association_name}` : ''}\n${props.location ? `Location: ${props.location}` : ''}`
    );
  }, []);

  const handleAssocChange = (value: string) => {
    setAssocId(value);
    const url = new URL(window.location.href);
    if (value) url.searchParams.set('assoc', value);
    else url.searchParams.delete('assoc');
    if (typeFilter) url.searchParams.set('type', typeFilter);
    window.location.href = url.toString();
  };

  const handleTypeChange = (value: string) => {
    setTypeFilter(value);
    const url = new URL(window.location.href);
    if (assocId) url.searchParams.set('assoc', assocId);
    if (value) url.searchParams.set('type', value);
    else url.searchParams.delete('type');
    window.location.href = url.toString();
  };

  const switchView = (mode: string) => {
    setViewMode(mode);
    const api = calendarRef.current?.getApi();
    if (api) api.changeView(mode);
  };

  const hasFilter = assocId || typeFilter;

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 border-b border-[#1E293B] bg-[#0B1121] px-6 py-3">
        {/* View switcher */}
        <div className="flex rounded-lg border border-[#1E293B] bg-[#060B18] p-0.5">
          {[
            { key: 'dayGridMonth', label: 'Month' },
            { key: 'timeGridWeek', label: 'Week' },
            { key: 'timeGridDay', label: 'Day' },
          ].map((v) => (
            <button
              key={v.key}
              onClick={() => switchView(v.key)}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                viewMode === v.key
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>

        <div className="h-6 w-px bg-[#1E293B]" />

        {/* Association filter */}
        <select
          value={assocId}
          onChange={(e) => handleAssocChange(e.target.value)}
          className="h-9 rounded border border-[#1E293B] bg-[#060B18] px-3 text-sm text-slate-300"
        >
          <option value="">All associations</option>
          {associations.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>

        {/* Event type filter */}
        <select
          value={typeFilter}
          onChange={(e) => handleTypeChange(e.target.value)}
          className="h-9 rounded border border-[#1E293B] bg-[#060B18] px-3 text-sm text-slate-300"
        >
          <option value="">All event types</option>
          {EVENT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>

        {hasFilter && (
          <a
            href="/calendar"
            className="text-sm text-slate-400 hover:text-slate-200"
          >
            Clear filters
          </a>
        )}

        <div className="ml-auto flex items-center gap-3">
          <a
            href={`/calendar/new${assocId ? `?assoc=${assocId}` : ''}`}
            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-400 transition-colors"
          >
            + Create event
          </a>
        </div>
      </div>

      {/* Legend — color-coded event types */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 border-b border-[#1E293B] bg-[#0B1121] px-6 py-2">
        {EVENT_TYPES.map((t) => {
          const c = EVENT_TYPE_COLORS[t.value as CalendarEventType] ?? EVENT_TYPE_COLORS.custom_event;
          return (
            <span key={t.value} className="inline-flex items-center gap-1.5 text-xs text-slate-400">
              <span
                className="inline-block h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: c.bg, border: `1px solid ${c.border}` }}
              />
              {t.label}
            </span>
          );
        })}
      </div>

      {/* Calendar */}
      <div className="flex-1 overflow-hidden bg-[#060B18] p-3">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView={viewMode}
          events={fcEvents}
          editable={true}
          eventStartEditable={true}
          eventDurationEditable={true}
          eventDrop={handleEventDrop}
          eventClick={handleEventClick}
          headerToolbar={false}
          height="100%"
          nowIndicator={true}
          dayMaxEvents={3}
          // Dark theme
          contentHeight="100%"
          eventTimeFormat={{
            hour: 'numeric',
            minute: '2-digit',
            meridiem: 'short',
          }}
        />
      </div>
    </div>
  );
}
