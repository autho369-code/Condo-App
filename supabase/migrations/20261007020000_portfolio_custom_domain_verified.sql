-- When a company's custom domain is confirmed to serve that company, so links
-- in its emails and pages can use the company's own domain instead of
-- <slug>.portier369.com.
--  * custom_domain_verified_at: last time the domain-check job reached the
--    company over HTTPS on its custom domain (null = links keep using the
--    workspace address).
--  * API users (the authenticated/anon roles) can never set it; the job writes
--    it with the service role. It resets to null whenever custom_domain
--    changes, so a new or removed domain is never used in links before it is
--    checked.
--  * Dues reminders (queue_payment_reminders) link to the verified custom
--    domain too, instead of always <slug>.portier369.com.
-- Additive only: nothing is dropped or deleted.

alter table public.portfolios
  add column if not exists custom_domain_verified_at timestamptz;

comment on column public.portfolios.custom_domain_verified_at is
  'Last time the domain check reached this company over HTTPS on custom_domain. Never set by API users; reset when custom_domain changes.';

create or replace function public.portfolios_guard_domain_verification()
returns trigger
language plpgsql
set search_path to 'pg_catalog', 'public'
as $function$
begin
  if tg_op = 'INSERT' then
    if current_user in ('authenticated', 'anon') then
      new.custom_domain_verified_at := null;
    end if;
    return new;
  end if;

  if new.custom_domain is distinct from old.custom_domain then
    new.custom_domain_verified_at := null;
    return new;
  end if;

  if new.custom_domain_verified_at is distinct from old.custom_domain_verified_at
     and current_user in ('authenticated', 'anon') then
    raise exception 'The custom domain check sets this automatically.' using errcode = '42501';
  end if;
  return new;
end;
$function$;

create or replace trigger portfolios_guard_domain_verification
  before insert or update on public.portfolios
  for each row execute function public.portfolios_guard_domain_verification();

-- Dues reminders: rewrite the live definition in place (CREATE OR REPLACE
-- keeps grants); re-running is a no-op once it reads custom_domain_verified_at.
do $$
declare v_def text;
begin
  v_def := pg_get_functiondef('public.queue_payment_reminders'::regproc::regprocedure);
  if position('custom_domain_verified_at' in v_def) = 0
     and position('select id, company_name, slug, coalesce(default_payment_reminder_days' in v_def) > 0
     and position('v_portal := case when p.slug ~' in v_def) > 0 then
    v_def := replace(v_def,
      'select id, company_name, slug, coalesce(default_payment_reminder_days',
      'select id, company_name, slug, custom_domain, custom_domain_verified_at, coalesce(default_payment_reminder_days');
    v_def := replace(v_def,
      'v_portal := case when p.slug ~',
      'v_portal := case when p.custom_domain is not null and p.custom_domain_verified_at is not null'
        || ' then ''https://'' || p.custom_domain || ''/portal/pay'' when p.slug ~');
    execute v_def;
  end if;
end $$;
