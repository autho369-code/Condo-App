-- Phase A security lockdown: enable RLS on all 19 exposed tables.
-- 4 tables are actively used by the frontend and get policies.
-- 15 tables are unused (orphans / future features): RLS enabled with NO
-- policies = accessible only via service_role until a keep/drop decision.

-- ── In use: needs policies ─────────────────────────────────────────

-- maintenance_template_groups (portfolio-scoped)
ALTER TABLE public.maintenance_template_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY mtg_staff_all ON public.maintenance_template_groups
  FOR ALL USING (can_access_portfolio(portfolio_id) OR is_platform_operator())
  WITH CHECK (can_access_portfolio(portfolio_id) OR is_platform_operator());

-- maintenance_templates (no portfolio_id; system templates are global,
-- custom templates scope through their group's portfolio)
ALTER TABLE public.maintenance_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY mt_read ON public.maintenance_templates
  FOR SELECT USING (
    is_system
    OR is_platform_operator()
    OR EXISTS (
      SELECT 1 FROM public.maintenance_template_groups g
      WHERE g.id = maintenance_templates.group_id
        AND can_access_portfolio(g.portfolio_id)
    )
  );
CREATE POLICY mt_write ON public.maintenance_templates
  FOR ALL USING (
    is_platform_operator()
    OR (is_any_staff() AND EXISTS (
      SELECT 1 FROM public.maintenance_template_groups g
      WHERE g.id = maintenance_templates.group_id
        AND can_access_portfolio(g.portfolio_id)
    ))
  )
  WITH CHECK (
    is_platform_operator()
    OR (is_any_staff() AND EXISTS (
      SELECT 1 FROM public.maintenance_template_groups g
      WHERE g.id = maintenance_templates.group_id
        AND can_access_portfolio(g.portfolio_id)
    ))
  );

-- inventory_items (no tenant column yet — staff-only until portfolio_id is added)
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY inv_staff_all ON public.inventory_items
  FOR ALL USING (is_any_staff() OR is_platform_operator())
  WITH CHECK (is_any_staff() OR is_platform_operator());

-- bank_adjustments (scope through the bank account's portfolio, finance roles)
ALTER TABLE public.bank_adjustments ENABLE ROW LEVEL SECURITY;
CREATE POLICY badj_finance_all ON public.bank_adjustments
  FOR ALL USING (
    is_platform_operator()
    OR EXISTS (
      SELECT 1 FROM public.bank_accounts ba
      WHERE ba.id = bank_adjustments.bank_account_id
        AND can_manage_finance(ba.portfolio_id)
    )
  )
  WITH CHECK (
    is_platform_operator()
    OR EXISTS (
      SELECT 1 FROM public.bank_accounts ba
      WHERE ba.id = bank_adjustments.bank_account_id
        AND can_manage_finance(ba.portfolio_id)
    )
  );

-- ── Unused: lock down (no policies = service_role only) ────────────
ALTER TABLE public.ticket_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.superadmin_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owner_notification_prefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_action_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owner_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owner_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owner_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;;
