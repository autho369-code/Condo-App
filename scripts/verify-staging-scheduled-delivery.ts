import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';

const url = process.env.STAGING_SUPABASE_URL;
const serviceKey = process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey || new URL(url).hostname.split('.')[0] !== 'zalfkrtjeswvfmucicea') throw new Error('Exact staging credentials are required');
process.env.NEXT_PUBLIC_SUPABASE_URL = url;
process.env.SUPABASE_SERVICE_ROLE_KEY = serviceKey;
process.env.CRON_SECRET = `codex-${randomUUID()}`;

const db = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } }) as any;
const scheduleId = randomUUID();
const runId = randomUUID();
const queueKey = `scheduled-report:${runId}:codex_test.reports@portier369.invalid`;
const assert = (condition: unknown, message: string) => { if (!condition) throw new Error(message); };

async function cleanup() {
  await db.from('email_queue').delete().eq('idempotency_key', queueKey);
  await db.from('report_runs').delete().eq('id', runId);
  await db.from('scheduled_reports').delete().eq('id', scheduleId);
}

async function main() {
  const { count: existing } = await db.from('report_runs').select('id', { count: 'exact', head: true })
    .eq('status', 'succeeded').not('scheduled_report_id', 'is', null)
    .gte('finished_at', new Date(Date.now() - 30 * 86400000).toISOString());
  assert(existing === 0, 'Staging has unrelated recent scheduled deliveries; refusing to mutate them');
  const { data: definition, error: definitionError } = await db.from('report_definitions').select('id').eq('active', true).limit(1).single();
  if (definitionError) throw definitionError;
  const { error: scheduleError } = await db.from('scheduled_reports').insert({
    id: scheduleId, portfolio_id: '36900000-0000-4000-8000-000000000001', definition_id: definition.id,
    name: 'CODEX_TEST delivery recovery', frequency: 'daily', active: false, output_format: 'pdf', delivery_channel: 'email',
    delivery_targets: ['CODEX_TEST.REPORTS@PORTIER369.INVALID', 'codex_test.reports@portier369.invalid'],
  });
  if (scheduleError) throw scheduleError;
  const now = new Date().toISOString();
  const { error: runError } = await db.from('report_runs').insert({
    id: runId, portfolio_id: '36900000-0000-4000-8000-000000000001', definition_id: definition.id,
    scheduled_report_id: scheduleId, output_format: 'pdf', status: 'succeeded', parameters: {},
    output_url: 'https://portier369.invalid/CODEX_TEST/report.pdf', started_at: now, finished_at: now,
  });
  if (runError) throw runError;

  const { GET } = await import('../app/api/reports/run-scheduled/route');
  const invoke = () => GET(new NextRequest('https://preview.portier369.invalid/api/reports/run-scheduled', {
    headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
  }));
  const first = await invoke();
  if (!first.ok) throw new Error(`First recovery invocation failed: ${await first.text()}`);
  const firstBody = await first.json();
  assert(firstBody.deliveries.some((entry: any) => entry.run === runId && entry.status === 'queued' && entry.emails_queued === 1), 'First invocation did not deduplicate and queue exactly one email');
  const second = await invoke();
  if (!second.ok) throw new Error(`Second recovery invocation failed: ${await second.text()}`);
  const secondBody = await second.json();
  assert(secondBody.deliveries.some((entry: any) => entry.run === runId && entry.status === 'already_queued'), 'Replay was not recognized as already queued');
  const { data: rows } = await db.from('email_queue').select('portfolio_id, to_email, status').eq('idempotency_key', queueKey);
  assert(rows?.length === 1 && rows[0].portfolio_id === '36900000-0000-4000-8000-000000000001'
    && rows[0].to_email === 'codex_test.reports@portier369.invalid' && rows[0].status === 'pending', 'Recovered queue row is not exact or portfolio-scoped');
  console.log('Scheduled report recovery, recipient normalization, replay idempotency, and portfolio queue scope: PASS');
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(cleanup);
