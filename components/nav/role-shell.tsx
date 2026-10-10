import Sidebar from '@/components/nav/sidebar';
import type { AppModule } from '@/lib/navigation/modules';
import { brandStyle } from '@/lib/ui/brand';

/**
 * The one page frame every role uses: the shared sidebar (each role keeps its
 * own menu), a thin line in the company's color across the top, and the same
 * content container. Guards, menus and context stay in each role's layout.
 */
export default function RoleShell({
  children,
  portfolioName,
  logoUrl,
  brandColor,
  userEmail,
  modules,
  subtitle,
  width = 'wide',
}: {
  children: React.ReactNode;
  portfolioName: string;
  logoUrl?: string | null;
  brandColor?: string | null;
  userEmail?: string;
  modules: AppModule[];
  subtitle: string;
  /** Staff work areas use the full width; portals a reading width. */
  width?: 'wide' | 'portal';
}) {
  return (
    <div className="flex min-h-screen" style={brandStyle(brandColor)}>
      <Sidebar
        portfolioName={portfolioName}
        logoUrl={logoUrl ?? null}
        brandColor={brandColor ?? undefined}
        userEmail={userEmail}
        modules={modules}
        subtitle={subtitle}
      />
      <main className="h-screen min-w-0 flex-1 overflow-y-auto bg-canvas pt-14 lg:pt-0">
        <div aria-hidden="true" className="h-[3px] bg-accent print:hidden" />
        <div className={`mx-auto px-4 py-6 sm:px-6 lg:px-8 lg:py-8 ${width === 'wide' ? 'max-w-[1400px]' : 'max-w-[1200px]'}`}>
          {children}
        </div>
      </main>
    </div>
  );
}
