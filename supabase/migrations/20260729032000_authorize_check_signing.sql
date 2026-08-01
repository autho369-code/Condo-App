-- Require an explicit issuer acknowledgement and preserve the authorized-signer
-- label that was configured when each check run was recorded.
alter table public.payable_checks
  add column if not exists authorized_signer_label text,
  add column if not exists authorization_acknowledged_at timestamptz;

alter function public.record_check_run(uuid, uuid[], integer, date)
  rename to record_check_run_legacy;

revoke all on function public.record_check_run_legacy(uuid, uuid[], integer, date)
  from public, anon, authenticated, service_role;

create or replace function public.record_check_run(
  p_bank_account_id uuid,
  p_bill_ids uuid[],
  p_starting_check_number integer,
  p_payment_date date,
  p_authorization_confirmed boolean
) returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  bank_portfolio_id uuid;
  signer_label text;
  result jsonb;
begin
  if not coalesce(p_authorization_confirmed, false) then
    raise exception 'Check signing authorization must be acknowledged';
  end if;

  select portfolio_id, nullif(trim(check_signature), '') into bank_portfolio_id, signer_label
    from public.bank_accounts
   where id = p_bank_account_id
     and archived_at is null;
  if bank_portfolio_id is null or not public.can_manage_finance(bank_portfolio_id) then
    raise exception 'Permission denied';
  end if;
  if signer_label is null then
    raise exception 'Configure an authorized signer on the bank account before issuing checks';
  end if;

  -- The legacy implementation retains the complete tenant, state, sequence,
  -- and accounting checks. It is no longer executable by client roles.
  result := public.record_check_run_legacy(
    p_bank_account_id,
    p_bill_ids,
    p_starting_check_number,
    p_payment_date
  );

  update public.payable_checks
     set authorized_signer_label = signer_label,
         authorization_acknowledged_at = transaction_timestamp()
   where run_transaction_id = txid_current()
     and issued_by = auth.uid();

  return result;
end;
$$;

alter function public.record_check_run(uuid, uuid[], integer, date, boolean) owner to postgres;
revoke all on function public.record_check_run(uuid, uuid[], integer, date, boolean)
  from public, anon;
grant execute on function public.record_check_run(uuid, uuid[], integer, date, boolean)
  to authenticated, service_role;
