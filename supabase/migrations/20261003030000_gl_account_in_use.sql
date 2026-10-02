-- Whether a GL account is referenced anywhere (journal lines, bank accounts,
-- loans, charge categories, recurring bills, ...). The GL account edit page
-- only lets the account's type or association change when it is unused, so
-- linked configurations keep a valid account. Every foreign key that points
-- at gl_accounts(id) is checked, so new references are covered automatically.
create or replace function public.gl_account_in_use(p_gl_account_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  r record;
  v_found boolean;
  v_portfolio uuid;
begin
  select portfolio_id into v_portfolio from public.gl_accounts where id = p_gl_account_id;
  if v_portfolio is null or not public.can_manage_finance(v_portfolio) then
    raise exception 'GL account not found';
  end if;
  for r in
    select c.conrelid::regclass as tbl, a.attname as col
      from pg_constraint c
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
     where c.contype = 'f'
       and c.confrelid = 'public.gl_accounts'::regclass
       and array_length(c.conkey, 1) = 1
       and c.conrelid <> 'public.gl_accounts'::regclass
  loop
    execute format('select exists (select 1 from %s where %I = $1)', r.tbl, r.col)
      into v_found using p_gl_account_id;
    if v_found then
      return true;
    end if;
  end loop;
  -- Sub-accounts of this account also depend on it.
  return exists (select 1 from public.gl_accounts where sub_account_of_id = p_gl_account_id);
end $$;

revoke all on function public.gl_account_in_use(uuid) from public, anon;
grant execute on function public.gl_account_in_use(uuid) to authenticated;
