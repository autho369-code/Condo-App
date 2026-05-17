import axios from "axios";
import { ENV } from "../_core/env";

const OUTLOOK_AUTH_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";
const OUTLOOK_TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
const GRAPH_ME_URL = "https://graph.microsoft.com/v1.0/me";
const GRAPH_MESSAGES_URL = "https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages";

export function getOutlookRedirectUri(origin: string): string {
  return `${origin}/api/email/outlook/callback`;
}

export function buildOutlookAuthUrl(state: string, origin: string): string {
  const params = new URLSearchParams({
    client_id: ENV.outlookClientId,
    redirect_uri: getOutlookRedirectUri(origin),
    response_type: "code",
    scope: [
      "https://graph.microsoft.com/Mail.Read",
      "https://graph.microsoft.com/User.Read",
      "offline_access",
    ].join(" "),
    response_mode: "query",
    state,
  });
  return `${OUTLOOK_AUTH_URL}?${params.toString()}`;
}

export async function exchangeOutlookCode(
  code: string,
  origin: string
): Promise<{ accessToken: string; refreshToken: string | null; expiresAt: Date; email: string }> {
  const res = await axios.post<{
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  }>(OUTLOOK_TOKEN_URL, new URLSearchParams({
    client_id: ENV.outlookClientId,
    client_secret: ENV.outlookClientSecret,
    code,
    redirect_uri: getOutlookRedirectUri(origin),
    grant_type: "authorization_code",
    scope: "https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/User.Read offline_access",
  }).toString(), {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  const { access_token, refresh_token, expires_in } = res.data;
  const expiresAt = new Date(Date.now() + expires_in * 1000);

  const userInfo = await axios.get<{ mail?: string; userPrincipalName?: string }>(GRAPH_ME_URL, {
    headers: { Authorization: `Bearer ${access_token}` },
  });

  const email = userInfo.data.mail ?? userInfo.data.userPrincipalName ?? "";

  return {
    accessToken: access_token,
    refreshToken: refresh_token ?? null,
    expiresAt,
    email,
  };
}

export async function refreshOutlookToken(
  refreshToken: string
): Promise<{ accessToken: string; expiresAt: Date }> {
  const res = await axios.post<{ access_token: string; expires_in: number }>(
    OUTLOOK_TOKEN_URL,
    new URLSearchParams({
      client_id: ENV.outlookClientId,
      client_secret: ENV.outlookClientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
      scope: "https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/User.Read offline_access",
    }).toString(),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
  );
  return {
    accessToken: res.data.access_token,
    expiresAt: new Date(Date.now() + res.data.expires_in * 1000),
  };
}

interface OutlookMessage {
  id: string;
  subject: string;
  from: { emailAddress: { address: string; name?: string } };
  toRecipients: Array<{ emailAddress: { address: string } }>;
  bodyPreview: string;
  body: { content: string; contentType: string };
  receivedDateTime: string;
}

export interface ParsedEmail {
  externalId: string;
  subject: string;
  fromAddress: string;
  toAddresses: string;
  bodyPreview: string;
  fullBody: string;
  receivedAt: Date;
}

export async function fetchOutlookMessages(
  accessToken: string,
  maxResults = 50
): Promise<ParsedEmail[]> {
  const res = await axios.get<{ value: OutlookMessage[] }>(GRAPH_MESSAGES_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    params: {
      $top: maxResults,
      $orderby: "receivedDateTime desc",
      $select: "id,subject,from,toRecipients,bodyPreview,body,receivedDateTime",
    },
  });

  return (res.data.value ?? []).map((msg) => {
    const fullBody = msg.body.contentType === "html"
      ? msg.body.content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
      : msg.body.content;

    return {
      externalId: msg.id,
      subject: msg.subject || "(no subject)",
      fromAddress: msg.from?.emailAddress
        ? `${msg.from.emailAddress.name ?? ""} <${msg.from.emailAddress.address}>`.trim()
        : "",
      toAddresses: (msg.toRecipients ?? [])
        .map((r) => r.emailAddress.address)
        .join(", "),
      bodyPreview: msg.bodyPreview?.slice(0, 300) ?? "",
      fullBody: fullBody.slice(0, 10000),
      receivedAt: new Date(msg.receivedDateTime),
    };
  });
}
