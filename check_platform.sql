
-- Check if hello@portier369.com is in platform_operators
SELECT po.* 
FROM public.platform_operators po
JOIN auth.users u ON po.auth_user_id = u.id
WHERE u.email = 'hello@portier369.com';

-- Check can_access_portfolio function
SELECT pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'can_access_portfolio';
