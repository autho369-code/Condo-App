-- #104 review: lock the card while recording a charge (a concurrent edit
-- can't change its account mid-post), and recheck that the card's liability
-- account is still an active liability before posting to it.
do $$
declare def text;
begin
  def := pg_get_functiondef('public.record_credit_card_charge(uuid, uuid, date, text, uuid, uuid, numeric, text, text)'::regprocedure);
  if def !~ 'select \* into v_card from public\.credit_card_accounts where id = p_card_id and archived_at is null;' then
    raise exception 'credit_card_review_fixes: record_credit_card_charge drifted';
  end if;
  def := replace(def,
    'select * into v_card from public.credit_card_accounts where id = p_card_id and archived_at is null;',
    'select * into v_card from public.credit_card_accounts where id = p_card_id and archived_at is null for update;');
  def := replace(def,
    'if v_gl.id = v_card.gl_account_id or',
    'if not exists (select 1 from public.gl_accounts lg where lg.id = v_card.gl_account_id and coalesce(lg.active, true)' || chr(10) ||
    '                   and lg.account_type::text in (''liability'', ''accounts_payable'')) then' || chr(10) ||
    '    raise exception ''The card''''s liability account is inactive or no longer a liability — fix it on the card first'' using errcode = ''22023'';' || chr(10) ||
    '  end if;' || chr(10) ||
    '  if v_gl.id = v_card.gl_account_id or');
  execute def;
end $$;
