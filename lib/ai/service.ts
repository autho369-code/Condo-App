import 'server-only';

import { decryptAICredential } from '@/lib/ai/credentials';

const PROVIDER_URLS = {
  openai: 'https://api.openai.com/v1/chat/completions',
  deepseek: 'https://api.deepseek.com/v1/chat/completions',
  anthropic: 'https://api.anthropic.com/v1/messages',
} as const;

export type AIProvider = keyof typeof PROVIDER_URLS;

export interface AIConfig {
  provider: AIProvider;
  model: string;
  apiKey: string;
}

type Message = { role: 'system' | 'user' | 'assistant'; content: string };

const MAX_MODEL_LENGTH = 128;
const MAX_RESPONSE_BYTES = 1024 * 1024;
const REQUEST_TIMEOUT_MS = 30_000;

export function isSupportedAIProvider(value: unknown): value is AIProvider {
  return typeof value === 'string' && Object.hasOwn(PROVIDER_URLS, value);
}

function validModel(value: unknown): value is string {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= MAX_MODEL_LENGTH
    && /^[A-Za-z0-9][A-Za-z0-9._:/-]*$/.test(value);
}

/**
 * Read a portfolio AI configuration. The database stores only authenticated
 * ciphertext; decryption happens in the server runtime with a deployment key.
 * The supplied database client must already be authorized for the portfolio.
 */
export async function getAIConfig(portfolioId: string, databaseClient?: any): Promise<AIConfig | null> {
  if (!portfolioId || portfolioId.length > 128) return null;

  let db = databaseClient;
  if (!db) {
    const { createClient } = await import('@/lib/supabase/server');
    db = await createClient();
  }

  const { data: portfolio, error } = await db
    .from('portfolios')
    .select('ai_provider, ai_model, ai_api_key_ciphertext')
    .eq('id', portfolioId)
    .maybeSingle();

  if (error || !portfolio?.ai_api_key_ciphertext) return null;
  if (!isSupportedAIProvider(portfolio.ai_provider) || !validModel(portfolio.ai_model)) return null;

  try {
    return {
      provider: portfolio.ai_provider,
      model: portfolio.ai_model,
      apiKey: decryptAICredential(portfolio.ai_api_key_ciphertext),
    };
  } catch (error) {
    console.error(
      'AI credential could not be decrypted for portfolio:',
      portfolioId,
      error instanceof Error ? error.message : 'invalid credential',
    );
    return null;
  }
}

async function parseProviderResponse(response: Response): Promise<any> {
  const declaredLength = Number(response.headers.get('content-length') ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
    throw new Error('AI provider response exceeded the size limit.');
  }

  const text = await response.text();
  if (Buffer.byteLength(text, 'utf8') > MAX_RESPONSE_BYTES) {
    throw new Error('AI provider response exceeded the size limit.');
  }
  if (!response.ok) {
    throw new Error(`AI provider request failed with status ${response.status}.`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('AI provider returned an invalid response.');
  }
}

async function providerFetch(config: AIConfig, body: Record<string, unknown>, timeoutMs = REQUEST_TIMEOUT_MS): Promise<any> {
  if (!isSupportedAIProvider(config.provider) || !validModel(config.model)) {
    throw new Error('AI provider configuration is invalid.');
  }
  if (typeof config.apiKey !== 'string' || config.apiKey.length < 8 || config.apiKey.length > 4096) {
    throw new Error('AI provider configuration is invalid.');
  }

  const anthropic = config.provider === 'anthropic';
  const response = await fetch(PROVIDER_URLS[config.provider], {
    method: 'POST',
    headers: anthropic
      ? {
          'Content-Type': 'application/json',
          'x-api-key': config.apiKey,
          'anthropic-version': '2023-06-01',
        }
      : {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
    body: JSON.stringify(body),
    redirect: 'error',
    cache: 'no-store',
    signal: AbortSignal.timeout(timeoutMs),
  });
  return parseProviderResponse(response);
}

/** Call a fixed, allow-listed AI provider. Tenant-controlled URLs are never fetched. */
export async function chatCompletion(
  config: AIConfig,
  messages: Message[],
  options?: { temperature?: number; maxTokens?: number; jsonMode?: boolean },
) {
  const maxTokens = Math.min(4096, Math.max(1, options?.maxTokens ?? 2000));
  if (config.provider === 'anthropic') {
    const system = messages
      .filter((message) => message.role === 'system')
      .map((message) => message.content)
      .join('\n\n');
    const data = await providerFetch(config, {
      model: config.model,
      system,
      messages: messages
        .filter((message) => message.role !== 'system')
        .map((message) => ({ role: message.role, content: message.content })),
      temperature: options?.temperature ?? 0.1,
      max_tokens: maxTokens,
    });
    return Array.isArray(data.content)
      ? data.content.find((part: any) => part?.type === 'text')?.text ?? ''
      : '';
  }

  const body: Record<string, unknown> = {
    model: config.model,
    messages,
    temperature: options?.temperature ?? 0.1,
    max_tokens: maxTokens,
  };
  if (options?.jsonMode) body.response_format = { type: 'json_object' };
  const data = await providerFetch(config, body);
  return data.choices?.[0]?.message?.content ?? '';
}

export async function visionCompletion(
  config: AIConfig,
  imageBase64: string,
  prompt: string,
  imageMimeType = 'image/png',
) {
  if (!/^image\/(png|jpeg|webp|gif)$/.test(imageMimeType)) {
    throw new Error('Unsupported image type.');
  }

  if (config.provider === 'anthropic') {
    const data = await providerFetch(config, {
      model: config.model,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image', source: { type: 'base64', media_type: imageMimeType, data: imageBase64 } },
        ],
      }],
      temperature: 0.1,
      max_tokens: 2000,
    });
    return Array.isArray(data.content)
      ? data.content.find((part: any) => part?.type === 'text')?.text ?? ''
      : '';
  }

  const data = await providerFetch(config, {
    model: config.model,
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: `data:${imageMimeType};base64,${imageBase64}` } },
      ],
    }],
    temperature: 0.1,
    max_tokens: 2000,
    response_format: { type: 'json_object' },
  });
  return data.choices?.[0]?.message?.content ?? '';
}

export interface AITool {
  name: string;
  description: string;
  /** JSON Schema for the tool's input object. */
  parameters: Record<string, unknown>;
}

export type AIToolExecutor = (name: string, input: Record<string, unknown>) => Promise<unknown>;

const MAX_TOOL_RESULT_CHARS = 12_000;
/** Lookups run per model response, and per question in total. */
const MAX_TOOL_CALLS_PER_ROUND = 4;
const MAX_TOOL_CALLS_TOTAL = 10;

function toolResultText(result: unknown): string {
  const text = JSON.stringify(result ?? null);
  return text.length > MAX_TOOL_RESULT_CHARS
    ? `${text.slice(0, MAX_TOOL_RESULT_CHARS)}… (truncated)`
    : text;
}

async function runTool(execute: AIToolExecutor, tools: AITool[], name: string, rawInput: unknown): Promise<string> {
  if (!tools.some((tool) => tool.name === name)) return toolResultText({ error: `Unknown tool: ${name}` });
  const input = rawInput && typeof rawInput === 'object' && !Array.isArray(rawInput)
    ? rawInput as Record<string, unknown>
    : {};
  try {
    return toolResultText(await execute(name, input));
  } catch (error) {
    return toolResultText({ error: error instanceof Error ? error.message : 'Lookup failed' });
  }
}

/**
 * Chat with tool calling. The model may call the allow-listed `tools`; each
 * call runs through `execute` (the caller decides what a tool can read) and the
 * result goes back to the model, for at most `maxRounds` rounds. Returns the
 * final text answer.
 */
export async function toolCompletion(
  config: AIConfig,
  system: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  tools: AITool[],
  execute: AIToolExecutor,
  options?: { temperature?: number; maxTokens?: number; maxRounds?: number; timeBudgetMs?: number },
): Promise<string> {
  const maxTokens = Math.min(4096, Math.max(1, options?.maxTokens ?? 1500));
  const maxRounds = Math.min(8, Math.max(1, options?.maxRounds ?? 5));
  const temperature = options?.temperature ?? 0.1;
  // The whole exchange (all rounds) fits in this budget: each provider call
  // gets only the time that is left, and once less than a quarter remains the
  // model must answer without further lookups.
  const budget = Math.max(5_000, options?.timeBudgetMs ?? 50_000);
  const startedAt = Date.now();
  const remaining = () => budget - (Date.now() - startedAt);
  const callTimeout = () => Math.max(1_000, Math.min(REQUEST_TIMEOUT_MS, remaining()));
  const mustFinish = (round: number) => round >= maxRounds || remaining() < budget / 4;
  let callsMade = 0;
  // Run one requested lookup unless the per-round, per-question or time limit
  // is reached; the model is told why a lookup was skipped.
  const guardedRun = async (indexInRound: number, name: string, input: unknown): Promise<string> => {
    if (indexInRound >= MAX_TOOL_CALLS_PER_ROUND || callsMade >= MAX_TOOL_CALLS_TOTAL || remaining() < budget / 4) {
      return toolResultText({ error: 'Lookup skipped: limit reached. Answer with what you have.' });
    }
    callsMade += 1;
    return runTool(execute, tools, name, input);
  };

  if (config.provider === 'anthropic') {
    const convo: any[] = messages.map((m) => ({ role: m.role, content: m.content }));
    const anthropicTools = tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters }));
    for (let round = 0; round <= maxRounds; round++) {
      const lastRound = mustFinish(round);
      const data = await providerFetch(config, {
        model: config.model,
        system,
        messages: convo,
        temperature,
        max_tokens: maxTokens,
        ...(lastRound ? {} : { tools: anthropicTools }),
      }, callTimeout());
      const content: any[] = Array.isArray(data.content) ? data.content : [];
      const calls = content.filter((part) => part?.type === 'tool_use');
      if (calls.length === 0 || lastRound) {
        return content.filter((part) => part?.type === 'text').map((part) => part.text).join('\n').trim();
      }
      convo.push({ role: 'assistant', content });
      const results = [];
      for (const [i, call] of calls.entries()) {
        results.push({
          type: 'tool_result',
          tool_use_id: call.id,
          content: await guardedRun(i, String(call.name ?? ''), call.input),
        });
      }
      convo.push({ role: 'user', content: results });
    }
    return '';
  }

  const convo: any[] = [{ role: 'system', content: system }, ...messages];
  const openaiTools = tools.map((t) => ({
    type: 'function',
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));
  for (let round = 0; round <= maxRounds; round++) {
    const lastRound = mustFinish(round);
    const data = await providerFetch(config, {
      model: config.model,
      messages: convo,
      temperature,
      max_tokens: maxTokens,
      ...(lastRound ? {} : { tools: openaiTools }),
    }, callTimeout());
    const message = data.choices?.[0]?.message ?? {};
    const calls: any[] = Array.isArray(message.tool_calls) ? message.tool_calls : [];
    if (calls.length === 0 || lastRound) return String(message.content ?? '').trim();
    convo.push({ role: 'assistant', content: message.content ?? null, tool_calls: calls });
    for (const [i, call] of calls.entries()) {
      let input: unknown = {};
      try {
        input = JSON.parse(call.function?.arguments ?? '{}');
      } catch {
        input = {};
      }
      convo.push({
        role: 'tool',
        tool_call_id: call.id,
        content: await guardedRun(i, String(call.function?.name ?? ''), input),
      });
    }
  }
  return '';
}
