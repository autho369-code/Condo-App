// Unsubscribe links for optional email (mass email, reminders). One link per
// email, on the company's own address; the token is 64 hex characters and is
// read and written only by the server (email_unsubscribe_links).

const TOKEN = /^[0-9a-f]{64}$/;

export function isUnsubscribeToken(token: string | undefined | null): token is string {
  return typeof token === 'string' && TOKEN.test(token);
}

/** The one-click address (RFC 8058 List-Unsubscribe-Post) for a page link. */
export function oneClickUrl(pageUrl: string): string {
  const url = new URL(pageUrl);
  url.pathname = url.pathname.replace(/^\/unsubscribe\//, '/api/unsubscribe/');
  return url.toString();
}

/** Headers mail providers show as their own Unsubscribe button. */
export function unsubscribeHeaders(pageUrl: string): Record<string, string> {
  return {
    'List-Unsubscribe': `<${oneClickUrl(pageUrl)}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  };
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** The footer added to an optional email when it is sent. */
export function unsubscribeFooter(pageUrl: string, companyName: string): string {
  const name = escapeHtml(companyName);
  return '<div style="margin-top:24px;padding-top:12px;border-top:1px solid #e5e7eb;'
    + 'font-family:system-ui,-apple-system,Segoe UI,Arial,sans-serif;font-size:12px;line-height:1.5;color:#6b7280">'
    + `You're receiving this optional email from ${name}. `
    + `<a href="${escapeHtml(pageUrl)}" style="color:#6b7280;text-decoration:underline">Unsubscribe</a>. `
    + 'Notices about your account and property are still sent.'
    + '</div>';
}
