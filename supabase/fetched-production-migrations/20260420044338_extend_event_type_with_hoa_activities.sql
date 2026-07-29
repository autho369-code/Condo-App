-- HOA-specific calendar event types. 'other' already exists for custom activities.
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'elevator_reservation';
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'move_in';
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'move_out';
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'water_shutoff';
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'vendor_work';
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'common_area_reservation';
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'board_meeting';
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'inspection';;
