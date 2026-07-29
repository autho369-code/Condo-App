-- The configurable allocation engine writes application_method =
-- 'association_policy'; the original CHECK predates it (caught by a
-- rolled-back dry-run insert before any production payment could fail).
alter table public.payment_applications
  drop constraint payment_applications_application_method_check;
alter table public.payment_applications
  add constraint payment_applications_application_method_check
  check (application_method = any (array['manual','auto_oldest_first','auto_late_fees_first','auto_specific','credit_application','association_policy']));;
