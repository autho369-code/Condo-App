import type { Express, Request, Response } from "express";
import { verifySession } from "../_core/session";
import { COOKIE_NAME } from "../../shared/const";
import { getUserByOpenId } from "../db";
import {
  buildGmailAuthUrl,
  exchangeGmailCode,
  refreshGmailToken,
  fetchGmailMessages,
} from "./gmail";
import {
  buildOutlookAuthUrl,
  exchangeOutlookCode,
  refreshOutlookToken,
  fetchOutlookMessages,
} from "./outlook";
import {
  upsertEmailConnection,
  getEmailConnectionById,
  updateEmailConnectionTokens,
  updateEmailConnectionSyncCursor,
  saveEmailThreads,
} from "./emailDb";
import { ENV } from "../_core/env";
import cookie from "cookie";

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function getUserFromRequest(req: Request) {
  const cookies = cookie.parse(req.headers.cookie ?? "");
  const token = cookies[COOKIE_NAME];
  if (!token) return null;
  const session = await verifySession(token);
  if (!session?.openId) return null;
  return getUserByOpenId(session.openId);
}

function getOrigin(req: Request): string {
  // Use the Referer header origin or fall back to request origin
  const referer = req.headers.referer ?? req.headers.origin ?? "";
  if (referer) {
    try {
      const url = new URL(referer);
      return `${url.protocol}//${url.host}`;
    } catch {}
  }
  // Fallback to the deployed domain
  return ENV.nodeEnv === "production"
    ? "https://condoauto-kvxvhrh2.manus.space"
    : `http://localhost:${ENV.port}`;
}

// ─── Route Registration ───────────────────────────────────────────────────────
export function registerEmailRoutes(app: Express) {
  // ── Gmail: Initiate OAuth ─────────────────────────────────────────────────
  app.get("/api/email/gmail/connect", async (req: Request, res: Response) => {
    const user = await getUserFromRequest(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    if (!ENV.gmailClientId) {
      return res.status(503).json({ error: "Gmail integration not configured. Please add GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET in Settings → Secrets." });
    }

    const origin = (req.query.origin as string) || getOrigin(req);
    const state = Buffer.from(JSON.stringify({ userId: user.id, companyId: user.companyId, origin })).toString("base64");
    const authUrl = buildGmailAuthUrl(state, origin);
    return res.redirect(authUrl);
  });

  // ── Gmail: OAuth Callback ─────────────────────────────────────────────────
  app.get("/api/email/gmail/callback", async (req: Request, res: Response) => {
    const { code, state, error } = req.query as Record<string, string>;

    if (error || !code || !state) {
      return res.redirect(`/dashboard/email?error=gmail_${error ?? "cancelled"}`);
    }

    let parsedState: { userId: number; companyId: number; origin: string };
    try {
      parsedState = JSON.parse(Buffer.from(state, "base64").toString("utf-8"));
    } catch {
      return res.redirect("/dashboard/email?error=gmail_invalid_state");
    }

    try {
      const { accessToken, refreshToken, expiresAt, email } = await exchangeGmailCode(code, parsedState.origin);
      await upsertEmailConnection({
        userId: parsedState.userId,
        companyId: parsedState.companyId,
        provider: "gmail",
        accountEmail: email,
        accessToken,
        refreshToken: refreshToken ?? undefined,
        expiresAt,
        isActive: true,
      });
      return res.redirect("/dashboard/email?connected=gmail");
    } catch (err) {
      console.error("[Gmail callback error]", err);
      return res.redirect("/dashboard/email?error=gmail_exchange_failed");
    }
  });

  // ── Outlook: Initiate OAuth ───────────────────────────────────────────────
  app.get("/api/email/outlook/connect", async (req: Request, res: Response) => {
    const user = await getUserFromRequest(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    if (!ENV.outlookClientId) {
      return res.status(503).json({ error: "Outlook integration not configured. Please add OUTLOOK_CLIENT_ID and OUTLOOK_CLIENT_SECRET in Settings → Secrets." });
    }

    const origin = (req.query.origin as string) || getOrigin(req);
    const state = Buffer.from(JSON.stringify({ userId: user.id, companyId: user.companyId, origin })).toString("base64");
    const authUrl = buildOutlookAuthUrl(state, origin);
    return res.redirect(authUrl);
  });

  // ── Outlook: OAuth Callback ───────────────────────────────────────────────
  app.get("/api/email/outlook/callback", async (req: Request, res: Response) => {
    const { code, state, error } = req.query as Record<string, string>;

    if (error || !code || !state) {
      return res.redirect(`/dashboard/email?error=outlook_${error ?? "cancelled"}`);
    }

    let parsedState: { userId: number; companyId: number; origin: string };
    try {
      parsedState = JSON.parse(Buffer.from(state, "base64").toString("utf-8"));
    } catch {
      return res.redirect("/dashboard/email?error=outlook_invalid_state");
    }

    try {
      const { accessToken, refreshToken, expiresAt, email } = await exchangeOutlookCode(code, parsedState.origin);
      await upsertEmailConnection({
        userId: parsedState.userId,
        companyId: parsedState.companyId,
        provider: "outlook",
        accountEmail: email,
        accessToken,
        refreshToken: refreshToken ?? undefined,
        expiresAt,
        isActive: true,
      });
      return res.redirect("/dashboard/email?connected=outlook");
    } catch (err) {
      console.error("[Outlook callback error]", err);
      return res.redirect("/dashboard/email?error=outlook_exchange_failed");
    }
  });
}

// ─── Token Refresh Helper ─────────────────────────────────────────────────────
export async function ensureFreshToken(connectionId: number): Promise<string | null> {
  const conn = await getEmailConnectionById(connectionId);
  if (!conn) return null;

  // If token expires in more than 5 minutes, it's still valid
  const fiveMinutes = 5 * 60 * 1000;
  if (conn.expiresAt && conn.expiresAt.getTime() - Date.now() > fiveMinutes) {
    return conn.accessToken;
  }

  // Token expired or about to expire — refresh it
  if (!conn.refreshToken) return null;

  try {
    let newAccessToken: string;
    let newExpiresAt: Date;

    if (conn.provider === "gmail") {
      const refreshed = await refreshGmailToken(conn.refreshToken);
      newAccessToken = refreshed.accessToken;
      newExpiresAt = refreshed.expiresAt;
    } else {
      const refreshed = await refreshOutlookToken(conn.refreshToken);
      newAccessToken = refreshed.accessToken;
      newExpiresAt = refreshed.expiresAt;
    }

    await updateEmailConnectionTokens(connectionId, newAccessToken, newExpiresAt);
    return newAccessToken;
  } catch (err) {
    console.error(`[Token refresh error for connection ${connectionId}]`, err);
    return null;
  }
}

// ─── Sync Helper (called from tRPC) ──────────────────────────────────────────
export async function syncEmailConnection(connectionId: number): Promise<{ synced: number; error?: string }> {
  const conn = await getEmailConnectionById(connectionId);
  if (!conn) return { synced: 0, error: "Connection not found" };

  const accessToken = await ensureFreshToken(connectionId);
  if (!accessToken) return { synced: 0, error: "Unable to refresh token. Please reconnect your account." };

  try {
    let emails;
    if (conn.provider === "gmail") {
      emails = await fetchGmailMessages(accessToken, 50);
    } else {
      emails = await fetchOutlookMessages(accessToken, 50);
    }

    const saved = await saveEmailThreads(conn.companyId, connectionId, conn.provider, emails);
    // Persist the sync timestamp
    await updateEmailConnectionSyncCursor(connectionId, "", new Date());
    return { synced: saved };
  } catch (err: any) {
    console.error(`[Sync error for connection ${connectionId}]`, err);
    return { synced: 0, error: err?.message ?? "Sync failed" };
  }
}
