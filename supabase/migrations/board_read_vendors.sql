-- Board members can read vendors that serve any of their association(s),
-- determined by the existence of a work_order for that vendor in one of the
-- board's associations. Additive SELECT policy only.
CREATE POLICY vendors_board_read ON public.vendors
  FOR SELECT
  TO authenticated
  USING (
    is_board_user()
    AND EXISTS (
      SELECT 1
      FROM public.work_orders wo
      WHERE wo.vendor_id = vendors.id
        AND wo.association_id IN (SELECT current_board_association_ids())
    )
  );
