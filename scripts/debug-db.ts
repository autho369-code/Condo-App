// debug-db.ts — quick check
import * as fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envContent = fs.readFileSync('.env.local', 'utf-8');
const env: Record<string, string> = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
    const [key, ...rest] = trimmed.split('=');
    env[key.trim()] = rest.join('=').trim();
  }
}

const db = createClient(env['NEXT_PUBLIC_SUPABASE_URL'], env['SUPABASE_SERVICE_ROLE_KEY'], {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  // Try different table name formats
  for (const table of ['associations', 'public.associations', 'Associations']) {
    const r = await db.from(table).select('id,name', { count: 'exact', head: true });
    console.log(`${table}: count=${r.count}, error=${r.error?.message || 'none'}`);
  }
  
  // List all tables
  const { data: tables } = await db.rpc('get_tables').select('*');
  console.log('RPC result:', tables);
}

main().catch(e => console.error('Fatal:', e.message));
