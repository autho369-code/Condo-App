-- Two reservations for the same amenity and time could both be approved.
-- An approved reservation may not overlap another approved one for the same
-- amenity (serialized per amenity with an advisory lock).
create or replace function public.guard_amenity_overlap()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
begin
  if new.status <> 'approved' or new.start_time is null or new.end_time is null then
    return new;
  end if;
  if new.end_time <= new.start_time then
    raise exception 'A reservation must end after it starts' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('amenity-booking:' || new.amenity_id::text, 0));
  if exists (
    select 1 from public.amenity_reservations r
     where r.amenity_id = new.amenity_id
       and r.id <> new.id
       and r.status = 'approved'
       and r.start_time < new.end_time
       and r.end_time > new.start_time
  ) then
    raise exception 'That time overlaps another approved reservation for this amenity' using errcode = '23P01';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_amenity_overlap() from public, anon, authenticated;

create trigger amenity_reservations_no_overlap
  before insert or update of status, start_time, end_time, amenity_id on public.amenity_reservations
  for each row execute function public.guard_amenity_overlap();
