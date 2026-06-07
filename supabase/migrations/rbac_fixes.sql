-- RBAC fixes per Mirsad's hierarchy

-- 1. is_company_admin: accept President role (not just 'company_admin' string)
CREATE OR REPLACE FUNCTION public.is_company_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'pg_catalog','public'
AS $$ select exists(select 1 from public.profiles p left join public.user_roles ur on ur.id=p.role_id where p.id=auth.uid() and (p.hoa_role='company_admin' or ur.name='President')); $$;

-- 2. is_finance_staff: remove Accounts Payable
CREATE OR REPLACE FUNCTION public.is_finance_staff()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'pg_catalog','public'
AS $$ select exists(select 1 from public.profiles p left join public.user_roles ur on ur.id=p.role_id where p.id=auth.uid() and p.hoa_role='manager' and (ur.name in('President','Property Manager','Accountant') or ur.name is null)); $$;

-- 3. current_role_name: handle all valid hoa_role enum values
CREATE OR REPLACE FUNCTION public.current_role_name()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'pg_catalog','public'
AS $$ select coalesce(ur.name, case p.hoa_role when 'owner' then 'Owner' when 'board' then 'Board Member' when 'tenant' then 'Tenant' when 'company_admin' then 'Company Admin' when 'manager' then 'Manager' else p.hoa_role::text end) from public.profiles p left join public.user_roles ur on ur.id=p.role_id where p.id=auth.uid(); $$;

-- 4. Deactivate Leasing Agent and Accounts Payable roles
UPDATE public.user_roles SET is_system = false WHERE name IN ('Leasing Agent', 'Accounts Payable');
