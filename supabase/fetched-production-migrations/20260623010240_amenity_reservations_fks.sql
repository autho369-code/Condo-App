-- FKs so PostgREST can embed association/unit names, and for integrity.
alter table public.amenity_reservations
  add constraint amenity_reservations_association_id_fkey
  foreign key (association_id) references public.associations(id) on delete cascade;

alter table public.amenity_reservations
  add constraint amenity_reservations_unit_id_fkey
  foreign key (unit_id) references public.units(id) on delete set null;;
