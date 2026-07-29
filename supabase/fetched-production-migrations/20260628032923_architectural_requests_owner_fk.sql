do $$ begin
  alter table public.architectural_requests
    add constraint architectural_requests_owner_id_fkey
    foreign key (owner_id) references public.owners(id) on delete set null;
exception when duplicate_object then null; end $$;;
