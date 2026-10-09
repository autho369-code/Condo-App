import type { ApprovalRule } from '@/components/purchase-orders/po-form';
import type { VendorOption } from '@/components/vendors/vendor-select';

/** Options + per-association approval rules for the purchase order form. */
export async function loadPurchaseOrderFormOptions(supabase: any, portfolioId: string | undefined) {
  const [
    { data: associations },
    { data: vendors },
    { data: glAccounts },
    { data: workOrders },
    { data: settings },
  ] = await Promise.all([
    supabase.from('associations').select('id, name').eq('portfolio_id', portfolioId).is('archived_at', null).order('name'),
    supabase.from('vendors').select('id, name, association_id, is_management_company').eq('portfolio_id', portfolioId).is('archived_at', null).order('name'),
    supabase.from('gl_accounts').select('id, number, name, association_id').eq('portfolio_id', portfolioId).eq('active', true).order('number'),
    supabase.from('work_orders')
      .select('id, number, title, association_id, status')
      .eq('portfolio_id', portfolioId)
      .is('archived_at', null)
      .not('status', 'in', '(closed,cancelled,billed)')
      .order('created_at', { ascending: false })
      .limit(300),
    supabase.from('board_approval_settings').select('association_id, sends_pos_to_board, pos_threshold'),
  ]);

  const rules: Record<string, ApprovalRule> = {};
  for (const s of settings ?? []) {
    rules[s.association_id] = { mode: s.sends_pos_to_board ?? 'never', threshold: s.pos_threshold == null ? null : Number(s.pos_threshold) };
  }

  return {
    associations: (associations ?? []) as { id: string; name: string }[],
    vendors: (vendors ?? []) as VendorOption[],
    glAccounts: (glAccounts ?? []) as { id: string; number: string | null; name: string; association_id: string | null }[],
    workOrders: ((workOrders ?? []) as any[]).map((w) => ({
      id: w.id as string,
      association_id: w.association_id as string | null,
      label: `${w.number ? `#${w.number} · ` : ''}${w.title ?? 'Work order'}`,
    })),
    rules,
  };
}
