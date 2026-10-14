import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { emailQueueRow } from '../../lib/email/queue';

const read = (p: string) => readFileSync(resolve(p), 'utf8').replace(/\r\n/g, '\n');
const migration = read('supabase/migrations/20261016180000_email_platform_mail_flag.sql');
const fn = (name: string) => {
  const start = migration.indexOf(`create or replace function public.${name}(`);
  expect(start, name).toBeGreaterThan(-1);
  return migration.slice(start, migration.indexOf('$function$;', start));
};
// SQL without comments: the name test must be gone from the code itself.
const code = (sql: string) => sql.replace(/--[^\n]*/g, '');

describe('platform mail is marked by the server, not by its sender name', () => {
  it('adds a not-null flag that defaults to company mail', () => {
    expect(migration).toContain('add column if not exists platform_mail boolean not null default false');
    const columns = JSON.parse(read('supabase/schema-columns.json'));
    expect(columns.email_queue).toContain('platform_mail');
  });

  it('signed-in writes cannot set it (invoker guard on current_user)', () => {
    const guard = fn('email_queue_guard_worker_columns');
    expect(guard).not.toMatch(/security definer/i);
    expect(guard).toContain("if current_user in ('authenticated', 'anon') then");
    expect(guard).toContain('new.platform_mail := false;');
    expect(guard).toContain('new.platform_mail := old.platform_mail;');
  });

  it('the suspended-company hold and the unsubscribe rule use the flag, not the name', () => {
    const claim = code(fn('claim_email_queue_snapshot'));
    expect(claim).toContain('and not email_queue.platform_mail)');
    expect(claim).toContain("if auth.role() <> 'service_role'");
    expect(claim).not.toMatch(/portier369/i);
    const prepare = code(fn('email_prepare_batch'));
    expect(prepare).toContain('and not r.platform_mail then');
    expect(prepare).toContain("if coalesce(auth.role(), '') <> 'service_role'");
    expect(prepare).not.toMatch(/portier369%/i);
  });

  it('queueEmails passes platformMail only when asked', () => {
    const base = { to: 'a@example.com', subject: 's', text: 't', portfolioId: 'p1' };
    expect(emailQueueRow({ ...base, platformMail: true })).toMatchObject({ platform_mail: true });
    expect(emailQueueRow(base)).not.toHaveProperty('platform_mail');
    expect(emailQueueRow({ ...base, fromName: 'Portier369' })).not.toHaveProperty('platform_mail');
    expect(read('lib/email/queue.ts')).toContain('defaultToNull: false');
  });

  it('the worker routes by the flag', () => {
    const route = read('app/api/email/process-queue/route.ts');
    expect(route).not.toContain('isPlatformSenderName');
    expect(route).toContain('!isPlatformMail(e)');
    expect(route).toContain('isPlatformMail(email)');
  });

  it('every platform sender marks its mail', () => {
    const operator = read('app/platform-operator/companies/actions.ts');
    const sends = operator.split("from('email_queue').insert(").length - 1;
    expect(sends).toBeGreaterThan(0);
    expect(operator.split('platform_mail: true').length - 1).toBe(sends);
    expect(read('app/platform-operator/announcements/page.tsx')).toContain('platform_mail: true');
    expect(read('app/(auth)/forgot-password/page.tsx')).toContain('...(portfolioId ? {} : { platform_mail: true })');
  });
});
