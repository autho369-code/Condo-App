import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { recordInboundReply } from '@/lib/sms/inbound-reply';

import { fakeDb, type Row } from './fake-db';

const FROM = '+15555550100';
const TO = '+15555550199';

describe('inbound SMS replies', () => {
  it('records a reply in the sender\'s conversation and marks it unread', async () => {
    const tables: Record<string, Row[]> = {
      sms_conversations: [{ id: 'c1', portfolio_id: 'p1', with_phone_number: FROM, our_phone_number: TO, unread_count: 2, archived_at: null }],
      sms_messages: [],
    };
    const result = await recordInboundReply(fakeDb(tables), { from: FROM, to: TO, body: ' Thanks, see you Friday ', messageSid: 'SM1' });
    expect(result).toEqual({ status: 'recorded', conversationId: 'c1' });
    // The sms_messages trigger keeps the conversation's preview and unread count.
    expect(tables.sms_messages[0]).toMatchObject({ conversation_id: 'c1', direction: 'inbound', body: 'Thanks, see you Friday', provider_message_id: 'SM1', status: 'delivered', read_at: null });
  });

  it('records a retried webhook once', async () => {
    const tables: Record<string, Row[]> = {
      sms_conversations: [{ id: 'c1', portfolio_id: 'p1', with_phone_number: FROM, our_phone_number: TO, unread_count: 0, archived_at: null }],
      sms_messages: [{ id: 'm1', provider_message_id: 'SM1' }],
    };
    await expect(recordInboundReply(fakeDb(tables), { from: FROM, to: TO, body: 'Hi', messageSid: 'SM1' })).resolves.toEqual({ status: 'duplicate' });
    expect(tables.sms_messages).toHaveLength(1);
  });

  it('refuses to guess between two companies', async () => {
    const tables: Record<string, Row[]> = {
      sms_conversations: [
        { id: 'c1', portfolio_id: 'p1', with_phone_number: FROM, our_phone_number: '+15555550111', unread_count: 0, archived_at: null },
        { id: 'c2', portfolio_id: 'p2', with_phone_number: FROM, our_phone_number: '+15555550122', unread_count: 0, archived_at: null },
      ],
      sms_messages: [],
    };
    await expect(recordInboundReply(fakeDb(tables), { from: FROM, to: TO, body: 'Hi', messageSid: 'SM2' })).resolves.toMatchObject({ status: 'ambiguous', portfolioIds: ['p1', 'p2'] });
    expect(tables.sms_messages).toHaveLength(0);
  });

  it('starts a conversation for a sender known to one company, and ignores strangers', async () => {
    const known: Record<string, Row[]> = {
      sms_conversations: [],
      sms_messages: [],
      sms_opt_ins: [{ portfolio_id: 'p1', entity_type: 'owner', entity_id: 'o1', phone_number: FROM }],
      owners: [{ id: 'o1', full_name: 'Liam Owner' }],
      occupancies: [{ owner_id: 'o1', occupancy_type: 'owner', status: 'current', association_id: 'a1' }],
    };
    const result = await recordInboundReply(fakeDb(known), { from: FROM, to: TO, body: 'Hello', messageSid: 'SM3' });
    expect(result.status).toBe('recorded');
    // In the owner's association, so managers of other associations don't see it.
    expect(known.sms_conversations[0]).toMatchObject({ portfolio_id: 'p1', association_id: 'a1', with_entity_id: 'o1', with_name: 'Liam Owner' });

    const strangers: Record<string, Row[]> = { sms_conversations: [], sms_messages: [], sms_opt_ins: [] };
    await expect(recordInboundReply(fakeDb(strangers), { from: FROM, to: TO, body: 'Hello', messageSid: 'SM4' }))
      .resolves.toEqual({ status: 'ignored', reason: 'unknown sender' });
  });

  it('matches the company that texted from the number, when a Messaging Service picked it', async () => {
    const tables: Record<string, Row[]> = {
      // Both conversations hold the placeholder; company B actually texted them from TO.
      sms_conversations: [
        { id: 'c1', portfolio_id: 'pA', with_phone_number: FROM, our_phone_number: 'messaging-service', archived_at: null },
        { id: 'c2', portfolio_id: 'pB', with_phone_number: FROM, our_phone_number: 'messaging-service', archived_at: null },
      ],
      sms_messages: [
        { id: 'm1', conversation_id: 'c1', direction: 'outbound', provider_from_number: '+15555550111', to_number: FROM },
        { id: 'm2', conversation_id: 'c2', direction: 'outbound', provider_from_number: TO, to_number: FROM },
      ],
    };
    await expect(recordInboundReply(fakeDb(tables), { from: FROM, to: TO, body: 'Yes', messageSid: 'SM6' }))
      .resolves.toEqual({ status: 'recorded', conversationId: 'c2' });
  });

  it('does not trust a sender number staff can edit', async () => {
    const tables: Record<string, Row[]> = {
      // Company A's staff typed the number into their conversation and message.
      sms_conversations: [{ id: 'c1', portfolio_id: 'pA', with_phone_number: FROM, our_phone_number: TO, archived_at: null }],
      sms_opt_ins: [{ portfolio_id: 'pB', entity_type: 'owner', entity_id: 'o9', phone_number: FROM }],
      sms_messages: [{ id: 'm1', conversation_id: 'c1', direction: 'outbound', from_number: TO, to_number: FROM }],
    };
    await expect(recordInboundReply(fakeDb(tables), { from: FROM, to: TO, body: 'Hi', messageSid: 'SM7' }))
      .resolves.toMatchObject({ status: 'ambiguous' });
    expect(tables.sms_messages).toHaveLength(1);
  });

  it('does not file a text with one company when another company also knows the sender', async () => {
    const tables: Record<string, Row[]> = {
      // An old conversation at company A; the sender now texts company B's number.
      sms_conversations: [{ id: 'c1', portfolio_id: 'pA', with_phone_number: FROM, our_phone_number: '+15555550111', archived_at: null }],
      sms_opt_ins: [{ portfolio_id: 'pB', entity_type: 'owner', entity_id: 'o9', phone_number: FROM }],
      sms_messages: [],
    };
    await expect(recordInboundReply(fakeDb(tables), { from: FROM, to: TO, body: 'Hi', messageSid: 'SM5' }))
      .resolves.toMatchObject({ status: 'ambiguous' });
    expect(tables.sms_messages).toHaveLength(0);
  });
});
