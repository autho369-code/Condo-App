
SELECT pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname IN ('current_portfolio_id', 'is_finance_staff', 'is_any_staff', 'is_staff', 'is_full_access_staff');
