import Sidebar from '@/components/nav/sidebar';
import { requireTenant } from '@/lib/auth/me';
import { residentModules } from '@/lib/navigation/role-modules';

export default async function ResidentLayout({ children }: { children: React.ReactNode }) {
  const me = await requireTenant();
  return (
    <div className="flex min-h-screen">
      <Sidebar
        portfolioName={me.portfolio?.company_name ?? me.portfolio?.name ?? 'Portier369'}
        logoUrl={me.portfolio?.logo_url ?? null}
        brandColor={me.portfolio?.brand_color ?? undefined}
        userEmail={me.email ?? undefined}
        modules={residentModules}
        subtitle="Resident portal"
      />
      <main className="h-screen min-w-0 flex-1 overflow-y-auto bg-[#f6f7f9] pt-12 lg:pt-0">
        <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6 lg:py-8">{children}</div>
      </main>
    </div>
  );
}
