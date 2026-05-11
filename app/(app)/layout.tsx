import Sidebar from '@/components/nav/sidebar';
import { requireAuth } from '@/lib/auth/me';
import { ManagerCommandPalette } from '@/components/command/manager-command-palette';
import { Copilot } from '@/components/copilot/copilot';
import { PaymentNotifier } from '@/components/realtime/payment-notifier';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await requireAuth();
  return (
    <div className="flex min-h-screen flex-col bg-cream-50 md:flex-row">
      <Sidebar
        portfolioName={me.portfolio?.company_name ?? me.portfolio?.name ?? 'Portier'}
        userEmail={me.email ?? undefined}
      />
      <main className="flex-1 overflow-hidden">{children}</main>
      <ManagerCommandPalette />
      <Copilot />
      <PaymentNotifier enabled={Boolean(me.is_finance_staff || me.is_full_access_staff)} />
    </div>
  );
}
