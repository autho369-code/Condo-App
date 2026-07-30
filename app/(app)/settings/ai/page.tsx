import { createServiceClient } from '@/lib/supabase/server';
import { requirePortfolioAdmin } from '@/lib/auth/me';
import { encryptAICredential } from '@/lib/ai/credentials';
import { isSupportedAIProvider } from '@/lib/ai/service';
import { Button } from '@/components/ui/button';
import { Input, Label, Select } from '@/components/ui/input';
import { Breadcrumb, PageHeader, PageShell } from '@/components/ui/shell';
import { StatusChip } from '@/components/operations/status-chip';
import { Section } from '@/components/workspace/shell';
import { revalidatePath } from 'next/cache';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

const PROVIDERS = [
  { value: 'openai', label: 'OpenAI', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'] },
  { value: 'deepseek', label: 'DeepSeek', models: ['deepseek-chat', 'deepseek-reasoner'] },
  { value: 'anthropic', label: 'Anthropic', models: ['claude-sonnet-4-20250514', 'claude-3-5-haiku'] },
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
  const me = await requirePortfolioAdmin();
  const svc = createServiceClient() as any;
  const params = await searchParams;

  const { data: portfolio } = await svc
    .from('portfolios')
    .select('ai_provider, ai_model, ai_api_key_ciphertext')
    .eq('id', me.portfolio.id)
    .single();

  const p = portfolio ?? {};
  const provider = p.ai_provider ?? 'openai';
  const currentProvider = PROVIDERS.find(pr => pr.value === provider) ?? PROVIDERS[0];

  return (
    <PageShell className="max-w-3xl">
      <Breadcrumb items={[{ label: 'Settings', href: '/settings' }, { label: 'AI configuration' }]} />
      <PageHeader
        title="AI provider"
        description="Connect your own AI provider to power automated certificate extraction, violation drafting, maintenance scheduling, and Copilot features. You bring the API key — we provide the infrastructure."
      />

      <form action={saveAIProvider as any} className="space-y-6">
        {params.saved === '1' && (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            AI settings saved securely.
          </p>
        )}
        {params.error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
            {params.error}
          </p>
        )}
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
              <Select id="ai_model" name="ai_model" defaultValue={p.ai_model ?? currentProvider.models[0]}>
                {currentProvider.models.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </Select>
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
              Encrypted with AES-256-GCM before database storage. The key is used only by server-side AI features, and provider URLs are fixed by Portier369.
            </p>
            {p.ai_api_key_ciphertext && (
              <label className="mt-3 flex items-center gap-2 text-xs text-gray-600">
                <input type="checkbox" name="remove_ai_key" />
                Remove the configured API key
              </label>
            )}
          </div>
        </Section>

        <Section title="Available AI features" padded>
          <div className="space-y-3 text-sm text-gray-600">
            <FeatureRow icon="📄" title="Certificate extraction" desc="Auto-extract policy number, coverage, dates from uploaded HO6 certificates." status="ready" />
            <FeatureRow icon="⚠️" title="Violation drafting" desc="AI generates violation notices from photo evidence and rule references." status="coming" />
            <FeatureRow icon="🔧" title="Maintenance scheduling" desc="Auto-schedule recurring maintenance from property calendar and vendor availability." status="coming" />
            <FeatureRow icon="📧" title="Communication Copilot" desc="Draft owner emails, vendor instructions, and board communications." status="coming" />
            <FeatureRow icon="📊" title="Financial analysis" desc="Spending trend analysis, budget recommendations, delinquency predictions." status="coming" />
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

function FeatureRow({ icon, title, desc, status }: { icon: string; title: string; desc: string; status: 'ready' | 'coming' }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-gray-200 p-3">
      <span className="text-xl">{icon}</span>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-900">{title}</span>
          <StatusChip tone={status === 'ready' ? 'success' : 'warning'}>
            {status === 'ready' ? 'Ready' : 'Soon'}
          </StatusChip>
        </div>
        <p className="mt-0.5 text-xs text-gray-500">{desc}</p>
      </div>
    </div>
  );
}
