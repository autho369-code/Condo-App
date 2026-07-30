
insert into public.profiles (id, email, display_name, full_name, role, hoa_role, portfolio_id)
values (
  '5443507f-c5f2-472c-a13f-a7c222acf56d',
  'admin@hoa-os.local',
  'Admin',
  'Admin',
  'admin',
  'manager',
  'a1000000-0000-0000-0000-000000000001'
)
on conflict (id) do update set
  hoa_role = 'manager',
  portfolio_id = 'a1000000-0000-0000-0000-000000000001',
  role = 'admin';
;
