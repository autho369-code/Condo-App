import Link from 'next/link';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { PortfolioAssistant } from '@/components/ai/portfolio-assistant';
import { Alert } from '@/components/ui/shell';
import { hasPortfolioAdminAccess, requireWorkspaceStaff } from '@/lib/auth/me';
import { createServiceClient } from '@/lib/supabase/server';
import { isAIConfigured } from '@/lib/ai/service';

export const dynamic = 'force-dynamic';

export default async function AssistantPage() {
  const me = await requireWorkspaceStaff(); // company admins land here from their portal
  const canConfigure = hasPortfolioAdminAccess(me);

  // Same validation and decryption as the AI routes; only the yes/no
  // answer reaches the page, never the key.
  const configured = await isAIConfigured(me.portfolio?.id, createServiceClient());

  const setupHint = canConfigure ? (
    <>
      AI isn&apos;t set up yet.{' '}
      <Link href="/settings/ai" className="font-medium text-blue-600 underline-offset-4 hover:underline">
        Add your AI provider key in AI settings
      </Link>
      .
    </>
  ) : (
    <>AI isn&apos;t set up yet. Ask your company admin to add an AI provider key in AI settings.</>
  );

  return (
    <DataWorkspace
      title="Portfolio Assistant"
      description="Ask natural-language questions about your portfolio. Answers are grounded only in your live, access-scoped data."
    >
      <div className="max-w-3xl space-y-4">
        {!configured && (
          <Alert tone="warning" title="AI is off.">{setupHint}</Alert>
        )}
        {/* When AI is off the page Alert already explains it; don't repeat it in the chat. */}
        <PortfolioAssistant configureHint={configured ? setupHint : 'See the note above.'} />
      </div>
    </DataWorkspace>
  );
}
