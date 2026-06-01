export type CalendarEventType =
  | 'board_meeting'
  | 'annual_meeting_election'
  | 'vendor_service'
  | 'elevator_reservation'
  | 'move_in_move_out'
  | 'water_shutoff'
  | 'pest_control'
  | 'landscaping'
  | 'inspection'
  | 'insurance_expiration'
  | 'contract_renewal'
  | 'assessment_deadline'
  | 'custom_event';

export type ReminderAction =
  | 'notify_management_office'
  | 'notify_board'
  | 'notify_vendor'
  | 'notify_affected_residents'
  | 'create_posting_notice'
  | 'create_email_draft'
  | 'create_follow_up_task';

export const EVENT_TYPES: Array<{ value: CalendarEventType; label: string; category: string }> = [
  { value: 'board_meeting', label: 'Board Meeting', category: 'Governance' },
  { value: 'annual_meeting_election', label: 'Annual Meeting / Election', category: 'Governance' },
  { value: 'vendor_service', label: 'Vendor Service', category: 'Operations' },
  { value: 'elevator_reservation', label: 'Elevator Reservation', category: 'Resident Services' },
  { value: 'move_in_move_out', label: 'Move-In / Move-Out', category: 'Resident Services' },
  { value: 'water_shutoff', label: 'Water Shutoff', category: 'Critical Notice' },
  { value: 'pest_control', label: 'Pest Control', category: 'Operations' },
  { value: 'landscaping', label: 'Landscaping', category: 'Operations' },
  { value: 'inspection', label: 'Inspection', category: 'Compliance' },
  { value: 'insurance_expiration', label: 'Insurance Expiration', category: 'Risk' },
  { value: 'contract_renewal', label: 'Contract Renewal', category: 'Risk' },
  { value: 'assessment_deadline', label: 'Assessment Deadline', category: 'Accounting' },
  { value: 'custom_event', label: 'Custom Event', category: 'Custom' },
];

export const REMINDER_ACTIONS: Array<{ value: ReminderAction; label: string }> = [
  { value: 'notify_management_office', label: 'Notify management office' },
  { value: 'notify_board', label: 'Notify board' },
  { value: 'notify_vendor', label: 'Notify vendor' },
  { value: 'notify_affected_residents', label: 'Notify affected owners/residents' },
  { value: 'create_posting_notice', label: 'Create posting notice' },
  { value: 'create_email_draft', label: 'Create email draft' },
  { value: 'create_follow_up_task', label: 'Create follow-up task' },
];

export const DEFAULT_REMINDERS: Record<CalendarEventType, number[]> = {
  board_meeting: [7 * 1440, 48 * 60, 8 * 60],
  annual_meeting_election: [30 * 1440, 14 * 1440, 7 * 1440],
  vendor_service: [48 * 60, 8 * 60],
  elevator_reservation: [0, 24 * 60],
  move_in_move_out: [0, 48 * 60],
  water_shutoff: [7 * 1440, 48 * 60, 8 * 60],
  pest_control: [7 * 1440, 48 * 60],
  landscaping: [48 * 60, 8 * 60],
  inspection: [14 * 1440, 7 * 1440, 48 * 60],
  insurance_expiration: [60 * 1440, 30 * 1440, 7 * 1440],
  contract_renewal: [90 * 1440, 60 * 1440, 30 * 1440],
  assessment_deadline: [30 * 1440, 14 * 1440, 7 * 1440],
  custom_event: [],
};

export function eventTypeLabel(value: string | null | undefined) {
  return EVENT_TYPES.find((type) => type.value === value)?.label ?? 'Custom Event';
}

export function reminderLabel(minutes: number) {
  if (minutes === 0) return 'Immediately';
  if (minutes < 1440) return `${Math.round(minutes / 60)} hours before`;
  return `${Math.round(minutes / 1440)} days before`;
}

export function defaultPublicNotice(eventType: string, title: string, starts: string, location?: string | null) {
  const when = starts ? new Date(starts).toLocaleString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }) : 'the scheduled time';

  const where = location ? ` Location: ${location}.` : '';

  switch (eventType) {
    case 'water_shutoff':
      return `Please be advised that a water shutoff is scheduled for ${when}. ${title}.${where} Please plan accordingly and contact the management office with any urgent concerns.`;
    case 'elevator_reservation':
      return `An elevator reservation is scheduled for ${when}. ${title}.${where} Please allow extra time when using the elevator during this window.`;
    case 'move_in_move_out':
      return `A move-in / move-out is scheduled for ${when}. ${title}.${where} Elevator access and common areas may be busier than usual.`;
    case 'board_meeting':
      return `The board meeting is scheduled for ${when}.${where} Please refer to the posted agenda or contact management with questions.`;
    case 'vendor_service':
      return `Vendor service is scheduled for ${when}. ${title}.${where} Access to some areas may be limited during the service window.`;
    default:
      return `${title} is scheduled for ${when}.${where}`;
  }
}

export function defaultVendorConfirmation(eventType: string, title: string, starts: string, location?: string | null) {
  const when = starts ? new Date(starts).toLocaleString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }) : 'the scheduled time';

  return `Please confirm you are scheduled for ${title} on ${when}${location ? ` at ${location}` : ''}. Reply with arrival window, onsite contact, and any access requirements.`;
}
