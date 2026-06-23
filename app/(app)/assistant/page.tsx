import { DataWorkspace } from '@/components/operations/data-workspace';
import { PortfolioAssistant } from '@/components/ai/portfolio-assistant';
import { requireStaff } from '@/lib/auth/me';

export const dynamic = 'force-dynamic';

export default async function AssistantPage() {
  await requireStaff();

  return (
    <DataWorkspace
      title="Portfolio Assistant"
      description="Ask natural-language questions about your portfolio. Answers are grounded only in your live, access-scoped data."
    >
      <div className="max-w-3xl">
        <PortfolioAssistant />
      </div>
    </DataWorkspace>
  );
}
