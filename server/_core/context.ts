import type { Request, Response } from "express";
import { parse as parseCookies } from "cookie";
import { verifySession } from "./session";
import { getUserByOpenId } from "../db";
import { COOKIE_NAME } from "../../shared/const";

export type TrpcContext = {
  req: Request;
  res: Response;
  user: Awaited<ReturnType<typeof getUserByOpenId>> | null;
};

export async function createContext({ req, res }: { req: Request; res: Response }): Promise<TrpcContext> {
  let user: TrpcContext["user"] = null;
  const cookieHeader = req.headers.cookie ?? "";
  const cookies = parseCookies(cookieHeader);
  const token = cookies[COOKIE_NAME];
  if (token) {
    const session = await verifySession(token);
    if (session?.openId) {
      user = await getUserByOpenId(session.openId) ?? null;
    }
  }
  return { req, res, user };
}
