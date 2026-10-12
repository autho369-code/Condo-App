import Link from 'next/link';
import { Building2 } from 'lucide-react';
import { buttonClass } from '@/components/ui/button';
import { EmptyState, PageHeader, Surface } from '@/components/ui/shell';

/**
 * Shown instead of a company page to a signed-in account with no company of
 * its own (a platform operator): the page has nothing to show or save. Keeps
 * the page's own title. Operators get a link to the Companies list; anyone
 * else is told to ask an administrator.
 */
export function NoCompanyNotice({ title, operator = false }: { title: string; operator?: boolean }) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} />
      <Surface padded={false}>
        <EmptyState
          icon={Building2}
          title="This page belongs to a management company"
          description={operator
            ? 'Your account is not linked to a company. Open a company from the Companies list to work in its settings.'
            : 'Your account is not linked to a company. Ask an administrator to add you to one.'}
          action={operator ? <Link href="/platform-operator/companies" className={buttonClass('secondary')}>Open Companies</Link> : undefined}
        />
      </Surface>
    </div>
  );
}
