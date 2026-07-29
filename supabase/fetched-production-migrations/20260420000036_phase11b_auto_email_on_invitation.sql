-- =============================================================================
-- Phase 11b — Automatic invitation emails
-- When a user_invitations row is created, queue an invitation email that
-- the process-email-queue cron will deliver within ~2 minutes.
-- =============================================================================

-- Application-configurable portal base URL. Stored in Vault so edge functions
-- can read it too. Fallback: production URL.
create or replace function public.app_portal_url()
returns text
language sql stable security definer set search_path = pg_catalog, public, vault
as $$
  select coalesce(
    (select decrypted_secret from vault.decrypted_secrets where name = 'portal_base_url' limit 1),
    'https://portal.example.com'
  );
$$;

-- Render the invitation email body
create or replace function public.render_invitation_email(inv public.user_invitations)
returns jsonb
language plpgsql stable security definer set search_path = pg_catalog, public
as $$
declare
  portfolio_row public.portfolios;
  role_name text;
  accept_url text;
  inviter_email text;
  html text;
  txt text;
  subject text;
begin
  select * into portfolio_row from public.portfolios where id = inv.portfolio_id;
  select name into role_name from public.user_roles where id = inv.role_id;
  select email into inviter_email from auth.users where id = inv.invited_by;

  accept_url := rtrim(public.app_portal_url(), '/') || '/accept-invitation?token=' || inv.token;
  subject := format('You''re invited to %s', coalesce(portfolio_row.company_name, 'the portal'));

  html := format($html$<!doctype html>
<html><body style="font-family:-apple-system,Segoe UI,sans-serif;max-width:560px;margin:40px auto;padding:24px;color:#1a1a1a;">
  <h2 style="margin:0 0 16px;">You're invited to %s</h2>
  <p>%s invited you to join <strong>%s</strong>%s.</p>
  %s
  <p style="margin:24px 0;"><a href="%s" style="background:#2563eb;color:white;padding:10px 16px;border-radius:6px;text-decoration:none;display:inline-block;">Accept invitation</a></p>
  <p style="font-size:12px;color:#666;">This invitation expires on %s. If you can't click the button, copy this link into your browser:<br/><code style="font-size:11px;word-break:break-all;">%s</code></p>
</body></html>$html$,
    coalesce(portfolio_row.company_name, 'the portal'),
    coalesce(inviter_email, 'An administrator'),
    coalesce(portfolio_row.company_name, 'the portal'),
    case when role_name is not null then ' as a ' || role_name else '' end,
    case when inv.message is not null and length(inv.message) > 0 then
      '<p style="background:#f3f4f6;padding:12px 16px;border-radius:6px;font-style:italic;">' || inv.message || '</p>'
    else '' end,
    accept_url,
    to_char(inv.expires_at at time zone 'UTC', 'Mon DD YYYY "at" HH24:MI "UTC"'),
    accept_url
  );

  txt := format(E'You''re invited to %s.\n\n%s invited you to join%s.\n\n%sAccept the invitation: %s\n\nExpires: %s',
    coalesce(portfolio_row.company_name, 'the portal'),
    coalesce(inviter_email, 'An administrator'),
    case when role_name is not null then ' as a ' || role_name else '' end,
    case when inv.message is not null then inv.message || E'\n\n' else '' end,
    accept_url,
    to_char(inv.expires_at at time zone 'UTC', 'Mon DD YYYY HH24:MI UTC')
  );

  return jsonb_build_object('subject', subject, 'html', html, 'text', txt);
end;
$$;

-- Trigger: when a new pending invitation is inserted, add to email_queue
create or replace function public.queue_invitation_email()
returns trigger
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare
  rendered jsonb;
  assoc_id uuid;
begin
  if new.status <> 'pending' then
    return new;
  end if;

  rendered := public.render_invitation_email(new);

  -- association_id is optional context; leave null for invitations (portfolio-scoped)
  insert into public.email_queue (
    to_email, to_name, subject, body, association_id, sent_by, status
  ) values (
    new.email,
    null,
    rendered->>'subject',
    rendered->>'html',
    null,
    new.invited_by,
    'pending'
  );

  return new;
end;
$$;

drop trigger if exists trg_queue_invitation_email on public.user_invitations;
create trigger trg_queue_invitation_email
  after insert on public.user_invitations
  for each row execute function public.queue_invitation_email();

-- Also queue a fresh email when resend_invitation creates a new row (that's an INSERT too,
-- so the existing trigger above covers it).

comment on function public.queue_invitation_email() is 'On each new pending invitation, drops a rendered HTML email into email_queue. The process-email-queue cron picks it up within ~2 minutes.';
comment on function public.render_invitation_email(public.user_invitations) is 'Produces subject/html/text for an invitation email. Portal URL pulled from vault.decrypted_secrets.portal_base_url.';
;
