import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeDb, type Row } from './fake-db';

vi.mock('server-only', () => ({}));

let db: ReturnType<typeof fakeDb>;
vi.mock('@/lib/supabase/server', () => ({ createServiceClient: () => db }));
vi.mock('@/lib/sms/twilio', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/sms/twilio')>()),
  validTwilioSignature: () => true,
}));

import { POST as inbound } from '@/app/api/sms/twilio/inbound/route';
import { POST as status } from '@/app/api/sms/twilio/status/route';

const FROM = '+15555550100';
const TO = '+15555550199';
const SID = `SM${'a'.repeat(32)}`;

function twilioRequest(path: string, fields: Record<string, string>) {
  return new Request(`https://example.test${path}`, {
    method: 'POST',
    headers: { 'x-twilio-signature': 'signed' },
    body: new URLSearchParams(fields).toString(),
  }) as any;
}

beforeEach(() => {
  process.env.TWILIO_AUTH_TOKEN = 'test-token';
  process.env.TWILIO_WEBHOOK_BASE_URL = 'https://example.test';
});

describe('Twilio webhooks', () => {
  it('applies STOP to the company that texted from the number, when a Messaging Service picked it', async () => {
    const tables: Record<string, Row[]> = {
      sms_opt_ins: [
        { id: 'o1', portfolio_id: 'pA', entity_type: 'owner', phone_number: FROM, opted_in: true },
        { id: 'o2', portfolio_id: 'pB', entity_type: 'owner', phone_number: FROM, opted_in: true },
      ],
      sms_conversations: [
        { id: 'c1', portfolio_id: 'pA', with_phone_number: FROM, our_phone_number: 'messaging-service' },
        { id: 'c2', portfolio_id: 'pB', with_phone_number: FROM, our_phone_number: 'messaging-service' },
      ],
      sms_messages: [{ id: 'm2', conversation_id: 'c2', direction: 'outbound', provider_from_number: TO, to_number: FROM }],
    };
    db = fakeDb(tables);
    const res = await inbound(twilioRequest('/api/sms/twilio/inbound', { From: FROM, To: TO, OptOutType: 'START', Body: 'START', MessageSid: SID }));
    expect(res.status).toBe(204);
    expect(tables.sms_opt_ins.find((o) => o.id === 'o2')).toMatchObject({ opted_in: true, source: 'twilio_advanced_opt_out' });
    expect(tables.sms_opt_ins.find((o) => o.id === 'o1')?.source).toBeUndefined();
  });

  it('ignores a sender number staff typed in, and opts out every company on STOP', async () => {
    const tables: Record<string, Row[]> = {
      sms_opt_ins: [
        { id: 'o1', portfolio_id: 'pA', entity_type: 'owner', phone_number: FROM, opted_in: true },
        { id: 'o2', portfolio_id: 'pB', entity_type: 'owner', phone_number: FROM, opted_in: true },
      ],
      // Company A's staff wrote company B's number into their own rows.
      sms_conversations: [{ id: 'c1', portfolio_id: 'pA', with_phone_number: FROM, our_phone_number: TO }],
      sms_messages: [{ id: 'm1', conversation_id: 'c1', direction: 'outbound', from_number: TO, to_number: FROM }],
    };
    db = fakeDb(tables);
    const start = await inbound(twilioRequest('/api/sms/twilio/inbound', { From: FROM, To: TO, OptOutType: 'START', Body: 'START', MessageSid: SID }));
    // Two companies know them and neither proved it texted from TO: no guess.
    expect(start.status).toBe(409);
    expect(tables.sms_opt_ins.every((o) => o.source === undefined)).toBe(true);

    const stop = await inbound(twilioRequest('/api/sms/twilio/inbound', { From: FROM, To: TO, OptOutType: 'STOP', Body: 'STOP', MessageSid: SID }));
    expect(stop.status).toBe(204);
    expect(tables.sms_opt_ins.every((o) => o.opted_in === false)).toBe(true);
  });

  it('records the number Twilio sent from on the message and its conversation', async () => {
    const tables: Record<string, Row[]> = {
      sms_conversations: [{ id: 'c1', portfolio_id: 'pA', with_phone_number: FROM, our_phone_number: 'messaging-service' }],
      sms_messages: [{ id: 'm1', conversation_id: 'c1', direction: 'outbound', provider_message_id: SID, from_number: 'messaging-service', to_number: FROM }],
    };
    db = fakeDb(tables);
    const res = await status(twilioRequest('/api/sms/twilio/status', { MessageSid: SID, MessageStatus: 'sent', From: TO, To: FROM }));
    expect(res.status).toBe(204);
    expect(db.rpcCalls[0]).toMatchObject({ fn: 'apply_twilio_sms_status', args: { p_provider_message_id: SID, p_status: 'sent' } });
    expect(tables.sms_messages[0]).toMatchObject({ from_number: TO, provider_from_number: TO });
    expect(tables.sms_conversations[0].our_phone_number).toBe(TO);
  });
});
