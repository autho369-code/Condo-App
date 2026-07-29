
update auth.users 
set encrypted_password = crypt('Admin1234!', gen_salt('bf'))
where email = 'admin@hoa-os.local';
;
