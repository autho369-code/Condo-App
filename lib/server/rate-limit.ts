import 'server-only';

import { createHmac } from 'node:crypto';

type HeaderSource = Request | Headers;

export interface RateLimitPolicy {
  scope: string;
  windowSeconds: number;
  maxRequests: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
  unavailable?: boolean;
}

function headersFrom(source: HeaderSource): Headers {
  return typeof (source as Headers).get === 'function'
    ? source as Headers
    : (source as Request).headers;
}

export function clientAddress(source: HeaderSource): string {
  const headers = headersFrom(source);
  const forwarded = headers.get('x-portier-client-address')
    || headers.get('x-vercel-forwarded-for')
    || 'unknown';
  return forwarded.split(',')[0].trim().slice(0, 128) || 'unknown';
}

async function consumeRateLimitForIdentifier(
  db: any,
  identifier: string,
  policy: RateLimitPolicy,
): Promise<RateLimitResult> {
  const secret = process.env.RATE_LIMIT_SECRET || process.env.CRON_SECRET;
  if (!secret || secret.length < 24) {
    console.error('rate-limit configuration unavailable: RATE_LIMIT_SECRET or CRON_SECRET must contain at least 24 characters');
    return { allowed: false, remaining: 0, retryAfterSeconds: 60, unavailable: true };
  }

  const keyHash = createHmac('sha256', secret)
    .update(`${policy.scope}\0${identifier.slice(0, 512)}`, 'utf8')
    .digest('hex');

  let data: any;
  let error: any;
  try {
    ({ data, error } = await db.rpc('consume_api_rate_limit', {
      p_scope: policy.scope,
      p_key_hash: keyHash,
      p_window_seconds: policy.windowSeconds,
      p_max_requests: policy.maxRequests,
    }));
  } catch (rpcError) {
    console.error(
      'rate-limit backend unavailable:',
      policy.scope,
      rpcError instanceof Error ? rpcError.message : 'request failed',
    );
    return { allowed: false, remaining: 0, retryAfterSeconds: 60, unavailable: true };
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (error || !row) {
    console.error('rate-limit backend unavailable:', policy.scope, error?.message ?? 'no result');
    return { allowed: false, remaining: 0, retryAfterSeconds: 60, unavailable: true };
  }

  const resetAt = new Date(row.reset_at).getTime();
  if (!Number.isFinite(resetAt)) {
    console.error('rate-limit backend returned an invalid reset time:', policy.scope);
    return { allowed: false, remaining: 0, retryAfterSeconds: 60, unavailable: true };
  }

  const retryAfterSeconds = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
  return {
    allowed: !!row.allowed,
    remaining: Math.max(0, Number(row.remaining ?? 0)),
    retryAfterSeconds,
  };
}

export async function consumePublicRateLimit(
  db: any,
  source: HeaderSource,
  policy: RateLimitPolicy,
): Promise<RateLimitResult> {
  return consumeRateLimitForIdentifier(db, clientAddress(source), policy);
}

/** Apply a second durable limit to a known server-side identity (for example,
 * an association, email address, or browser chat session). The HMAC ensures
 * the raw identity never reaches the rate-limit table.
 */
export async function consumeScopedRateLimit(
  db: any,
  identifier: string,
  policy: RateLimitPolicy,
): Promise<RateLimitResult> {
  const normalized = identifier.trim().toLowerCase();
  if (!normalized) {
    return { allowed: false, remaining: 0, retryAfterSeconds: 60, unavailable: true };
  }
  return consumeRateLimitForIdentifier(db, normalized, policy);
}

export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'Cache-Control': 'no-store',
    'Retry-After': String(result.retryAfterSeconds),
    'X-RateLimit-Remaining': String(result.remaining),
  };
}
