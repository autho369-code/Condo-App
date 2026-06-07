// quick-check.ts
import * as fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envContent = fs.readFileSync('.env.local', 'utf-8');
const env: Record<string, string> = {};
for (const line of envContent.split('\n')) {
  const t = line.trim();
  if (t && !t.startsWith('#') && t.includes('=')) {
    const [k, ...r] = t.split('=');
    env[k.trim()] = r.join('=').trim();
  }
}

const db = createClient(env['NEXT_PUBLIC_SUPABASE_URL'], env['SUPABASE_SERVICE_ROLE_KEY'], {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log('URL:', env['NEXT_PUBLIC_SUPABASE_URL']);
  console.log('SRK length:', env['SUPABASE_SERVICE_ROLE_KEY']?.length);

  const r = await db.from('associations').select('id,name', { count: 'exact', head: true });
  console.log('associations:', JSON.stringify({ count: r.count, err: r.error?.message, status: r.status }));
  
  // try public.associations
  const r2 = await fetch(`${env['NEXT_PUBLIC_SUPABASE_URL']}/rest/v1/associations?select=id&limit=1`, {
    headers: { apikey: env['SUPABASE_SERVICE_ROLE_KEY'], Authorization: `Bearer ${env['SUPABASE_SERVICE_ROLE_KEY']}` }
  });
  console.log('REST status:', r2.status, await r2.text().then(t => t.slice(0, 200)));
}

main().catch(e => console.error(e.message));
