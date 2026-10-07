-- Invitation emails queued by trg_queue_invitation_email (Settings → "Invite a
-- staff member" and any other invitation not sent by the application) linked
-- to the platform address (app_portal_url → www.portier369.com) and put the
-- inviter's message into the HTML unescaped.
--
-- Now:
--   * the accept link is on the company's own workspace, <slug>.portier369.com
--     (sign-ins always go through Portier369's Supabase sign-in on the slug
--     host, never a custom domain); platform address only if the slug is
--     unusable;
--   * the company name, role, inviter and message are HTML-escaped, and so are
--     the links; a token that isn't a plain [A-Za-z0-9_-] string is refused
--     (raises, so the insert fails loudly) because staff can insert invitation
--     rows directly and choose the token;
--   * staff invitations (hoa_role = 'manager') link the company's Manager
--     Runbook on its verified custom domain when it has one (an ordinary
--     link, not a sign-in), else the slug workspace — like the Company Admin
--     manager invitation (companyUrl).
-- Signature, owner and language are unchanged; execute stays service-only.

create or replace function public.render_invitation_email(inv public.user_invitations)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $_$
declare
  portfolio_row public.portfolios;
  role_name text;
  inviter_email text;
  company text;
  base_url text;
  accept_url text;
  runbook_base text;
  runbook_url text;
  html text;
  txt text;
  subject text;
begin
  select * into portfolio_row from public.portfolios where id = inv.portfolio_id;
  select name into role_name from public.user_roles where id = inv.role_id;
  select email into inviter_email from auth.users where id = inv.invited_by;

  if inv.token is null or inv.token !~ '^[A-Za-z0-9_-]{16,128}$' then
    raise exception 'render_invitation_email: invitation token has an invalid format';
  end if;

  company := coalesce(nullif(btrim(portfolio_row.company_name), ''), 'your management company');

  base_url := case
    when portfolio_row.slug ~ '^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])$'
      then 'https://' || portfolio_row.slug || '.portier369.com'
    else rtrim(public.app_portal_url(), '/')
  end;
  accept_url := base_url || '/invite?token=' || inv.token;
  runbook_base := case
    when portfolio_row.custom_domain is not null
     and portfolio_row.custom_domain_verified_at > now() - interval '3 hours'
      then 'https://' || portfolio_row.custom_domain
    else base_url
  end;
  runbook_url := case when inv.hoa_role::text = 'manager'
    then runbook_base || '/manuals/manager-runbook.pdf' end;

  subject := format('You''re invited to %s', company);

  html := format($html$<!doctype html>
<html><body style="font-family:-apple-system,Segoe UI,sans-serif;max-width:560px;margin:40px auto;padding:24px;color:#1a1a1a;">
  <h2 style="margin:0 0 16px;">You're invited to %s</h2>
  <p>%s invited you to join <strong>%s</strong>%s.</p>
  %s
  <p style="margin:24px 0;"><a href="%s" style="background:#2563eb;color:white;padding:10px 16px;border-radius:6px;text-decoration:none;display:inline-block;">Accept invitation</a></p>
  %s
  <p style="font-size:12px;color:#666;">This invitation expires on %s. If you can't click the button, copy this link into your browser:<br/><code style="font-size:11px;word-break:break-all;">%s</code></p>
</body></html>$html$,
    public.html_escape(company),
    public.html_escape(coalesce(inviter_email, 'An administrator')),
    public.html_escape(company),
    case when role_name is not null then ' as a ' || public.html_escape(role_name) else '' end,
    case when inv.message is not null and length(btrim(inv.message)) > 0 then
      '<p style="background:#f3f4f6;padding:12px 16px;border-radius:6px;font-style:italic;">' || public.html_escape(inv.message) || '</p>'
    else '' end,
    public.html_escape(accept_url),
    case when runbook_url is not null then
      '<p>Your operating guide (Manager Runbook), worth bookmarking: <a href="' || public.html_escape(runbook_url) || '">Manager Runbook</a></p>'
    else '' end,
    to_char(inv.expires_at at time zone 'UTC', 'Mon DD YYYY "at" HH24:MI "UTC"'),
    public.html_escape(accept_url)
  );

  txt := format(E'You''re invited to %s.\n\n%s invited you to join %s%s.\n\n%sAccept the invitation: %s\n\n%sExpires: %s',
    company,
    coalesce(inviter_email, 'An administrator'),
    company,
    case when role_name is not null then ' as a ' || role_name else '' end,
    case when inv.message is not null and length(btrim(inv.message)) > 0 then inv.message || E'\n\n' else '' end,
    accept_url,
    case when runbook_url is not null then 'Your operating guide (Manager Runbook): ' || runbook_url || E'\n\n' else '' end,
    to_char(inv.expires_at at time zone 'UTC', 'Mon DD YYYY HH24:MI UTC')
  );

  return jsonb_build_object('subject', subject, 'html', html, 'text', txt);
end;
$_$;

comment on function public.render_invitation_email(public.user_invitations) is
  'Subject/html/text for an invitation email. Accept link on the company workspace <slug>.portier369.com (app_portal_url() only when the slug is unusable); staff invitations link the Manager Runbook (verified custom domain, else the workspace).';

revoke execute on function public.render_invitation_email(public.user_invitations) from public, anon, authenticated;
grant execute on function public.render_invitation_email(public.user_invitations) to service_role;
