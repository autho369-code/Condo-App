-- Codex on #354 (reviewing 20261014080000).
--
-- 1. A hearing request before any notice was accepted (open_violation does
--    not set notice_sent_at), and that request then blocked every later
--    fine. A request now needs the first notice; the owner page explains
--    when it becomes possible.
-- 2. Changing only a charge's charge_type did not repost its journal entry,
--    although the type now decides both the income account (fines, late
--    fees, NSF fees) and the ledger date (charge_ledger_date). A change of
--    charge_type now reverses and reposts like the other fields.

create or replace function public.post_charge_to_gl()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare g record; v_memo text;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    if tg_op = 'UPDATE' and new.amount is not distinct from old.amount and new.gl_account_id is not distinct from old.gl_account_id
       and new.unit_id is not distinct from old.unit_id and new.due_date is not distinct from old.due_date
       and new.charge_category_id is not distinct from old.charge_category_id
       and new.charge_type is not distinct from old.charge_type then
      return new;
    end if;
    perform public.reverse_subledger_source('charge', old.id, public.charge_ledger_date(old),
      format('Reversal: %s', coalesce(old.description, 'charge')));
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    select * into g from public.charge_gl_accounts(new);
    if g.portfolio_id is null then return new; end if;
    v_memo := coalesce(new.description, new.charge_type::text);
    perform public.post_subledger_entry(g.portfolio_id, g.association_id, public.charge_ledger_date(new),
      'charge', new.id, v_memo, g.ar, g.income, new.amount);
    return new;
  end if;
  return old;
end $function$;

do $$
declare
  v_def text := pg_get_functiondef('public.request_owner_violation_hearing(uuid, text)'::regprocedure);
  v_old text := $o$  -- The window runs from the first notice, as advance_violation's fine gate does.
  if v_violation.notice_sent_at is not null then$o$;
  v_new text := $n$  -- A hearing can be requested once the first notice is sent, and only
  -- within the window that runs from it (advance_violation's fine gate uses
  -- the same clock).
  if v_violation.notice_sent_at is null then
    raise exception 'A hearing can be requested once the association sends its first notice about this violation.';
  end if;
  if v_violation.notice_sent_at is not null then$n$;
begin
  if position('once the association sends its first notice' in v_def) > 0 then
    return;
  end if;
  if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then
    raise exception 'request_owner_violation_hearing: window block not found exactly once';
  end if;
  execute replace(v_def, v_old, v_new);
end
$$;
