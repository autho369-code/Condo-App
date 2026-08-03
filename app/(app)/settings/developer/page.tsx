import Link from 'next/link';

import { StatusChip, type Tone } from '@/components/operations/status-chip';
import { Button } from '@/components/ui/button';
import { Alert, Breadcrumb, PageHeader, PageShell, SectionTitle, Surface } from '@/components/ui/shell';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { DEVELOPER_API_ENDPOINTS } from '@/lib/api/catalog';
import { requirePortfolioAdmin } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { date } from '@/lib/utils';

import {
  revokeDeveloperApiKey,
  setDeveloperWebhookActive,
} from './actions';
import { CreateApiKeyForm } from './create-api-key-form';
import { CreateWebhookForm } from './create-webhook-form';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<{
  error?: string;
  key_revoked?: string;
  webhook_updated?: string;
}>;

function deliveryTone(status: string): Tone {
  if (status === 'succeeded') return 'success';
  if (status === 'pending' || status === 'retrying') return 'warning';
  if (status === 'abandoned' || status === 'failed') return 'danger';
  return 'neutral';
}

function endpointName(delivery: any) {
  const endpoint = Array.isArray(delivery.webhook_endpoints)
    ? delivery.webhook_endpoints[0]
    : delivery.webhook_endpoints;
  return endpoint?.name ?? 'Deleted endpoint';
}

export default async function DeveloperHubPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const me = await requirePortfolioAdmin();
  const portfolioId = me.portfolio?.id;
  if (!portfolioId) throw new Error('A portfolio is required to open the Developer Hub.');

  const supabase = await createClient();
  const [keysResult, endpointsResult, deliveriesResult, apiEntitlement, webhookEntitlement] = await Promise.all([
    (supabase as any)
      .from('api_keys')
      .select('id, name, prefix, scopes, last_used_at, use_count, expires_at, revoked_at, created_at')
      .eq('portfolio_id', portfolioId)
      .order('created_at', { ascending: false }),
    (supabase as any)
      .from('webhook_endpoints')
      .select('id, name, url, events, active, failure_count, disabled_until, last_success_at, last_failure_at, last_failure_message, created_at')
      .eq('portfolio_id', portfolioId)
      .order('created_at', { ascending: false }),
    (supabase as any)
      .from('webhook_deliveries')
      .select('id, event_type, status, attempts, response_code, error_message, created_at, webhook_endpoints!inner(name, portfolio_id)')
      .eq('webhook_endpoints.portfolio_id', portfolioId)
      .order('created_at', { ascending: false })
      .limit(25),
    (supabase as any).rpc('has_entitlement', { p_portfolio_id: portfolioId, p_feature_key: 'api_keys' }),
    (supabase as any).rpc('has_entitlement', { p_portfolio_id: portfolioId, p_feature_key: 'webhooks' }),
  ]);

  const keys = keysResult.data ?? [];
  const endpoints = endpointsResult.data ?? [];
  const deliveries = deliveriesResult.data ?? [];
  const apiEnabled = apiEntitlement.data === true;
  const webhooksEnabled = webhookEntitlement.data === true;
  const webhookDeliveryReady = process.env.WEBHOOK_DELIVERY_ENABLED === 'true';
  const readError = keysResult.error ?? endpointsResult.error ?? deliveriesResult.error;

  return (
    <PageShell>
      <Breadcrumb items={[{ label: 'Settings', href: '/settings' }, { label: 'Developer Hub' }]} />
      <PageHeader
        eyebrow="Integrations"
        title="Developer Hub"
        description="Secure, portfolio-scoped data access and event delivery for accounting, operations, and business-intelligence integrations."
        actions={(
          <Link
            href="#api-reference"
            className="inline-flex h-10 items-center justify-center rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-gray-800 shadow-sm transition-colors hover:bg-gray-50"
          >
            API reference
          </Link>
        )}
      />

      <div className="space-y-6">
        {sp.error && <Alert tone="danger" title="Developer setting was not updated.">{sp.error}</Alert>}
        {sp.key_revoked && <Alert tone="success" title="API key revoked.">Requests using that key are rejected immediately.</Alert>}
        {sp.webhook_updated && <Alert tone="success" title="Webhook updated.">The endpoint state was saved.</Alert>}
        {readError && <Alert tone="danger" title="Some integration data could not be loaded.">{readError.message}</Alert>}
        {!webhookDeliveryReady && (
          <Alert tone="info" title="Outbound webhook delivery is provider-gated.">
            Endpoint creation and re-enabling remain locked until an SSRF-safe delivery worker is installed and WEBHOOK_DELIVERY_ENABLED is explicitly set.
          </Alert>
        )}
        {(!apiEnabled || !webhooksEnabled) && (
          <Alert tone="warning" title="Plan entitlement required.">
            {!apiEnabled && !webhooksEnabled
              ? 'API keys and webhooks are not enabled for this portfolio.'
              : `${apiEnabled ? 'Webhooks are' : 'API keys are'} not enabled for this portfolio.`}
          </Alert>
        )}

        <div className="grid gap-6 xl:grid-cols-2">
          <Surface>
            <SectionTitle
              title="Create API key"
              description="Choose only the resources this integration needs. The raw key is displayed once."
            />
            <CreateApiKeyForm enabled={apiEnabled} />
          </Surface>
          <Surface>
            <SectionTitle
              title="Create webhook"
              description="Subscribe an HTTPS endpoint to business events and verify every signed payload."
            />
            <CreateWebhookForm enabled={webhooksEnabled && webhookDeliveryReady} />
          </Surface>
        </div>

        <section>
          <SectionTitle
            title="API keys"
            description="Keys are SHA-256 hashed at rest. Only the identifying prefix remains visible."
          />
          <Table>
            <THead><tr><TH>Name</TH><TH>Scopes</TH><TH>Usage</TH><TH>Expiration</TH><TH>Status</TH><TH className="text-right">Action</TH></tr></THead>
            <tbody>
              {keys.length === 0 ? (
                <TR><TD colSpan={6} className="py-8 text-center text-gray-500">No API keys have been created.</TD></TR>
              ) : keys.map((key: any) => {
                const expired = Boolean(key.expires_at && new Date(key.expires_at) <= new Date());
                const active = !key.revoked_at && !expired;
                return (
                  <TR key={key.id}>
                    <TD><span className="block font-medium text-gray-950">{key.name}</span><code className="text-xs text-gray-500">{key.prefix}...</code></TD>
                    <TD><div className="flex max-w-sm flex-wrap gap-1">{(key.scopes ?? []).map((scope: string) => <StatusChip key={scope}>{scope}</StatusChip>)}</div></TD>
                    <TD>{Number(key.use_count ?? 0).toLocaleString()} calls<span className="block text-xs text-gray-500">Last used {key.last_used_at ? date(key.last_used_at) : 'never'}</span></TD>
                    <TD>{key.expires_at ? date(key.expires_at) : 'No expiration'}</TD>
                    <TD><StatusChip tone={active ? 'success' : 'danger'}>{key.revoked_at ? 'revoked' : expired ? 'expired' : 'active'}</StatusChip></TD>
                    <TD className="text-right">
                      {active ? (
                        <form action={revokeDeveloperApiKey.bind(null, key.id)}>
                          <Button type="submit" size="sm" variant="danger">Revoke</Button>
                        </form>
                      ) : <span className="text-xs text-gray-400">Unavailable</span>}
                    </TD>
                  </TR>
                );
              })}
            </tbody>
          </Table>
        </section>

        <section>
          <SectionTitle
            title="Webhook endpoints"
            description="Endpoints retry failed deliveries and automatically pause after repeated failures."
          />
          <Table>
            <THead><tr><TH>Name & URL</TH><TH>Events</TH><TH>Health</TH><TH>Last success</TH><TH className="text-right">Action</TH></tr></THead>
            <tbody>
              {endpoints.length === 0 ? (
                <TR><TD colSpan={5} className="py-8 text-center text-gray-500">No webhook endpoints have been created.</TD></TR>
              ) : endpoints.map((endpoint: any) => {
                const enabled = endpoint.active && (!endpoint.disabled_until || new Date(endpoint.disabled_until) <= new Date());
                return (
                  <TR key={endpoint.id}>
                    <TD><span className="block font-medium text-gray-950">{endpoint.name}</span><span className="block max-w-md truncate text-xs text-gray-500" title={endpoint.url}>{endpoint.url}</span></TD>
                    <TD>{(endpoint.events ?? []).length} events</TD>
                    <TD><StatusChip tone={enabled ? 'success' : endpoint.failure_count ? 'danger' : 'neutral'}>{enabled ? 'active' : endpoint.disabled_until ? 'paused' : 'inactive'}</StatusChip><span className="ml-2 text-xs text-gray-500">{endpoint.failure_count ?? 0} failures</span></TD>
                    <TD>{endpoint.last_success_at ? date(endpoint.last_success_at) : 'Never'}</TD>
                    <TD className="text-right">
                      <form action={setDeveloperWebhookActive.bind(null, endpoint.id, !enabled)}>
                        <Button type="submit" size="sm" variant="secondary">{enabled ? 'Disable' : 'Enable'}</Button>
                      </form>
                    </TD>
                  </TR>
                );
              })}
            </tbody>
          </Table>
        </section>

        <div id="api-reference" className="scroll-mt-6">
          <Surface>
          <SectionTitle
            title="REST API reference"
            description="Version 2026-08-01. Authenticate with Authorization: Bearer, use page and limit for pagination, and q for search."
          />
          <div className="mb-5 overflow-x-auto rounded-xl bg-gray-950 p-4 text-gray-100">
            <code className="whitespace-pre font-mono text-xs">curl &quot;https://portier369.com/api/v1/associations?limit=50&quot; -H &quot;Authorization: Bearer YOUR_API_KEY&quot;</code>
          </div>
          <Table>
            <THead><tr><TH>Method</TH><TH>Endpoint</TH><TH>Required scope</TH></tr></THead>
            <tbody>
              {DEVELOPER_API_ENDPOINTS.map((endpoint) => (
                <TR key={endpoint.path}>
                  <TD><StatusChip tone="info">{endpoint.method}</StatusChip></TD>
                  <TD><code className="font-mono text-xs text-gray-950">{endpoint.path}</code></TD>
                  <TD><code className="font-mono text-xs">{endpoint.scope}</code></TD>
                </TR>
              ))}
            </tbody>
          </Table>
          </Surface>
        </div>

        <section>
          <SectionTitle
            title="Recent webhook deliveries"
            description="Payloads and signatures remain server-side; this view exposes delivery health only."
          />
          <Table>
            <THead><tr><TH>Endpoint</TH><TH>Event</TH><TH>Status</TH><TH>Attempts</TH><TH>Response</TH><TH>Created</TH></tr></THead>
            <tbody>
              {deliveries.length === 0 ? (
                <TR><TD colSpan={6} className="py-8 text-center text-gray-500">No webhook deliveries yet.</TD></TR>
              ) : deliveries.map((delivery: any) => (
                <TR key={delivery.id}>
                  <TD className="font-medium text-gray-950">{endpointName(delivery)}</TD>
                  <TD><code className="font-mono text-xs">{delivery.event_type}</code></TD>
                  <TD><StatusChip tone={deliveryTone(delivery.status)}>{delivery.status}</StatusChip></TD>
                  <TD>{delivery.attempts}</TD>
                  <TD>{delivery.response_code ?? delivery.error_message ?? '—'}</TD>
                  <TD>{date(delivery.created_at)}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </section>
      </div>
    </PageShell>
  );
}
