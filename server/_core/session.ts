import { SignJWT, jwtVerify } from "jose";
import { ENV } from "./env";

const secret = new TextEncoder().encode(ENV.jwtSecret);

export interface SessionPayload {
  userId: number;
  openId: string;
  role: string;
  portierRole: string;
  companyId?: number | null;
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}
