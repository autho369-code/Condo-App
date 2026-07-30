import 'server-only';

import { NextResponse } from 'next/server';

import { createServiceClient } from '@/lib/supabase/server';
import {
  consumeScopedRateLimit,
  rateLimitHeaders,
  type RateLimitResult,
} from '@/lib/server/rate-limit';

export const MAX_AUTHENTICATED_AI_BODY_BYTES = 32 * 1024;
export const MAX_ASSISTANT_MESSAGE_CHARS = 2000;

const AUTHENTICATED_ASSISTANT_POLICY = {
  scope: 'ai:authenticated-assistant',
  windowSeconds: 5 * 60,
  maxRequests: 30,
};

export type AssistantTurn = { role: 'user' | 'assistant'; content: string };

type GuardSuccess<T> = {
  ok: true;
  body: T;
  rateLimit: RateLimitResult;
};

type GuardFailure = {
  ok: false;
  response: NextResponse;
};

function failure(
  error: string,
  status: number,
  headers?: Record<string, string>,
): GuardFailure {
  return { ok: false, response: NextResponse.json({ error }, { status, headers }) };
}

async function readLimitedUtf8(request: Request): Promise<{ text?: string; tooLarge?: boolean }> {
  const declaredLength = request.headers.get('content-length');
  if (declaredLength && /^\d+$/.test(declaredLength.trim())) {
    const bytes = Number(declaredLength);
    if (!Number.isSafeInteger(bytes) || bytes > MAX_AUTHENTICATED_AI_BODY_BYTES) {
      return { tooLarge: true };
    }
  }

  if (!request.body) return { text: '' };
  const reader = request.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let total = 0;
  let text = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_AUTHENTICATED_AI_BODY_BYTES) {
        try { await reader.cancel(); } catch {}
        return { tooLarge: true };
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return { text };
  } catch {
    try { await reader.cancel(); } catch {}
    return {};
  } finally {
    reader.releaseLock();
  }
}

/**
 * Parse a small authenticated assistant request and consume a durable per-user
 * quota. The control fails closed if the service client or rate-limit RPC is
 * unavailable so provider spend cannot become unbounded during an outage.
 */
export async function guardAuthenticatedAssistantRequest<T extends Record<string, unknown>>(
  request: Request,
  authUserId: string | null | undefined,
): Promise<GuardSuccess<T> | GuardFailure> {
  const contentType = request.headers.get('content-type')?.toLowerCase() ?? '';
  if (!contentType.startsWith('application/json')) {
    return failure('Content-Type must be application/json', 415);
  }

  let service: ReturnType<typeof createServiceClient>;
  try {
    service = createServiceClient();
  } catch (error) {
    console.error('authenticated AI request guard unavailable:', error instanceof Error ? error.message : 'configuration error');
    return failure('Request controls are temporarily unavailable', 503, { 'Cache-Control': 'no-store', 'Retry-After': '60' });
  }

  const rateLimit = await consumeScopedRateLimit(service, authUserId ?? '', AUTHENTICATED_ASSISTANT_POLICY);
  if (rateLimit.unavailable) {
    return failure('Request controls are temporarily unavailable', 503, rateLimitHeaders(rateLimit));
  }
  if (!rateLimit.allowed) {
    return failure('Too many assistant requests. Please try again shortly.', 429, rateLimitHeaders(rateLimit));
  }

  const limited = await readLimitedUtf8(request);
  if (limited.tooLarge) {
    return failure(`Request body must be ${MAX_AUTHENTICATED_AI_BODY_BYTES / 1024} KB or smaller`, 413);
  }
  if (limited.text === undefined) return failure('Invalid request body', 400);

  let body: unknown;
  try {
    body = JSON.parse(limited.text);
  } catch {
    return failure('Invalid request body', 400);
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return failure('Invalid request body', 400);
  }
  return { ok: true, body: body as T, rateLimit };
}

export function boundedAssistantHistory(value: unknown, limit = 6): AssistantTurn[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (turn): turn is AssistantTurn =>
        !!turn
        && typeof turn === 'object'
        && ((turn as AssistantTurn).role === 'user' || (turn as AssistantTurn).role === 'assistant')
        && typeof (turn as AssistantTurn).content === 'string'
        && (turn as AssistantTurn).content.length <= MAX_ASSISTANT_MESSAGE_CHARS,
    )
    .slice(-limit);
}
