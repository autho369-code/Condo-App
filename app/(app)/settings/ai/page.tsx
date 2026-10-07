import { createServiceClient } from '@/lib/supabase/server';
import { hasPortfolioAdminAccess, requirePortfolioAdmin, requireWorkspaceStaff } from '@/lib/auth/me';
import { encryptAICredential } from '@/lib/ai/credentials';
import { isSupportedAIProvider } from '@/lib/ai/service';
import { Button } from '@/components/ui/button';
import { Input, Label, Select } from '@/components/ui/input';
import { Alert, Breadcrumb, PageHeader, PageShell } from '@/components/ui/shell';
import { StatusChip } from '@/components/operations/status-chip';
import { Section } from '@/components/workspace/shell';
import { revalidatePath } from 'next/cache';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

const PROVIDERS = [
  { value: 'openai', label: 'OpenAI', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'] },
  { value: 'deepseek', label: 'DeepSeek', models: ['deepseek-chat', 'deepseek-reasoner'] },
  { value: 'anthropic', label: 'Anthropic', models: ['claude-sonnet-5-5', 'claude-opus-5-5', 'claude-haiku-4-5-20251001', 'claude-sonnet-4-20250514'] },
] as const;

async function saveAIProvider(formData: FormData) {
  'use server';
  const me = await requirePortfolioAdmin();
  const svc = createServiceClient() as any;

  const provider = String(formData.get('ai_provider') ?? '').trim();
  const model = String(formData.get('ai_model') ?? '').trim();
  const apiKey = String(formData.get('ai_api_key') ?? '').trim();
  const removeKey = formData.get('remove_ai_key') === 'on';

  if (!isSupportedAIProvider(provider)) {
    redirect('/settings/ai?error=' + encodeURIComponent('Choose a supported AI provider.'));
  }
  const allowedProvider = PROVIDERS.find((candidate) => candidate.value === provider);
  if (!allowedProvider || !(allowedProvider.models as readonly string[]).includes(model)) {
    redirect('/settings/ai?error=' + encodeURIComponent('Choose a supported model for this provider.'));
  }

  const patch: Record<string, unknown> = {
    ai_provider: provider,
    ai_model: model,
    ai_endpoint: null,
    ai_api_key: null,
  };
  if (removeKey) patch.ai_api_key_ciphertext = null;
  else if (apiKey) {
    try {
      patch.ai_api_key_ciphertext = encryptAICredential(apiKey);
    } catch (error) {
      redirect('/settings/ai?error=' + encodeURIComponent(
        error instanceof Error ? error.message : 'Could not encrypt the AI credential.',
      ));
    }
  }

  const { error } = await svc.from('portfolios').update(patch).eq('id', me.portfolio.id);
  if (error) {
    redirect('/settings/ai?error=' + encodeURIComponent('AI settings could not be saved.'));
  }

  revalidatePath('/settings/ai');
  redirect('/settings/ai?saved=1');
}

export default async function AISettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  // Any workspace member may open this page so links from AI features never
  // bounce; only company admins (and operators) see and save the form.
  const me = await requireWorkspaceStaff();
  const canConfigure = hasPortfolioAdminAccess(me);
  const svc = createServiceClient() as any;
  const params = await searchParams;

  const { data: portfolio } = me.portfolio?.id
    ? await svc
        .from('portfolios')
        .select('ai_provider, ai_model, ai_api_key_ciphertext')
        .eq('id', me.portfolio.id)
        .maybeSingle()
    : { data: null };

  const p = portfolio ?? {};
  const provider = p.ai_provider ?? 'openai';
  const currentProvider = PROVIDERS.find(pr => pr.value === provider) ?? PROVIDERS[0];
  const configured = Boolean(p.ai_api_key_ciphertext && p.ai_provider && p.ai_model);
  const providerLabel = PROVIDERS.find(pr => pr.value === p.ai_provider)?.label ?? p.ai_provider;

  const status = configured ? (
    <Alert tone="success" title="AI is on.">
      Using {providerLabel} ({p.ai_model}). The AI Assistant, letter drafting and document extraction are available.
    </Alert>
  ) : (
    <Alert tone="warning" title="AI is off.">
      {canConfigure
        ? 'Choose a provider and model and enter your API key below to turn on the AI Assistant and other AI features.'
        : 'Ask your company admin to add an AI provider key here to turn on the AI Assistant and other AI features.'}
    </Alert>
  );

  if (!canConfigure) {
    return (
      <PageShell className="max-w-3xl">
        <Breadcrumb items={[{ label: 'AI Assistant', href: '/assistant' }, { label: 'AI configuration' }]} />
        <PageHeader title="AI provider" description="AI features use your company's own AI provider account. Only company admins can change this setting." />
        {status}
      </PageShell>
    );
  }

  return (
    <PageShell className="max-w-3xl">
      <Breadcrumb items={[{ label: 'Settings', href: '/settings' }, { label: 'AI configuration' }]} />
      <PageHeader
        title="AI provider"
        description="Connect your company's own AI provider to power the AI Assistant, document extraction and drafting features. Your API key is stored encrypted and used only for your workspace's AI features."
      />

      <form action={saveAIProvider as any} className="space-y-6">
        {params.error ? (
          <Alert tone="danger" title="Could not save AI settings:">{params.error}</Alert>
        ) : params.saved === '1' ? (
          <Alert tone="success" title="AI settings saved securely." />
        ) : null}
        {status}
        <Section title="Provider" padded>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="ai_provider">AI provider</Label>
              <Select id="ai_provider" name="ai_provider" defaultValue={provider}>
                {PROVIDERS.map(pr => (
                  <option key={pr.value} value={pr.value}>{pr.label}</option>
                ))}
              </Select>
              <p className="mt-1 text-xs text-gray-400">Choose your AI provider. Each supports different models and pricing.</p>
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="ai_model">Model</Label>
              {/* Every provider's models, grouped, so switching provider and
                  model works in one save (the list used to show only the
                  saved provider's models). The action re-checks the pair. */}
              <Select id="ai_model" name="ai_model" defaultValue={p.ai_model ?? currentProvider.models[0]}>
                {PROVIDERS.map(pr => (
                  <optgroup key={pr.value} label={pr.label}>
                    {pr.models.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </optgroup>
                ))}
              </Select>
              <p className="mt-1 text-xs text-gray-400">Pick a model from the same provider selected above.</p>
            </div>
          </div>
        </Section>

        <Section title="API key" padded>
          <div>
            <Label htmlFor="ai_api_key">API key</Label>
            <Input
              id="ai_api_key"
              name="ai_api_key"
              type="password"
              autoComplete="new-password"
              placeholder={p.ai_api_key_ciphertext ? 'Configured — leave blank to keep it' : 'Enter provider API key'}
            />
            <p className="mt-1 text-xs text-gray-400">
              Encrypted with AES-256-GCM before database storage. The key is used only by server-side AI features, and provider URLs are fixed by the platform.
            </p>
            {p.ai_api_key_ciphertext && (
              <label className="mt-3 flex min-h-10 items-center gap-2 text-xs text-gray-600">
                <input type="checkbox" name="remove_ai_key" />
                Remove the configured API key
              </label>
            )}
          </div>
        </Section>

        <Section title="Available AI features" padded>
          <div className="space-y-3 text-sm text-gray-600">
            <FeatureRow title="AI Assistant" desc="Ask questions about your portfolio in plain language; answers use only your live, access-scoped data." status={configured ? 'ready' : 'needs-key'} />
            <FeatureRow title="Certificate and invoice extraction" desc="Auto-extract policy details from insurance certificates and line items from vendor invoices." status={configured ? 'ready' : 'needs-key'} />
            <FeatureRow title="Violation letter drafting" desc="Draft violation notices from the violation record and rule references." status={configured ? 'ready' : 'needs-key'} />
            <FeatureRow title="Communication drafting" desc="Draft owner emails, vendor instructions and board communications." status={configured ? 'ready' : 'needs-key'} />
            <FeatureRow title="Maintenance scheduling" desc="Auto-schedule recurring maintenance from the property calendar and vendor availability." status="coming" />
            <FeatureRow title="Financial analysis" desc="Spending trends, budget recommendations and delinquency predictions." status="coming" />
          </div>
        </Section>

        <div className="flex items-center gap-3">
          <Button type="submit" size="lg">Save AI settings</Button>
          <Link href="/settings" className="text-sm font-medium text-gray-500 transition-colors hover:text-gray-900">Back to settings</Link>
        </div>
      </form>
    </PageShell>
  );
}

function FeatureRow({ title, desc, status }: { title: string; desc: string; status: 'ready' | 'needs-key' | 'coming' }) {
  return (
    <div className="rounded-lg border border-gray-200 p-3">
      <div>
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-900">{title}</span>
          <StatusChip tone={status === 'ready' ? 'success' : status === 'needs-key' ? 'neutral' : 'warning'}>
            {status === 'ready' ? 'Ready' : status === 'needs-key' ? 'Needs key' : 'Soon'}
          </StatusChip>
        </div>
        <p className="mt-0.5 text-xs text-gray-500">{desc}</p>
      </div>
    </div>
  );
}
