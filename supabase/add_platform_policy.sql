-- Platform operator bypass for document_templates
DROP POLICY IF EXISTS doc_templates_platform_all ON public.document_templates;
CREATE POLICY doc_templates_platform_all ON public.document_templates
  FOR ALL TO authenticated
  USING (public.is_platform_operator())
  WITH CHECK (public.is_platform_operator());
