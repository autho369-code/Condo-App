-- Vendor credits review fixes 2:
-- 1. 1099 totals count cash actually paid: bill amount minus vendor credits applied.
-- 2. Deleting a vendor can no longer silently erase posted credits.

do $$
declare
  v_def text := pg_get_functiondef('public.assemble_vendor_1099_data(uuid, integer)'::regprocedure);
begin
  if (length(v_def) - length(replace(v_def, 'sum(pb.amount)', ''))) / length('sum(pb.amount)') <> 2 then
    raise exception 'vendor_credits_review_fixes_2: assemble_vendor_1099_data drifted';
  end if;
  execute replace(v_def, 'sum(pb.amount)', 'sum(pb.amount - pb.credit_applied)');
end $$;

alter table public.vendor_credits drop constraint if exists vendor_credits_vendor_id_fkey;
alter table public.vendor_credits
  add constraint vendor_credits_vendor_id_fkey foreign key (vendor_id) references public.vendors(id) on delete restrict;
