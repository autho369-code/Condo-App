import axios from "axios";
import { ENV } from "../_core/env";

const GMAIL_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GMAIL_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";
const GMAIL_MESSAGES_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages";

export function getGmailRedirectUri(origin: string): string {
  return `${origin}/api/email/gmail/callback`;
}

export function buildGmailAuthUrl(state: string, origin: string): string {
  const params = new URLSearchParams({
    client_id: ENV.gmailClientId,
    redirect_uri: getGmailRedirectUri(origin),
    response_type: "code",
    scope: [
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile",
    ].join(" "),
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `${GMAIL_AUTH_URL}?${params.toString()}`;
}

export async function exchangeGmailCode(
  code: string,
  origin: string
): Promise<{ accessToken: string; refreshToken: string | null; expiresAt: Date; email: string }> {
  const res = await axios.post<{
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    token_type: string;
  }>(GMAIL_TOKEN_URL, new URLSearchParams({
    code,
    client_id: ENV.gmailClientId,
    client_secret: ENV.gmailClientSecret,
    redirect_uri: getGmailRedirectUri(origin),
    grant_type: "authorization_code",
  }).toString(), {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  const { access_token, refresh_token, expires_in } = res.data;
  const expiresAt = new Date(Date.now() + expires_in * 1000);

  // Get the email address of the connected account
  const userInfo = await axios.get<{ email: string }>(GMAIL_USERINFO_URL, {
    headers: { Authorization: `Bearer ${access_token}` },
  });

  return {
    accessToken: access_token,
    refreshToken: refresh_token ?? null,
    expiresAt,
    email: userInfo.data.email,
  };
}

export async function refreshGmailToken(refreshToken: string): Promise<{ accessToken: string; expiresAt: Date }> {
  const res = await axios.post<{ access_token: string; expires_in: number }>(
    GMAIL_TOKEN_URL,
    new URLSearchParams({
      client_id: ENV.gmailClientId,
      client_secret: ENV.gmailClientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }).toString(),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
  );
  return {
    accessToken: res.data.access_token,
    expiresAt: new Date(Date.now() + res.data.expires_in * 1000),
  };
}

interface GmailMessageHeader { name: string; value: string; }
interface GmailMessagePart { mimeType: string; body: { data?: string }; parts?: GmailMessagePart[]; }
interface GmailMessage {
  id: string;
  payload: { headers: GmailMessageHeader[]; body: { data?: string }; parts?: GmailMessagePart[]; };
  internalDate: string;
}

function decodeBase64(data: string): string {
  try {
    return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
  } catch {
    return "";
  }
}

function extractBody(payload: GmailMessage["payload"]): string {
  if (payload.body?.data) return decodeBase64(payload.body.data);
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === "text/plain" && part.body?.data) return decodeBase64(part.body.data);
    }
    for (const part of payload.parts) {
      if (part.mimeType === "text/html" && part.body?.data) {
        return decodeBase64(part.body.data).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      }
    }
  }
  return "";
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

export async function fetchGmailMessages(
  accessToken: string,
  maxResults = 50
): Promise<ParsedEmail[]> {
  // List message IDs
  const listRes = await axios.get<{ messages?: { id: string }[] }>(GMAIL_MESSAGES_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
    params: { maxResults, labelIds: "INBOX" },
  });

  const ids = listRes.data.messages ?? [];
  const emails: ParsedEmail[] = [];

  // Fetch each message in parallel (batched to 10 at a time)
  const batchSize = 10;
  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map((m) =>
        axios.get<GmailMessage>(`${GMAIL_MESSAGES_URL}/${m.id}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          params: { format: "full" },
        })
      )
    );
    for (const result of results) {
      if (result.status !== "fulfilled") continue;
      const msg = result.value.data;
      const headers = msg.payload.headers ?? [];
      const get = (name: string) => headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
      const fullBody = extractBody(msg.payload);
      emails.push({
        externalId: msg.id,
        subject: get("Subject") || "(no subject)",
        fromAddress: get("From"),
        toAddresses: get("To"),
        bodyPreview: fullBody.slice(0, 300),
        fullBody: fullBody.slice(0, 10000),
        receivedAt: new Date(parseInt(msg.internalDate, 10)),
      });
    }
  }

  return emails;
}
