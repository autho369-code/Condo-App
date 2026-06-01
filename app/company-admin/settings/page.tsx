import { createClient } from '@/lib/supabase/server';
import { requireCompanyAdmin } from '@/lib/auth/me';
import { Shield, Settings } from 'lucide-react';
import SettingsForm from './settings-form';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

export default async function CompanySettingsPage() {
  const me = await requireCompanyAdmin();
  const supabase = await createClient();
  const db = supabase as any;
  const portfolioId = me.portfolio?.id;

  if (!portfolioId) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Shield className="h-12 w-12 text-slate-400 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-white">No company assigned</h2>
          <p className="text-sm text-slate-400 mt-1">Contact the platform operator to set up your company.</p>
        </div>
      </div>
    );
  }

  // Fetch portfolio data
  const { data: portfolio } = await supabase
    .from('portfolios')
    .select('id, company_name, address_street, address_city, address_state, address_zip, phone_number')
    .eq('id', portfolioId)
    .maybeSingle();

  // Fetch company settings
  const { data: settings } = await db
    .from('company_settings')
    .select('*')
    .eq('portfolio_id', portfolioId)
    .maybeSingle();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400">Company Admin</p>
        <h1 className="mt-1 text-xl font-bold text-white">Company Settings</h1>
        <p className="mt-1 text-sm text-slate-400">
          Manage your company profile, notification preferences, and default configurations
        </p>
      </div>

      {/* Stats row */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-3">
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-slate-400" />
            <span className="text-slate-400">Company:</span>
            <span className="font-semibold text-white">{portfolio?.company_name ?? me.portfolio?.company_name ?? '—'}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Portfolio ID:</span>
            <span className="font-mono text-xs text-slate-400">{portfolioId}</span>
          </div>
        </div>
      </div>

      {/* Settings Form */}
      <SettingsForm portfolio={portfolio} settings={settings} />
    </div>
  );
}
