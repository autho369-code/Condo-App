
-- Close two production policy gaps found by read-only RLS inspection:
-- 1. audit_logs accepted inserts from PUBLIC and allowed every staff user to
--    read every company's audit rows; the table lacked portfolio_id even
--    though the company-admin UI filters on it.
-- 2. owner_payables UPDATE used WITH CHECK (true), allowing tenant keys to be
--    moved after the old row passed USING.

alter table public.audit_logs
  add column if not exists portfolio_id uuid references public.portfolios(id) on delete set null;

create index if not exists audit_logs_portfolio_created_idx
  on public.audit_logs (portfolio_id, created_at desc);

create or replace function public.assign_audit_log_portfolio()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
begin
  if new.portfolio_id is null and new.actor_id is not null then
    select p.portfolio_id into new.portfolio_id
    from public.profiles p
    where p.id = new.actor_id;
  end if;

  if new.portfolio_id is null and new.entity_type = 'company' then
    select p.id into new.portfolio_id
    from public.portfolios p
    where p.id = new.entity_id;
  end if;

  if new.portfolio_id is null and new.entity_type = 'user' then
    select p.portfolio_id into new.portfolio_id
    from public.profiles p
    where p.id = new.entity_id;
  end if;

  return new;
end;
$function$;

revoke all on function public.assign_audit_log_portfolio()
  from public, anon, authenticated;

drop trigger if exists trg_assign_audit_log_portfolio on public.audit_logs;
create trigger trg_assign_audit_log_portfolio
before insert or update of actor_id, entity_type, entity_id, portfolio_id
on public.audit_logs
for each row execute function public.assign_audit_log_portfolio();

update public.audit_logs al
set portfolio_id = p.portfolio_id
from public.profiles p
where al.portfolio_id is null
  and p.id = al.actor_id
  and p.portfolio_id is not null;

update public.audit_logs al
set portfolio_id = al.entity_id
where al.portfolio_id is null
  and al.entity_type = 'company'
  and exists (select 1 from public.portfolios p where p.id = al.entity_id);

update public.audit_logs al
set portfolio_id = p.portfolio_id
from public.profiles p
where al.portfolio_id is null
  and al.entity_type = 'user'
  and p.id = al.entity_id
  and p.portfolio_id is not null;

drop policy if exists "System insert audit logs" on public.audit_logs;
drop policy if exists "Staff read audit logs" on public.audit_logs;
drop policy if exists audit_logs_tenant_read on public.audit_logs;
drop policy if exists audit_logs_platform_read on public.audit_logs;

create policy audit_logs_tenant_read on public.audit_logs
for select to authenticated
using (
  auth.uid() is not null
  and public.is_any_staff()
  and portfolio_id = public.current_portfolio_id()
);

create policy audit_logs_platform_read on public.audit_logs
for select to authenticated
using (auth.uid() is not null and public.is_platform_operator_safe());

revoke all privileges on public.audit_logs from anon, authenticated;
grant select on public.audit_logs to authenticated;

create or replace function public.validate_owner_payable_tenant_scope()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
begin
  if tg_op = 'UPDATE' and new.portfolio_id <> old.portfolio_id then
    raise exception 'Owner payable portfolio cannot be changed';
  end if;

  if not exists (
    select 1 from public.associations a
    where a.id = new.association_id
      and a.portfolio_id = new.portfolio_id
      and a.archived_at is null
  ) then
    raise exception 'Owner payable association is outside the portfolio';
  end if;

  if not exists (
    select 1 from public.occupancies o
    where o.owner_id = new.owner_id
      and o.association_id = new.association_id
  ) then
    raise exception 'Owner payable owner is outside the association';
  end if;

  if new.gl_account_id is not null and not exists (
    select 1 from public.gl_accounts g
    where g.id = new.gl_account_id
      and (g.portfolio_id is null or g.portfolio_id = new.portfolio_id)
  ) then
    raise exception 'Owner payable GL account is outside the portfolio';
  end if;

  if new.bank_account_id is not null and not exists (
    select 1 from public.bank_accounts b
    where b.id = new.bank_account_id
      and b.portfolio_id = new.portfolio_id
      and (b.association_id is null or b.association_id = new.association_id)
  ) then
    raise exception 'Owner payable bank account is outside the association';
  end if;

  return new;
end;
$function$;

revoke all on function public.validate_owner_payable_tenant_scope()
  from public, anon, authenticated;

drop trigger if exists trg_validate_owner_payable_tenant_scope on public.owner_payables;
create trigger trg_validate_owner_payable_tenant_scope
before insert or update on public.owner_payables
for each row execute function public.validate_owner_payable_tenant_scope();

drop policy if exists owner_payables_insert on public.owner_payables;
create policy owner_payables_insert on public.owner_payables
for insert to authenticated
with check (
  auth.uid() is not null
  and (
    (public.is_any_staff() and public.can_access_portfolio(portfolio_id))
    or public.is_platform_operator_safe()
  )
);

drop policy if exists owner_payables_update on public.owner_payables;
create policy owner_payables_update on public.owner_payables
for update to authenticated
using (
  auth.uid() is not null
  and (
    (public.is_any_staff() and public.can_access_portfolio(portfolio_id))
    or public.is_platform_operator_safe()
  )
)
with check (
  auth.uid() is not null
  and (
    (public.is_any_staff() and public.can_access_portfolio(portfolio_id))
    or public.is_platform_operator_safe()
  )
);
