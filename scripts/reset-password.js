// Request a provider-delivered recovery email without handling credentials.
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

function loadLocalEnv() {
  const envPath = path.resolve(__dirname, '..', '.env.local');
  const env = {};
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const [key, ...rest] = trimmed.split('=');
      env[key.trim()] = rest.join('=').trim();
    }
  }
  return env;
}

async function requestRecovery(emailArg = process.argv[2]) {
  const email = String(emailArg ?? '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Usage: node scripts/reset-password.js <verified-email>');
  }

  const env = loadLocalEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error('Supabase URL/anon key are not configured.');

  const supabase = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const siteUrl = env.NEXT_PUBLIC_PORTAL_URL || 'https://portier369.com';
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/api/auth/callback?next=/reset-password`,
  });
  if (error) throw error;
  console.log('Recovery email requested. No password or recovery credential was displayed.');
}

if (require.main === module) {
  requestRecovery().catch((error) => {
    console.error(`Recovery request failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { requestRecovery };
