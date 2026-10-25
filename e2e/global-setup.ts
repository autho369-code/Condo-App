import { execFileSync } from 'node:child_process';
import { db } from './helpers';
import { E2E } from './fixture.mjs';

// Before every run: rebuild the test company from scratch on the local test
// database (the seed refuses any other database), then confirm it's there.
export default async function globalSetup() {
  execFileSync('node', ['scripts/e2e/seed.mjs'], { stdio: 'inherit' });
  const { data, error } = await db().from('portfolios').select('id').eq('id', E2E.ids.portfolio).maybeSingle();
  if (error || !data) {
    throw new Error(`The local test database isn't seeded (${error?.message ?? 'no test company'}). Run \`npm run e2e:db\`.`);
  }
}
