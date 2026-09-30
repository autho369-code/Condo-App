-- Vendor trades used by condo associations that the enum was missing
-- (found in the AppFolio vendor audit). Additive only.
alter type public.vendor_trade add value if not exists 'alarm_security';
alter type public.vendor_trade add value if not exists 'appliances';
alter type public.vendor_trade add value if not exists 'capital_improvements';
alter type public.vendor_trade add value if not exists 'carpet_flooring';
alter type public.vendor_trade add value if not exists 'cleaning_janitorial';
alter type public.vendor_trade add value if not exists 'decks_balconies';
alter type public.vendor_trade add value if not exists 'doors_windows';
alter type public.vendor_trade add value if not exists 'drywall';
alter type public.vendor_trade add value if not exists 'elevator';
alter type public.vendor_trade add value if not exists 'fences_gates';
alter type public.vendor_trade add value if not exists 'fire_water_damage';
alter type public.vendor_trade add value if not exists 'fire_life_safety';
alter type public.vendor_trade add value if not exists 'redevelopment';
alter type public.vendor_trade add value if not exists 'smoke_co_detectors';
