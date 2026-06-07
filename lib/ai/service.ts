/**
 * AI Service — multi-provider abstraction layer.
 * 
 * Each portfolio configures their own provider + API key.
 * Use `getAIClient(portfolioId)` to get a configured client for any AI task.
 */

const PROVIDER_ENDPOINTS: Record<string, string> = {
  openai: 'https://api.openai.com/v1',
  deepseek: 'https://api.deepseek.com/v1',
  anthropic: 'https://api.anthropic.com/v1',
};

export type AIProvider = 'openai' | 'deepseek' | 'anthropic' | 'custom';

export interface AIConfig {
  provider: AIProvider;
  model: string;
  apiKey: string;
  endpoint?: string;
}

/**
 * Build the config from portfolio settings + Vault secret.
 */
export async function getAIConfig(portfolioId: string): Promise<AIConfig | null> {
  const { createClient } = await import('@/lib/supabase/server');
  const supabase = await createClient();
  const db = supabase as any;

  const { data: portfolio } = await db
    .from('portfolios')
    .select('ai_provider, ai_model, ai_endpoint, ai_api_key')
    .eq('id', portfolioId)
    .single();

  if (!portfolio?.ai_provider || !portfolio?.ai_api_key) return null;

  return {
    provider: portfolio.ai_provider,
    model: portfolio.ai_model || 'gpt-4o',
    apiKey: portfolio.ai_api_key,
    endpoint: portfolio.ai_endpoint || undefined,
  };
}

/**
 * Call any OpenAI-compatible chat completion API.
 */
export async function chatCompletion(
  config: AIConfig,
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  options?: { temperature?: number; maxTokens?: number; jsonMode?: boolean }
) {
  const endpoint = config.endpoint || PROVIDER_ENDPOINTS[config.provider] || 'https://api.openai.com/v1';
  const url = `${endpoint}/chat/completions`;

  const body: any = {
    model: config.model,
    messages,
    temperature: options?.temperature ?? 0.1,
    max_tokens: options?.maxTokens ?? 2000,
  };

  if (options?.jsonMode) {
    body.response_format = { type: 'json_object' };
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`AI API error (${response.status}): ${err.slice(0, 200)}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? '';
}

/**
 * Vision — call an AI model with an image for extraction/analysis.
 */
export async function visionCompletion(
  config: AIConfig,
  imageBase64: string,
  prompt: string,
) {
  const endpoint = config.endpoint || PROVIDER_ENDPOINTS[config.provider] || 'https://api.openai.com/v1';
  const url = `${endpoint}/chat/completions`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: `data:image/png;base64,${imageBase64}` } },
        ],
      }],
      temperature: 0.1,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Vision API error (${response.status}): ${err.slice(0, 200)}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? '';
}
