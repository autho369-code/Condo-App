import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import Sidebar from '@/components/nav/sidebar';
import TasksRail from '@/components/workspace/tasks-rail';
import ActionCenterShell from '@/components/workspace/action-center-shell';
import { hasPortfolioAdminAccess, requireAuth, roleHome } from '@/lib/auth/me';
import { appModules } from '@/lib/navigation/modules';
import { companyAdminModules } from '@/lib/navigation/role-modules';
import { tenantFromHeaders } from '@/lib/tenant/resolve';
import { CommandPalette, type PaletteLink } from '@/components/search/command-palette';
import { workspaceMetadata } from '@/lib/tenant/metadata';

export const generateMetadata = workspaceMetadata;

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Staff workspace. Company admins are admitted at the layout so their nav
  // links into shared finance surfaces (/command-center, /budget-vs-actuals)
  // work; owners/board/vendors are redirected to their own surface. Each page
  // still enforces its own narrower guard (defense-in-depth on top of RLS).
  const me = await requireAuth();
  if (!me.is_staff && !me.is_company_admin && !me.is_platform_operator) redirect(roleHome(me));
  const h = await headers();
  const tenant = tenantFromHeaders(h);
  const displayName = tenant?.companyName ?? me.portfolio?.company_name ?? me.portfolio?.name ?? 'Portier369';
  const logoUrl = tenant?.logoUrl ?? me.portfolio?.logo_url ?? null;
  const brandColor = tenant?.brandColor ?? me.portfolio?.brand_color ?? '#10B981';
  // /settings is company-admin/operator only (requirePortfolioAdmin), so plain
  // managers must not see the link — it would silently bounce to /dashboard.
  const adminAccess = hasPortfolioAdminAccess(me);
  const financeAccess = me.is_finance_staff || me.is_platform_operator;
  const isCompanyAdminOnly = me.is_company_admin && !me.is_staff && !me.is_platform_operator;
  // Pages with a guard narrower than "staff". Hiding them keeps people from
  // clicking a link that silently bounces them to their home page.
  const NAV_ACCESS: Record<string, 'finance' | 'finance_or_admin' | 'admin'> = {
    '/bills': 'finance', '/bills/check-run': 'finance', '/bills/recurring': 'finance',
    '/receipts': 'finance', '/receipts/other': 'finance',
    '/accounting/loans': 'finance', '/accounting/management-fees': 'finance',
    '/bank-accounts/lockbox': 'finance', '/purchase-orders': 'finance',
    '/accounting-periods': 'finance_or_admin', '/accounting/year-end': 'finance_or_admin',
    '/vendors/ach': 'finance_or_admin',
    '/settings': 'admin', '/settings/ai': 'admin', '/settings/branding': 'admin', '/settings/developer': 'admin',
  };
  const canSee = (href: string) => {
    const access = NAV_ACCESS[href.split('?')[0]];
    if (!access) return true;
    if (access === 'finance') return financeAccess;
    if (access === 'finance_or_admin') return financeAccess || adminAccess;
    return adminAccess;
  };
  const baseModules = isCompanyAdminOnly ? companyAdminModules : appModules;
  const modules = baseModules
    .filter((module) => canSee(module.href))
    .map((module) => (module.children ? { ...module, children: module.children.filter((child) => canSee(child.href)) } : module));
  // Command palette (Ctrl/Cmd+K): every visible nav destination plus common
  // create actions. Record search is served by /api/search under RLS.
  const pages: PaletteLink[] = modules.flatMap((module) => [
    { label: module.label, href: module.href, section: module.group },
    ...(module.children ?? [])
      .filter((child) => child.href !== module.href)
      .map((child) => ({ label: child.label, href: child.href, section: module.label })),
  ]);
  const allPaletteActions: PaletteLink[] = [
    { label: 'New work order', href: '/work-orders/new', section: 'Maintenance' },
    { label: 'New violation', href: '/violations/new', section: 'Compliance' },
    { label: 'Post owner charge', href: '/charges/new', section: 'Receivables' },
    ...(financeAccess ? [{ label: 'New bill', href: '/bills/new', section: 'Payables' }] : []),
    ...(financeAccess ? [{ label: 'Homeowner receipt', href: '/receipts/new', section: 'Receivables' }] : []),
    { label: 'New homeowner', href: '/owners/new', section: 'People' },
    { label: 'New vendor', href: '/vendors/new', section: 'People' },
    { label: 'Schedule meeting', href: '/meetings/new', section: 'Governance' },
    { label: 'New architectural review', href: '/architectural-reviews/new', section: 'Compliance' },
    { label: 'New letter', href: '/letters/new', section: 'Communication' },
    ...(financeAccess ? [{ label: 'New journal entry', href: '/journal-entries/new', section: 'Accounting' }] : []),
  ];
  // Company admins (not managers) can only open these create pages; the rest
  // are requireStaff and would bounce them to /company-admin/overview.
  const COMPANY_ADMIN_ACTIONS = new Set(['/meetings/new', '/letters/new']);
  const paletteActions = isCompanyAdminOnly
    ? allPaletteActions.filter((action) => COMPANY_ADMIN_ACTIONS.has(action.href))
    : allPaletteActions;
  const actionCenterProps = {
    isStaff: me.is_staff || me.is_platform_operator,
    isFinanceStaff: financeAccess,
    isAdmin: adminAccess,
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar portfolioName={displayName} logoUrl={logoUrl} brandColor={brandColor} userEmail={me.email ?? undefined} modules={modules} showRecordSearch />
      <main className="h-screen min-w-0 flex-1 overflow-y-auto pt-12 lg:pt-0">
        {children}
      </main>
      <CommandPalette pages={pages} actions={paletteActions} />
      <Suspense fallback={<TasksRail {...actionCenterProps} />}>
        <ActionCenterShell {...actionCenterProps} />
      </Suspense>
    </div>
  );
}
