import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const rpc = vi.fn();
const redirects: string[] = [];
vi.mock('next/navigation', () => ({
  redirect: (url: string) => { redirects.push(url); throw new Error(`REDIRECT ${url}`); },
}));
vi.mock('next/cache', () => ({ revalidatePath: () => undefined }));
const requireFinanceStaff = vi.fn(async () => ({ auth_user_id: 'u1' }));
vi.mock('@/lib/auth/me', () => ({ requireFinanceStaff: () => requireFinanceStaff() }));
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ rpc }) }));

import { bankFeedAction } from '@/lib/rpcs/bank-feed';
import { formatZelleRecipient, normalizeZelleRecipient } from '@/lib/payments/zelle';
import { RECEIPT_METHODS } from '@/lib/payments/methods';

const root = process.cwd();
const read = (p: string) => readFileSync(resolve(root, p), 'utf8').replace(/\r\n/g, '\n');
const migration = read('supabase/migrations/20261017010000_zelle_owner_payments.sql');
const fn = (name: string) => {
  const start = migration.indexOf(`create or replace function public.${name}(`);
  expect(start).toBeGreaterThan(-1);
  const rest = migration.slice(start);
  const end = rest.search(/\n\$(function)?\$;|\nend \$\$;/);
  return rest.slice(0, end);
};

const TXN = '11111111-1111-4111-8111-111111111111';
const UNIT = '22222222-2222-4222-8222-222222222222';

function form(fields: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}
async function run(fields: Record<string, string>) {
  await expect(bankFeedAction(form(fields))).rejects.toThrow(/REDIRECT/);
  return redirects.at(-1)!;
}

beforeEach(() => {
  rpc.mockReset();
  requireFinanceStaff.mockClear();
  redirects.length = 0;
});

describe('20261017010000_zelle_owner_payments migration', () => {
  it('adds zelle to the payment methods and keeps every existing one', () => {
    const check = migration.match(/add constraint payments_method_check\s+check \(method = any \(array\[([^\]]+)\]\)\)/);
    expect(check).not.toBeNull();
    const values = check![1].split(',').map((v) => v.trim().replace(/'/g, ''));
    for (const v of ['manual', 'check', 'ach', 'card', 'other', 'cash', 'money_order', 'cashiers_check', 'wire', 'online', 'credit', 'zelle']) {
      expect(values).toContain(v);
    }
    expect(RECEIPT_METHODS.some((m) => m.value === 'zelle')).toBe(true);
  });

  it('has no DELETE and writes non-ASCII characters as chr()', () => {
    expect(migration).not.toMatch(/\bdelete\s+from\b/i);
    expect(migration).not.toMatch(/drop\s+(table|column|function|policy|trigger)/i);
    expect(/[^\x00-\x7F]/.test(migration)).toBe(false);
  });

  it('keeps the Plaid detail columns server-written', () => {
    const guard = fn('bank_transactions_server_fields_guard');
    expect(guard).toContain('security invoker');
    expect(guard).toContain("if current_user not in ('authenticated', 'anon') then");
    expect(migration).toContain('before insert or update of original_description, payer_name, payment_reason on public.bank_transactions');
  });

  it('lets only finance staff, company admins and operators change the Zelle recipient', () => {
    const guard = fn('associations_payment_settings_guard');
    expect(guard).toContain('new.zelle_recipient is distinct from old.zelle_recipient');
    expect(guard).toContain("Only finance staff can change where owners send Zelle payments");
    // The #391 rules are kept.
    expect(guard).toContain('new.payment_allocation_order is distinct from old.payment_allocation_order');
    expect(guard).toContain('new.stripe_account_id is distinct from old.stripe_account_id');
    expect(migration).toContain('associations_zelle_recipient_check');
  });

  it('protects payment_sender_aliases with once-per-query finance RLS and no direct writes', () => {
    expect(migration).toContain('alter table public.payment_sender_aliases enable row level security;');
    expect(migration).toContain('revoke all on table public.payment_sender_aliases from public, anon, authenticated;');
    expect(migration).toContain('grant select on table public.payment_sender_aliases to authenticated;');
    expect(migration).toContain('as permissive for select to authenticated');
    expect(migration).toContain('coalesce(portfolio_id = (select public.my_finance_portfolio()), false)');
    expect(migration).toMatch(/create policy mgr_assoc_scope on public\.payment_sender_aliases\s+as restrictive for all to authenticated/);
    expect(migration).toContain('association_id in (select public.my_managed_association_ids())');
    expect(migration).toContain('unique (association_id, sender_key)');
    expect(migration).not.toMatch(/can_access_portfolio\(portfolio_id\)/);
  });

  it('suggests only for open money in, inside the bank account association(s), in confidence order', () => {
    const suggest = fn('suggest_bank_transaction_payment');
    expect(suggest).toContain('security definer');
    expect(suggest).toContain("set search_path to 'pg_catalog', 'public'");
    expect(suggest).toContain('not public.can_manage_finance(b.portfolio_id)');
    expect(suggest).toContain('t.amount >= 0 or t.pending or t.ignored_at is not null or t.matched_at is not null');
    expect(suggest).toContain('public.app_bank_account_association_ids(b.id)');
    // 1. remembered sender, 2. memo unit through the lockbox matcher, 3. owner name, 4. amount.
    const order = ["'Remembered sender'", 'public.lockbox_match_unit(v_assoc, v_tok, null, null)', 'public.payer_name_matches(v_sender', 'amount equals the open balance'];
    const positions = order.map((s) => suggest.indexOf(s));
    expect(positions.every((p) => p > -1)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it('receives through the existing receipt and deposit path, locked, finance-checked and scoped', () => {
    const receive = fn('receive_bank_transaction_as_payment');
    expect(receive).toContain('security definer');
    // app_bank_transaction_for_update locks the line FOR UPDATE and checks finance + scope + matched + pending.
    expect(receive).toContain('t := public.app_bank_transaction_for_update(p_id);');
    expect(receive).toContain('if t.ignored_at is not null then');
    expect(receive).toContain('if t.amount is null or t.amount >= 0 then');
    expect(receive).toContain('not (v_unit_assoc = any (v_assocs)) or not public.can_view_association_row(v_unit_assoc)');
    expect(receive).toContain("when v_desc ~* 'zelle' or coalesce(t.name, '') ~* 'zelle' then 'zelle'");
    expect(receive).toContain('insert into public.payments (unit_id, amount, payment_date, method, reference, notes, bank_account_id, created_by)');
    expect(receive).toContain('round(-t.amount, 2), t.date, v_method');
    expect(receive).toContain('public.create_bank_deposit(b.id, t.date, array[v_payment]');
    expect(receive).toContain('perform public.match_bank_transaction_to_deposit(t.id, v_deposit);');
    expect(receive).toContain("set match_method = 'owner_payment'");
    expect(receive).toContain('on conflict (association_id, sender_key)');
    expect(migration).toContain("'public.receive_bank_transaction_as_payment(uuid, uuid, boolean)'] loop");
    expect(migration).toContain("execute format('revoke all on function %s from public, anon', f);");
  });

  it('audits Zelle recipient changes, batches the page suggestions and remembers only real names', () => {
    expect(migration).toContain('after update of zelle_recipient, zelle_recipient_name on public.associations');
    expect(fn('associations_zelle_recipient_audit')).toContain("'zelle_recipient_changed'");
    const batch = fn('suggest_bank_transaction_payments');
    expect(batch).toContain('cardinality(p_ids) > 100');
    expect(batch).toContain('from public.suggest_bank_transaction_payment(v_id) s');
    expect(migration).toContain("'public.suggest_bank_transaction_payments(uuid[])',");
    expect(migration.match(/if position\(' ' in coalesce\(v_key, ''\)\) = 0 then v_key := null; end if;/g)?.length).toBe(2);
    expect(migration).toContain('references public.units(id) on delete cascade');
    expect(migration).toMatch(/create or replace trigger operator_write_guard\s+before insert or delete or update on public\.payment_sender_aliases/);
    const page = read('app/(app)/bank-accounts/feeds/page.tsx');
    expect(page).toContain("db.rpc('suggest_bank_transaction_payments'");
    expect(page).not.toContain("db.rpc('suggest_bank_transaction_payment',");
  });

  it('shares one name matcher between the lockbox and the bank feed', () => {
    const lockbox = fn('lockbox_match_unit');
    expect(lockbox.match(/public\.payer_name_matches\(p_payer, o\.first_name, o\.last_name, o\.full_name\)/g)?.length).toBe(2);
    expect(lockbox).toContain("reason := 'Unit number'");
  });
});

describe('bank description parser (SQL)', () => {
  const parser = fn('parse_bank_payment_description');
  it('reads the sender after "from", cut before for/on/ref/conf and trailing codes', () => {
    expect(parser).toContain("position(' from ' in lower(' ' || s || ' '))");
    expect(parser).toContain("'(?i)\\s+(for|on|ref|reference|conf|confirmation|memo)\\M.*$'");
    expect(parser).toContain("'\\s+\\S*[0-9]\\S*$'");
  });
  it('reads the PNC "Zelle NAME Transfer" form, the quoted memo and the confirmation number', () => {
    expect(parser).toContain("regexp_replace(s, '^zelle\\s+', '', 'i')");
    expect(parser).toContain(`substring(s from '"([^"]*)"')`);
    expect(parser).toMatch(/conf\(\?:irmation\)\?\|\\mref/);
  });
  it('normalizes the remembered sender key', () => {
    const key = fn('payment_sender_key');
    expect(key).toContain("'[^A-Z0-9 ]+', ' ', 'g'");
    const names = fn('payer_name_matches');
    expect(names).toContain("'JR', 'SR'");
    expect(names).toContain('left(l, char_length(v_tail)) = v_tail');
  });
});

describe('Zelle recipient', () => {
  it('accepts an email or a US mobile number', () => {
    expect(normalizeZelleRecipient('payments@assoc.com')).toEqual({ ok: true, value: 'payments@assoc.com' });
    expect(normalizeZelleRecipient('(312) 655-0100')).toEqual({ ok: true, value: '3126550100' });
    expect(normalizeZelleRecipient('+1 312 655 0100')).toEqual({ ok: true, value: '3126550100' });
    expect(normalizeZelleRecipient('')).toEqual({ ok: true, value: null });
    expect(normalizeZelleRecipient('not an address').ok).toBe(false);
    expect(normalizeZelleRecipient('a@b').ok).toBe(false);
  });
  it('shows a phone the way owners read it', () => {
    expect(formatZelleRecipient('3126550100')).toBe('(312) 655-0100');
    expect(formatZelleRecipient('payments@assoc.com')).toBe('payments@assoc.com');
  });
});

describe('bank feed: receive as owner payment', () => {
  it('calls the RPC with the unit and the remember-sender choice', async () => {
    rpc.mockResolvedValue({ data: 'payment-id', error: null });
    const to = await run({ id: TXN, op: 'receive', unit_id: UNIT, remember_sender: 'on', back: '/bank-accounts/feeds?filter=unreviewed' });
    expect(requireFinanceStaff).toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith('receive_bank_transaction_as_payment', { p_id: TXN, p_unit_id: UNIT, p_remember_sender: true });
    expect(to).toBe('/bank-accounts/feeds?filter=unreviewed&done=receive');
  });

  it('does not remember the sender when the box is unticked', async () => {
    rpc.mockResolvedValue({ data: 'payment-id', error: null });
    await run({ id: TXN, op: 'receive', unit_id: UNIT });
    expect(rpc).toHaveBeenCalledWith('receive_bank_transaction_as_payment', { p_id: TXN, p_unit_id: UNIT, p_remember_sender: false });
  });

  it('needs a unit and fails loudly with the database message', async () => {
    let to = await run({ id: TXN, op: 'receive', unit_id: '' });
    expect(rpc).not.toHaveBeenCalled();
    expect(to).toContain('error=');
    rpc.mockResolvedValue({ data: null, error: { message: 'This transaction is already matched' } });
    to = await run({ id: TXN, op: 'receive', unit_id: UNIT });
    expect(decodeURIComponent(to)).toContain('already matched');
  });

  it('never redirects outside the bank feed', async () => {
    rpc.mockResolvedValue({ data: 'payment-id', error: null });
    const to = await run({ id: TXN, op: 'receive', unit_id: UNIT, back: 'https://evil.example/' });
    expect(to.startsWith('/bank-accounts/feeds')).toBe(true);
  });
});
