import type { Request, Response } from "express";
import axios from "axios";
import { serialize } from "cookie";
import { upsertUser, getUserByOpenId } from "../db";
import { signSession } from "./session";
import { ENV } from "./env";
import { COOKIE_NAME } from "../../shared/const";

interface OAuthTokenResponse {
  access_token: string;
  token_type: string;
}

interface OAuthUserInfo {
  open_id: string;
  name?: string;
  email?: string;
  login_method?: string;
}

export async function handleOAuthCallback(req: Request, res: Response) {
  const { code, state } = req.query as Record<string, string>;
  if (!code) return res.status(400).send("Missing code");

  // Parse origin from state
  let origin = "";
  let returnPath = "/dashboard";
  try {
    const decoded = JSON.parse(Buffer.from(state ?? "", "base64").toString());
    origin = decoded.origin ?? "";
    returnPath = decoded.returnPath ?? "/dashboard";
  } catch {
    origin = req.headers.origin ?? `${req.protocol}://${req.headers.host}`;
  }

  try {
    // Exchange code for token
    const tokenRes = await axios.post<OAuthTokenResponse>(
      `${ENV.oauthServerUrl}/oauth/token`,
      { code, app_id: ENV.appId, grant_type: "authorization_code" },
      { headers: { "Content-Type": "application/json" } }
    );
    const accessToken = tokenRes.data.access_token;

    // Get user info
    const userRes = await axios.get<OAuthUserInfo>(`${ENV.oauthServerUrl}/oauth/userinfo`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const info = userRes.data;

    // Upsert user
    await upsertUser({
      openId: info.open_id,
      name: info.name ?? null,
      email: info.email ?? null,
      loginMethod: info.login_method ?? "manus",
    });

    const user = await getUserByOpenId(info.open_id);
    if (!user) return res.status(500).send("Failed to create user");

    // Sign session
    const token = await signSession({
      userId: user.id,
      openId: user.openId,
      role: user.role,
      portierRole: user.portierRole ?? "user",
      companyId: user.companyId,
    });

    const isSecure = origin.startsWith("https://");
    const cookieStr = serialize(COOKIE_NAME, token, {
      httpOnly: true,
      secure: isSecure,
      sameSite: isSecure ? "none" : "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });
    res.setHeader("Set-Cookie", cookieStr);
    res.redirect(`${origin}${returnPath}`);
  } catch (err) {
    console.error("[OAuth] Error:", err);
    res.status(500).send("Authentication failed");
  }
}
