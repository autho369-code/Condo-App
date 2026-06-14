// Persona setup for the clean Granville Courts sample.
// 1) deletes the 12 fake/test auth users, 2) (re)creates the 6 portal personas
// with a known password + confirmed email, 3) resets the operator (hello@) password.
// Prints every resulting auth UID so the profiles/owners/vendor/tenant rows can be wired in SQL.
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const env = {};
for (const line of fs.readFileSync(path.resolve(__dirname, '..', '.env.local'), 'utf-8').split('\n')) {
  const t = line.trim();
  if (t && !t.startsWith('#') && t.includes('=')) { const [k, ...r] = t.split('='); env[k.trim()] = r.join('=').trim(); }
}

const supabase = createClient(env['NEXT_PUBLIC_SUPABASE_URL'], env['SUPABASE_SERVICE_ROLE_KEY'], {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PASSWORD = 'Portier2026!';

const FAKE_USER_IDS = [
  '88888888-8888-8888-8888-888888888888', // vendor@aaservices.example
  '77777777-7777-7777-7777-777777777777', // george@example.com
  '55555555-5555-5555-5555-555555555555', // mark@example.com
  '66666666-6666-6666-6666-666666666666', // carol@example.com
  '22222222-2222-2222-2222-222222222222', // jane@acmepm.com
  '33333333-3333-3333-3333-333333333333', // bob@acmepm.com
  '44444444-4444-4444-4444-444444444444', // alice@example.com
  'aeb3924d-e953-4487-9d10-a7d258150035', // mirsad@stellarpropertygroup.com (test login)
  '6979173e-0424-41bc-bebb-31c935ca24d3', // test-login@portier369.com
  'f7260049-8c20-445b-8e0c-91a24457c357', // john@doe.com
  '85563a9e-40f3-47d4-92ac-5a415c1c8d2c', // mirsadc1971@icloud.com (test login)
  '2776c6df-7a22-44ff-bcc2-c3c192ea8ecc', // e2etest060825@portier369.com
];

const PERSONAS = [
  { key: 'company_admin', email: 'admin@portier369.com',   name: 'Aisha Admin' },
  { key: 'manager',       email: 'manager@portier369.com', name: 'Marcus Manager' },
  { key: 'owner_occupant',email: 'owner1@portier369.com',  name: 'Olivia Owner' },
  { key: 'owner_landlord',email: 'owner2@portier369.com',  name: 'Liam Landlord' },
  { key: 'tenant',        email: 'tenant@portier369.com',  name: 'Tessa Tenant' },
  { key: 'vendor',        email: 'vendor@portier369.com',  name: 'Victor Vendor' },
];

const HELLO_ID = '3e703092-2400-40b8-b904-e2990f2f6325';

async function main() {
  // 1) delete fakes
  for (const id of FAKE_USER_IDS) {
    const { error } = await supabase.auth.admin.deleteUser(id);
    console.log(`delete ${id}: ${error ? 'ERR ' + error.message : 'ok'}`);
  }

  // 2) reset operator password
  {
    const { error } = await supabase.auth.admin.updateUserById(HELLO_ID, { password: PASSWORD, email_confirm: true });
    console.log(`reset hello@portier369.com: ${error ? 'ERR ' + error.message : 'ok'}`);
  }

  // 3) create personas (idempotent: if email exists, fetch & update password)
  const results = [];
  for (const p of PERSONAS) {
    let { data, error } = await supabase.auth.admin.createUser({
      email: p.email, password: PASSWORD, email_confirm: true,
      user_metadata: { full_name: p.name },
    });
    if (error && /already/i.test(error.message)) {
      const { data: list } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const existing = list.users.find((u) => u.email.toLowerCase() === p.email.toLowerCase());
      if (existing) {
        await supabase.auth.admin.updateUserById(existing.id, { password: PASSWORD, email_confirm: true });
        data = { user: existing };
        error = null;
      }
    }
    if (error) { console.log(`create ${p.email}: ERR ${error.message}`); continue; }
    results.push({ key: p.key, email: p.email, name: p.name, id: data.user.id });
  }

  console.log('\n=== PERSONA UIDS (JSON) ===');
  console.log(JSON.stringify(results, null, 2));
  console.log(`\nAll passwords: ${PASSWORD}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
