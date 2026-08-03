'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { DEVELOPER_API_SCOPES, WEBHOOK_EVENTS } from '@/lib/api/catalog';
import { requirePortfolioAdmin } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { validatedWebhookUrl } from '@/lib/webhooks/url';

export type SecretActionState = {
  error: string | null;
  secret: string | null;
  name: string | null;
  prefix?: string | null;
};

const allowedScopes = new Set<string>(DEVELOPER_API_SCOPES.map((scope) => scope.value));
const allowedEvents = new Set<string>(WEBHOOK_EVENTS);
const value = (formData: FormData, key: string) => String(formData.get(key) ?? '').trim();

export async function createDeveloperApiKey(
  _previous: SecretActionState,
  formData: FormData,
): Promise<SecretActionState> {
  const me = await requirePortfolioAdmin();
  const portfolioId = me.portfolio?.id;
  const name = value(formData, 'name');
  const scopes = formData.getAll('scopes').map(String).filter((scope) => allowedScopes.has(scope));
  const expiry = value(formData, 'expires_days');
  const expiresDays = expiry ? Number(expiry) : null;

  if (!portfolioId) return { error: 'A portfolio is required.', secret: null, name };
  if (!name || name.length > 200) return { error: 'Key name must be between 1 and 200 characters.', secret: null, name };
  if (scopes.length === 0) return { error: 'Select at least one explicit API scope.', secret: null, name };
  if (expiresDays !== null && ![30, 90, 365].includes(expiresDays)) return { error: 'Choose a supported expiration period.', secret: null, name };

  const supabase = await createClient();
  const { data, error } = await (supabase as any).rpc('create_api_key', {
    p_portfolio_id: portfolioId,
    p_name: name,
    p_scopes: scopes,
    p_expires_days: expiresDays,
  });
  if (error || !data?.api_key) return { error: error?.message ?? 'API key could not be created.', secret: null, name };

  revalidatePath('/settings/developer');
  return { error: null, secret: String(data.api_key), name, prefix: String(data.prefix ?? '') };
}

export async function createDeveloperWebhook(
  _previous: SecretActionState,
  formData: FormData,
): Promise<SecretActionState> {
  if (process.env.WEBHOOK_DELIVERY_ENABLED !== 'true') {
    return { error: 'Outbound webhook delivery is not enabled in this environment.', secret: null, name: null };
  }
  const me = await requirePortfolioAdmin();
  const portfolioId = me.portfolio?.id;
  const name = value(formData, 'name');
  const endpointUrl = value(formData, 'url');
  const events = formData.getAll('events').map(String).filter((event) => allowedEvents.has(event));

  if (!portfolioId) return { error: 'A portfolio is required.', secret: null, name };
  if (!name || name.length > 200) return { error: 'Endpoint name must be between 1 and 200 characters.', secret: null, name };
  if (events.length === 0) return { error: 'Select at least one business event.', secret: null, name };
  let validatedUrl: string;
  try {
    validatedUrl = await validatedWebhookUrl(endpointUrl);
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Enter a valid public HTTPS endpoint URL.', secret: null, name };
  }

  const supabase = await createClient();
  const { data, error } = await (supabase as any)
    .from('webhook_endpoints')
    .insert({
      portfolio_id: portfolioId,
      name,
      url: validatedUrl,
      events,
      created_by: me.auth_user_id,
    })
    .select('id, signing_secret')
    .single();
  if (error || !data?.signing_secret) return { error: error?.message ?? 'Webhook endpoint could not be created.', secret: null, name };

  revalidatePath('/settings/developer');
  return { error: null, secret: String(data.signing_secret), name };
}

export async function revokeDeveloperApiKey(keyId: string) {
  const me = await requirePortfolioAdmin();
  const portfolioId = me.portfolio?.id;
  if (!portfolioId) redirect('/settings/developer?error=' + encodeURIComponent('A portfolio is required.'));
  const supabase = await createClient();
  const { data, error } = await (supabase as any)
    .from('api_keys')
    .update({ revoked_at: new Date().toISOString(), revoked_by: me.auth_user_id })
    .eq('id', keyId)
    .eq('portfolio_id', portfolioId)
    .is('revoked_at', null)
    .select('id')
    .maybeSingle();
  if (error || !data) redirect('/settings/developer?error=' + encodeURIComponent(error?.message ?? 'API key was not found.'));
  revalidatePath('/settings/developer');
  redirect('/settings/developer?key_revoked=1');
}

export async function setDeveloperWebhookActive(endpointId: string, active: boolean) {
  if (active && process.env.WEBHOOK_DELIVERY_ENABLED !== 'true') {
    redirect('/settings/developer?error=' + encodeURIComponent('Outbound webhook delivery is not enabled in this environment.'));
  }
  const me = await requirePortfolioAdmin();
  const portfolioId = me.portfolio?.id;
  if (!portfolioId) redirect('/settings/developer?error=' + encodeURIComponent('A portfolio is required.'));
  const supabase = await createClient();
  const { data, error } = await (supabase as any)
    .from('webhook_endpoints')
    .update(active ? { active: true, disabled_until: null } : { active: false })
    .eq('id', endpointId)
    .eq('portfolio_id', portfolioId)
    .select('id')
    .maybeSingle();
  if (error || !data) redirect('/settings/developer?error=' + encodeURIComponent(error?.message ?? 'Webhook endpoint was not found.'));
  revalidatePath('/settings/developer');
  redirect('/settings/developer?webhook_updated=1');
}
