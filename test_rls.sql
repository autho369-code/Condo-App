
-- Test if is_platform_operator resolves correctly
-- Get the auth.user id for hello@portier369.com
SELECT id, email FROM auth.users WHERE email = 'hello@portier369.com';

-- Get the profile if exists
SELECT id, hoa_role, portfolio_id FROM public.profiles WHERE id IN (SELECT id FROM auth.users WHERE email = 'hello@portier369.com');
