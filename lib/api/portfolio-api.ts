import 'server-only';

import { createServiceClient } from '@/lib/supabase/server';
import { consumePublicRateLimit, consumeScopedRateLimit } from '@/lib/server/rate-limit';

export type PortfolioApiScope =
  | 'read:associations'
  | 'read:work_orders'
  | 'read:vendors'
  | 'read:violations'
  | 'read:reserves';

type ApiContext = {
  ok: true;
  db: any;
  portfolioId: string;
  keyId: string;
  scopes: string[];
  headers: Record<string, string>;
};

type ApiFailure = { ok: false; response: Response };

const jsonHeaders = {
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json; charset=utf-8',
  'Vary': 'Authorization, X-API-Key',
  'X-Portier-API-Version': '2026-08-01',
};

export function rawApiKey(request: Request) {
  const authorization = request.headers.get('authorization')?.trim() ?? '';
  if (authorization.toLowerCase().startsWith('bearer ')) return authorization.slice(7).trim();
  return request.headers.get('x-api-key')?.trim() ?? '';
}

export function scopeAllows(scopes: string[], requiredScope: PortfolioApiScope) {
  return scopes.includes('*')
    || scopes.includes('read:*')
    || scopes.includes(requiredScope);
}

export function apiJson(data: unknown, init?: { status?: number; headers?: Record<string, string> }) {
  return Response.json(data, {
    status: init?.status ?? 200,
    headers: { ...jsonHeaders, ...init?.headers },
  });
}

export async function authenticatePortfolioApi(
  request: Request,
  requiredScope: PortfolioApiScope,
): Promise<ApiContext | ApiFailure> {
  const rawKey = rawApiKey(request);
  if (!rawKey || rawKey.length < 16 || rawKey.length > 256) {
    return { ok: false, response: apiJson({ error: { code: 'unauthorized', message: 'Provide a valid bearer API key.' } }, { status: 401 }) };
  }

  let db: any;
  try {
    db = createServiceClient() as any;
  } catch {
    return { ok: false, response: apiJson({ error: { code: 'service_unavailable', message: 'API authentication is unavailable.' } }, { status: 503 }) };
  }

  const ipLimit = await consumePublicRateLimit(db, request, {
    scope: 'portfolio-api-ip',
    windowSeconds: 60,
    maxRequests: 1_200,
  });
  if (!ipLimit.allowed) {
    return {
      ok: false,
      response: apiJson(
        { error: { code: ipLimit.unavailable ? 'rate_limit_unavailable' : 'rate_limited', message: 'Request limit reached. Try again later.' } },
        { status: ipLimit.unavailable ? 503 : 429, headers: { 'Retry-After': String(ipLimit.retryAfterSeconds), 'X-RateLimit-Remaining': '0' } },
      ),
    };
  }

  const { data, error } = await db.rpc('verify_api_key', { p_raw_key: rawKey });
  const verified = Array.isArray(data) ? data[0] : data;
  if (error || !verified?.portfolio_id || !verified?.key_id) {
    return { ok: false, response: apiJson({ error: { code: 'unauthorized', message: 'API key is invalid, expired, or revoked.' } }, { status: 401 }) };
  }

  const scopes = Array.isArray(verified.scopes) ? verified.scopes.map(String) : [];
  if (!scopeAllows(scopes, requiredScope)) {
    return { ok: false, response: apiJson({ error: { code: 'forbidden', message: `API key does not grant ${requiredScope}.` } }, { status: 403 }) };
  }

  const [{ data: portfolio }, keyLimit] = await Promise.all([
    db.from('portfolios').select('id, suspended_at').eq('id', verified.portfolio_id).maybeSingle(),
    consumeScopedRateLimit(db, String(verified.key_id), {
      scope: 'portfolio-api-key',
      windowSeconds: 60,
      maxRequests: 600,
    }),
  ]);

  if (!portfolio || portfolio.suspended_at) {
    return { ok: false, response: apiJson({ error: { code: 'account_unavailable', message: 'Portfolio API access is unavailable.' } }, { status: 403 }) };
  }
  if (!keyLimit.allowed) {
    return {
      ok: false,
      response: apiJson(
        { error: { code: keyLimit.unavailable ? 'rate_limit_unavailable' : 'rate_limited', message: 'API key request limit reached.' } },
        { status: keyLimit.unavailable ? 503 : 429, headers: { 'Retry-After': String(keyLimit.retryAfterSeconds), 'X-RateLimit-Remaining': '0' } },
      ),
    };
  }

  return {
    ok: true,
    db,
    portfolioId: verified.portfolio_id,
    keyId: verified.key_id,
    scopes,
    headers: { 'X-RateLimit-Remaining': String(Math.min(ipLimit.remaining, keyLimit.remaining)) },
  };
}

export function pagination(request: Request) {
  const params = new URL(request.url).searchParams;
  const page = Math.max(1, Math.floor(Number(params.get('page') ?? 1) || 1));
  const limit = Math.max(1, Math.min(100, Math.floor(Number(params.get('limit') ?? 50) || 50)));
  const offset = (page - 1) * limit;
  const query = (params.get('q') ?? '')
    .replace(/[^\p{L}\p{N}\s._-]/gu, '')
    .trim()
    .slice(0, 120);
  return { page, limit, offset, query };
}

export function listResponse(
  rows: unknown[],
  count: number | null,
  page: number,
  limit: number,
  headers: Record<string, string>,
) {
  return apiJson({ data: rows, meta: { page, limit, total: count ?? rows.length } }, { headers });
}
