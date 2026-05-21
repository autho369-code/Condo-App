// Pure sync helpers for calendar activity types. Kept out of the server-actions
// file because a 'use server' module can only export async functions.

export function defaultMaintenanceInstructions(eventType: string): string {
  switch (eventType) {
    case 'elevator_reservation':
      return 'Please place pads in the elevator before the start time and remove after. Set to independent service if requested.';
    case 'move_in':
      return 'Move-in scheduled. Please place elevator pads, switch elevator to independent service, escort mover to the unit, verify certificate of insurance is on file, and collect move-in deposit if applicable.';
    case 'move_out':
      return 'Move-out scheduled. Please place elevator pads, switch elevator to independent service, verify hold-harmless is signed, do a common-area walk-through for damage, and return all building keys.';
    case 'water_shutoff':
      return 'Water shutoff. Please post notices on affected floors at least 48 hours in advance, confirm shutoff keys are located, and verify water is restored within the scheduled window.';
    case 'vendor_work':
      return 'Vendor will be on-site. Please verify certificate of insurance is on file, unlock common-area access as needed, escort to the work area, and confirm sign-out at end of day.';
    case 'common_area_reservation':
      return 'Common-area reservation. Please unlock the space at start time, inspect for damage before and after, and retrieve keys after the event.';
    case 'board_meeting':
      return 'Board meeting. Please unlock the meeting room, set up A/V equipment, place sign-in sheet, and lock up after the meeting.';
    case 'inspection':
      return 'Inspection scheduled. Please meet the inspector at the listed location, provide keys and access codes as needed, and capture any findings in the service-request system.';
    default:
      return '';
  }
}
