-- Add default portfolio_id for document_templates via trigger
CREATE OR REPLACE FUNCTION public.set_document_template_portfolio_id()
RETURNS trigger AS $$
BEGIN
  IF NEW.portfolio_id IS NULL THEN
    NEW.portfolio_id := public.current_portfolio_id();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_doc_templates_set_portfolio ON public.document_templates;
CREATE TRIGGER trg_doc_templates_set_portfolio
  BEFORE INSERT ON public.document_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.set_document_template_portfolio_id();
