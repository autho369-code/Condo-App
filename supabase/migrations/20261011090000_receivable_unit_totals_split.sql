-- Speed: receivable_unit_totals runs its three totals as separate queries.
--
-- The Receivables page (/charges) showed "Some receivables could not be
-- loaded" with statement timeouts. receivable_unit_totals added up
-- aged_receivables, v_unapplied_credits and delinquent_units (twice) in one
-- SQL statement; each view brings its tables' row-level security, so the
-- single plan grew to 900+ sub-plans and took 13-25 s (manager, company
-- admin, board) with 17 units and 15 charges, while each total on its own
-- takes well under a second. Its load also pushed the page's other queries
-- past the statement timeout.
--
-- Now PL/pgSQL with one query per total, and separate queries with and
-- without the unit filter (the "p_unit_ids is null or ..." form could not use
-- the filter). Same signature, same views, still security invoker: every
-- caller sees exactly what their policies allow. Checked in a rolled-back
-- transaction: identical results for manager, company admin, board, owner,
-- vendor and an unknown user, with and without unit filters; 45-600 ms
-- (was 13-25 s).

create or replace function public.receivable_unit_totals(p_unit_ids uuid[] default null)
returns table(outstanding_total numeric, delinquent_count integer, delinquent_balance numeric)
language plpgsql
stable
set search_path to 'public'
as $function$
declare
  v_open numeric;
  v_credit numeric;
  v_count integer;
  v_balance numeric;
begin
  -- Open charges less credit on file (unapplied payments and credits).
  if p_unit_ids is null then
    select coalesce(sum(ar.balance_due), 0) into v_open from public.aged_receivables ar;
    select coalesce(sum(uc.unapplied_amount), 0) into v_credit from public.v_unapplied_credits uc;
    select count(*)::integer, coalesce(sum(du.balance), 0) into v_count, v_balance from public.delinquent_units du;
  else
    select coalesce(sum(ar.balance_due), 0) into v_open from public.aged_receivables ar where ar.unit_id = any (p_unit_ids);
    select coalesce(sum(uc.unapplied_amount), 0) into v_credit from public.v_unapplied_credits uc where uc.unit_id = any (p_unit_ids);
    select count(*)::integer, coalesce(sum(du.balance), 0) into v_count, v_balance from public.delinquent_units du where du.unit_id = any (p_unit_ids);
  end if;

  return query select (v_open - v_credit)::numeric, v_count, v_balance::numeric;
end
$function$;
