-- Company Admin manager invitations must not depend on portfolio-specific role
-- seed data or leak through user_roles RLS. Keep the canonical system roles
-- available and provide one tenant-checked, atomic invitation entry point.

insert into public.user_roles (
  portfolio_id,
  name,
  description,
  is_system,
  profile_access
) values
  (null, 'President', 'Full system access for HOA president', true, array['association', 'property']),
  (null, 'Accountant', 'Accounting access: GL, bills, payments, journals', true, array['association', 'property']),
  (null, 'Property Manager', 'Operational management of associations and units', true, array['association', 'property']),
  (null, 'On-Site Manager', 'Day-to-day site operations, maintenance coordination', true, array['property']),
  (null, 'Leasing Agent', 'Leasing, occupancy, tenant communications', true, array['property']),
  (null, 'Accounts Payable', 'Bills, POs, vendor payments', true, array['association', 'property'])
on conflict (portfolio_id, name) do nothing;

create or replace function public.queue_invitation_email()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  rendered jsonb;
  pf_email jsonb;
  pf_from_addr text;
  pf_from_name text;
  pf_reply_to text;
begin
  if new.status <> 'pending'
     or new.metadata ->> 'email_delivery' = 'application' then
    return new;
  end if;

  rendered := public.render_invitation_email(new);

  select email_settings into pf_email
  from public.portfolios
  where id = new.portfolio_id;

  pf_from_addr := pf_email ->> 'from_address';
  pf_from_name := pf_email ->> 'from_name';
  pf_reply_to := pf_email ->> 'reply_to';

  if pf_from_addr is null or pf_from_addr = '' then
    pf_from_addr := 'noreply@portier369.com';
  end if;
  if pf_from_name is null or pf_from_name = '' then
    select company_name into pf_from_name
    from public.portfolios
    where id = new.portfolio_id;
  end if;

  insert into public.email_queue (
    portfolio_id,
    to_email,
    to_name,
    subject,
    body,
    from_address,
    from_name,
    reply_to,
    status
  ) values (
    new.portfolio_id,
    new.email,
    new.full_name,
    rendered ->> 'subject',
    rendered ->> 'html',
    pf_from_addr,
    pf_from_name,
    pf_reply_to,
    'pending'
  );

  return new;
end;
$function$;

create or replace function public.create_manager_invitation(
  p_email text,
  p_association_ids uuid[] default array[]::uuid[],
  p_message text default null,
  p_expires_days integer default 14
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_portfolio_id uuid;
  v_role_id uuid;
  v_email text := lower(trim(coalesce(p_email, '')));
  v_association_ids uuid[];
  v_invitation public.user_invitations;
begin
  if v_email = '' or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Enter a valid manager email address';
  end if;

  if p_expires_days < 1 or p_expires_days > 30 then
    raise exception 'Invitation expiry must be between 1 and 30 days';
  end if;

  select p.portfolio_id
  into v_portfolio_id
  from public.profiles p
  where p.id = v_actor_id
    and p.hoa_role = 'company_admin'
    and p.disabled_at is null;

  if v_portfolio_id is null then
    raise exception 'Active company administrator access is required';
  end if;

  select coalesce(array_agg(distinct requested.association_id), array[]::uuid[])
  into v_association_ids
  from unnest(coalesce(p_association_ids, array[]::uuid[])) requested(association_id);

  if exists (
    select 1
    from unnest(v_association_ids) requested(association_id)
    left join public.associations association
      on association.id = requested.association_id
     and association.portfolio_id = v_portfolio_id
     and association.archived_at is null
    where association.id is null
  ) then
    raise exception 'One or more associations are outside your portfolio';
  end if;

  if exists (
    select 1
    from public.user_invitations invitation
    where invitation.portfolio_id = v_portfolio_id
      and lower(invitation.email) = v_email
      and invitation.hoa_role = 'manager'
      and invitation.status = 'pending'
      and invitation.expires_at > now()
  ) then
    raise exception 'A pending manager invitation already exists for this email';
  end if;

  select role.id
  into v_role_id
  from public.user_roles role
  where role.name = 'Property Manager'
    and (role.portfolio_id = v_portfolio_id or (role.is_system and role.portfolio_id is null))
  order by (role.portfolio_id = v_portfolio_id) desc nulls last
  limit 1;

  if v_role_id is null then
    raise exception 'The Property Manager role is not configured';
  end if;

  insert into public.user_invitations (
    portfolio_id,
    email,
    hoa_role,
    role_id,
    invited_by,
    message,
    expires_at,
    association_ids,
    metadata
  ) values (
    v_portfolio_id,
    v_email,
    'manager',
    v_role_id,
    v_actor_id,
    p_message,
    now() + make_interval(days => p_expires_days),
    v_association_ids,
    jsonb_build_object('email_delivery', 'application')
  )
  returning * into v_invitation;

  return jsonb_build_object(
    'invitation_id', v_invitation.id,
    'token', v_invitation.token,
    'expires_at', v_invitation.expires_at,
    'association_ids', to_jsonb(v_association_ids)
  );
end;
$function$;

revoke all on function public.create_manager_invitation(text, uuid[], text, integer)
  from public, anon;
grant execute on function public.create_manager_invitation(text, uuid[], text, integer)
  to authenticated;
