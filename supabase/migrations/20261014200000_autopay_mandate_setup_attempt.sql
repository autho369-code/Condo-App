-- Codex on #364: an AutoPay mandate records the setup attempt that created it,
-- so the Stripe webhook can undo it by that link whenever the attempt ended
-- without completing (canceled, expired or failed) -- including on a
-- redelivered event that no longer knows the mandate it created.
-- Additive: no mandates exist yet (0 rows on production).

alter table public.autopay_mandates
  add column if not exists setup_attempt_id uuid
    references public.stripe_setup_attempts(id) on delete set null;

create index if not exists autopay_mandates_setup_attempt_idx
  on public.autopay_mandates(setup_attempt_id)
  where setup_attempt_id is not null;

comment on column public.autopay_mandates.setup_attempt_id is
  'The Stripe setup attempt that enrolled this mandate (null for older rows).';

-- Only the Stripe webhook (service role) sets the link: authenticated users
-- hold table-wide grants, so a column guard refuses it for them.
create or replace function public.autopay_mandates_guard_setup_attempt()
returns trigger
language plpgsql
-- Invoker on purpose: it checks who is writing (current_user).
set search_path = pg_catalog, public
as $function$
begin
  if current_user in ('authenticated', 'anon')
     and new.setup_attempt_id is distinct from (case when tg_op = 'UPDATE' then old.setup_attempt_id end) then
    raise exception 'The AutoPay setup link is set by the payment system only' using errcode = '42501';
  end if;
  return new;
end
$function$;

revoke all on function public.autopay_mandates_guard_setup_attempt() from public, anon, authenticated;

create or replace trigger autopay_mandates_guard_setup_attempt
  before insert or update of setup_attempt_id on public.autopay_mandates
  for each row execute function public.autopay_mandates_guard_setup_attempt();
