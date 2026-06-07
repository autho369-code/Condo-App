// Reset auth user password via Supabase Admin API
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
    const [key, ...rest] = trimmed.split('=');
    env[key.trim()] = rest.join('=').trim();
  }
}

async function main() {
  const supabase = createClient(env['NEXT_PUBLIC_SUPABASE_URL'], env['SUPABASE_SERVICE_ROLE_KEY'], {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const email = 'autho369@gmail.com';
  const newPassword = process.argv[2] || 'Portier2026!';

  const { data, error } = await supabase.auth.admin.updateUserById(
    'df2e02c5-905a-435c-ba9f-97b789f56391',
    { password: newPassword, email_confirm: true }
  );

  if (error) {
    console.error('Error:', error.message);
  } else {
    console.log(`Password reset for ${email}`);
    console.log(`New password: ${newPassword}`);
  }
}

main();
