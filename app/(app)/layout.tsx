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
  const financeOnlyNavigation = new Set(['/bills', '/bills/check-run']);
  const isCompanyAdminOnly = me.is_company_admin && !me.is_staff && !me.is_platform_operator;
  const baseModules = isCompanyAdminOnly ? companyAdminModules : appModules;
  const modules = baseModules
    .filter((module) => adminAccess || module.href !== '/settings')
    .map((module) => (
      module.href === '/accounting'
        ? {
            ...module,
            children: module.children?.filter((child) => (
              (financeAccess || !financeOnlyNavigation.has(child.href))
              && (financeAccess || adminAccess || child.href !== '/accounting-periods')
            )),
          }
        : module
    ));
  const actionCenterProps = {
    isStaff: me.is_staff || me.is_platform_operator,
    isFinanceStaff: financeAccess,
    isAdmin: adminAccess,
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar portfolioName={displayName} logoUrl={logoUrl} brandColor={brandColor} userEmail={me.email ?? undefined} modules={modules} />
      <main className="h-screen min-w-0 flex-1 overflow-y-auto pt-12 lg:pt-0">
        {children}
      </main>
      <Suspense fallback={<TasksRail {...actionCenterProps} />}>
        <ActionCenterShell {...actionCenterProps} />
      </Suspense>
    </div>
  );
}
