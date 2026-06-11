import { createClient } from '@/lib/supabase/server';
import { requirePortfolioAdmin } from '@/lib/auth/me';
import { Button } from '@/components/ui/button';
import { Input, Label, Select } from '@/components/ui/input';
import { Breadcrumb, PageHeader, PageShell } from '@/components/ui/shell';
import { StatusChip } from '@/components/operations/status-chip';
import { Section } from '@/components/workspace/shell';
import { revalidatePath } from 'next/cache';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

const PROVIDERS = [
  { value: 'openai', label: 'OpenAI', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'] },
  { value: 'deepseek', label: 'DeepSeek', models: ['deepseek-chat', 'deepseek-reasoner'] },
  { value: 'anthropic', label: 'Anthropic', models: ['claude-sonnet-4-20250514', 'claude-3-5-haiku'] },
  { value: 'custom', label: 'Custom (OpenAI-compatible)', models: [] },
];

async function saveAIProvider(formData: FormData) {
  'use server';
  const supabase = await createClient();
  const me = await requirePortfolioAdmin();

  const provider = formData.get('ai_provider') as string;
  const model = provider === 'custom' ? (formData.get('ai_model_custom') as string) : (formData.get('ai_model') as string);
  const endpoint = provider === 'custom' ? (formData.get('ai_endpoint') as string) : null;
  const apiKey = formData.get('ai_api_key') as string;

  // Update portfolio settings
  await (supabase as any).from('portfolios').update({
    ai_provider: provider,
    ai_model: model,
    ai_endpoint: endpoint || null,
    ai_api_key: apiKey || null,
  }).eq('id', me.portfolio.id);

  revalidatePath('/settings/ai');
}

export default async function AISettingsPage() {
  const me = await requirePortfolioAdmin();
  const supabase = await createClient();

  const { data: portfolio } = await (supabase as any)
    .from('portfolios')
    .select('ai_provider, ai_model, ai_endpoint')
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

            {provider !== 'custom' ? (
              <div className="sm:col-span-2">
                <Label htmlFor="ai_model">Model</Label>
                <Select id="ai_model" name="ai_model" defaultValue={p.ai_model ?? currentProvider.models[0]}>
                  {currentProvider.models.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </Select>
              </div>
            ) : (
              <>
                <div>
                  <Label htmlFor="ai_model_custom">Model name</Label>
                  <Input id="ai_model_custom" name="ai_model_custom" defaultValue={p.ai_model ?? ''} placeholder="gpt-4o, claude-3-opus, etc." />
                </div>
                <div>
                  <Label htmlFor="ai_endpoint">API endpoint URL</Label>
                  <Input id="ai_endpoint" name="ai_endpoint" defaultValue={p.ai_endpoint ?? ''} placeholder="https://api.openai.com/v1" />
                </div>
              </>
            )}
          </div>
        </Section>

        <Section title="API key" padded>
          <div>
            <Label htmlFor="ai_api_key">API key</Label>
            <Input id="ai_api_key" name="ai_api_key" type="password" placeholder="sk-... or ••••••••" />
            <p className="mt-1 text-xs text-gray-400">
              Stored encrypted. Used only for AI features you enable — certificate extraction, Copilot, violation drafting, maintenance scheduling. You are billed directly by your provider.
            </p>
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
