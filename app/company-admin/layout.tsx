import CompanyAdminSidebar from '@/components/nav/company-admin-sidebar';
import { requireCompanyAdmin } from '@/lib/auth/me';

export default async function CompanyAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const me = await requireCompanyAdmin();
  return (
    <div className="flex min-h-screen bg-[#060B18]">
      <CompanyAdminSidebar
        companyName={me.portfolio?.company_name ?? me.portfolio?.name ?? 'Portier'}
        userEmail={me.email ?? undefined}
      />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1600px] px-6 py-6">{children}</div>
      </main>
    </div>
  );
}
