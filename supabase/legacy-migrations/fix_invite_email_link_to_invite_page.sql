-- Invitation emails (auto-queued by trg_queue_invitation_email → render_invitation_email)
-- linked to /accept-invitation, which has NO set-password flow for brand-new invitees
-- (it only offers Sign in / Sign up). The working accept flow lives at /invite, which
-- validates the token, lets the invitee set a password, creates+signs-in the auth user,
-- and applies the invitation. Point the email link at /invite so manager/owner/vendor
-- invitations actually complete for first-time users.
CREATE OR REPLACE FUNCTION public.render_invitation_email(inv user_invitations)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
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

  accept_url := rtrim(public.app_portal_url(), '/') || '/invite?token=' || inv.token;
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
$function$;
