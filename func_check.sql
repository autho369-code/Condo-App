
SELECT 
  p.proname AS function_name,
  pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname IN ('can_manage_finance', 'can_access_association', 'is_platform_operator')
ORDER BY p.proname;
