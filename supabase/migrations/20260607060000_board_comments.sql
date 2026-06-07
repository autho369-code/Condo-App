-- Board Member Comments on Violations
-- Board members can add internal comments visible to board + staff
CREATE TABLE IF NOT EXISTS public.board_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  violation_id uuid REFERENCES public.violations(id) ON DELETE CASCADE,
  association_id uuid NOT NULL REFERENCES public.associations(id),
  author_id uuid NOT NULL REFERENCES auth.users(id),
  author_name text,
  comment text NOT NULL,
  visibility text NOT NULL DEFAULT 'board_and_staff' CHECK (visibility IN ('board_only', 'board_and_staff', 'board_staff_admin')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.board_comments ENABLE ROW LEVEL SECURITY;

-- Board members can see comments on their own association's violations
DROP POLICY IF EXISTS board_view_comments ON public.board_comments;
CREATE POLICY board_view_comments ON public.board_comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.board_members
      WHERE auth_user_id = auth.uid()
      AND active = true
      AND association_id = board_comments.association_id
    )
  );

-- Board members can insert comments (author_id must match)
DROP POLICY IF EXISTS board_insert_comments ON public.board_comments;
CREATE POLICY board_insert_comments ON public.board_comments FOR INSERT
  WITH CHECK (author_id = auth.uid());

-- Staff with full access can view/manage comments for their portfolio associations
DROP POLICY IF EXISTS staff_board_comments ON public.board_comments;
CREATE POLICY staff_board_comments ON public.board_comments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.associations a
      WHERE a.id = board_comments.association_id
      AND a.portfolio_id = current_portfolio_id()
    )
    AND is_full_access_staff()
  );

-- Platform operators can do everything
DROP POLICY IF EXISTS operator_all_board_comments ON public.board_comments;
CREATE POLICY operator_all_board_comments ON public.board_comments FOR ALL
  USING (EXISTS (SELECT 1 FROM public.platform_operators WHERE auth_user_id = auth.uid() AND active = true));

-- Allow staff to update/delete their own comments
DROP POLICY IF EXISTS board_update_own_comments ON public.board_comments;
CREATE POLICY board_update_own_comments ON public.board_comments FOR UPDATE
  USING (author_id = auth.uid());

DROP POLICY IF EXISTS board_delete_own_comments ON public.board_comments;
CREATE POLICY board_delete_own_comments ON public.board_comments FOR DELETE
  USING (author_id = auth.uid());
