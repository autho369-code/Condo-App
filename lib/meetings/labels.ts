// Labels for the meeting_type enum (board_meeting, annual_meeting,
// special_meeting, committee_meeting, executive_session).
export const MEETING_TYPE_LABELS: Record<string, string> = {
  board_meeting: 'Board Meeting',
  annual_meeting: 'Annual Meeting',
  special_meeting: 'Special Meeting',
  committee_meeting: 'Committee Meeting',
  executive_session: 'Executive Session',
}

export function meetingTypeLabel(type: string | null | undefined): string {
  if (!type) return '—'
  return MEETING_TYPE_LABELS[type] ?? type.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
}

type ListedMeeting = { start_time: string | null; status: string | null }

/**
 * Splits the board's meeting list. Upcoming: not cancelled, start time still
 * ahead. Cancelled: every cancelled meeting, past or future. Past: everything
 * else (started, or with no start time).
 */
export function splitBoardMeetings<T extends ListedMeeting>(all: T[], now: Date = new Date()) {
  const ahead = (m: T) => !!m.start_time && new Date(m.start_time) >= now
  const upcoming = all.filter((m) => m.status !== 'cancelled' && ahead(m))
  const cancelled = all.filter((m) => m.status === 'cancelled')
  const past = all.filter((m) => m.status !== 'cancelled' && !ahead(m))
  return { upcoming, past, cancelled }
}
