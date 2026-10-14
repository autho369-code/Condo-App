import 'server-only';

// A text a homeowner or vendor sends back (anything but STOP/START) goes into
// their SMS conversation, so staff see it in the SMS inbox. It used to be
// acknowledged and dropped.

const E164 = /^\+[1-9]\d{7,14}$/;

export type InboundReplyResult =
  | { status: 'recorded'; conversationId: string }
  | { status: 'duplicate' }
  | { status: 'ignored'; reason: string }
  | { status: 'ambiguous'; portfolioIds: string[] };

export async function recordInboundReply(
  db: any,
  input: { from: string; to: string; body: string; messageSid: string | null },
): Promise<InboundReplyResult> {
  const body = input.body.trim().slice(0, 1600);
  if (!E164.test(input.from)) return { status: 'ignored', reason: 'invalid sender' };
  if (!body) return { status: 'ignored', reason: 'empty message' };

  // Twilio retries a webhook it didn't see answered: one message, one row.
  if (input.messageSid) {
    const { data: seen, error: seenError } = await db.from('sms_messages')
      .select('id').eq('provider_message_id', input.messageSid).limit(1);
    if (seenError) throw new Error(seenError.message);
    if ((seen ?? []).length > 0) return { status: 'duplicate' };
  }

  const [{ data: conversations, error: convError }, { data: optIns, error: optError }] = await Promise.all([
    db.from('sms_conversations')
      .select('id, portfolio_id, our_phone_number, last_message_at')
      .eq('with_phone_number', input.from)
      .is('archived_at', null)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .limit(20),
    db.from('sms_opt_ins')
      .select('portfolio_id, entity_type, entity_id')
      .eq('phone_number', input.from)
      .in('entity_type', ['owner', 'vendor'])
      .limit(10),
  ]);
  if (convError) throw new Error(convError.message);
  if (optError) throw new Error(optError.message);
  let candidates = (conversations ?? []) as any[];
  const known = (optIns ?? []) as any[];

  // Every company that knows this sender, by a conversation or their texting
  // consent. With more than one, only the number they texted decides.
  const companies = [...new Set([...candidates, ...known].map((x) => x.portfolio_id as string))];
  if (companies.length > 1) {
    candidates = input.to ? candidates.filter((c) => c.our_phone_number === input.to) : [];
    if (candidates.length === 0 || new Set(candidates.map((c) => c.portfolio_id)).size > 1) {
      return { status: 'ambiguous', portfolioIds: companies };
    }
  }

  // Within the company, the conversation from the number they texted, else
  // the most recent one.
  let conversation = candidates.find((c) => input.to && c.our_phone_number === input.to) ?? candidates[0] ?? null;
  if (!conversation) {
    // No thread yet: start one for a sender known to the company by exactly
    // one consent record, in that owner's or vendor's association (managers
    // scoped to other associations must not see it).
    if (known.length === 0) return { status: 'ignored', reason: 'unknown sender' };
    if (known.length !== 1) return { status: 'ambiguous', portfolioIds: companies };
    const who = known[0];
    let name: string | null = null;
    let associationId: string | null = null;
    if (who.entity_type === 'owner') {
      const [{ data: owner }, { data: occ }] = await Promise.all([
        db.from('owners').select('full_name').eq('id', who.entity_id).maybeSingle(),
        db.from('occupancies').select('association_id')
          .eq('owner_id', who.entity_id).eq('occupancy_type', 'owner').eq('status', 'current')
          .not('association_id', 'is', null)
          .order('created_at', { ascending: true }).limit(1).maybeSingle(),
      ]);
      name = owner?.full_name ?? null;
      associationId = occ?.association_id ?? null;
    } else {
      const { data: vendor } = await db.from('vendors').select('name, association_id').eq('id', who.entity_id).maybeSingle();
      name = vendor?.name ?? null;
      associationId = vendor?.association_id ?? null;
    }
    const { data: created, error: createError } = await db.from('sms_conversations').insert({
      portfolio_id: who.portfolio_id,
      association_id: associationId,
      with_entity_type: who.entity_type,
      with_entity_id: who.entity_id,
      with_name: name,
      with_phone_number: input.from,
      our_phone_number: input.to || null,
      unread_count: 0,
    }).select('id, portfolio_id, our_phone_number').single();
    if (createError || !created) throw new Error(createError?.message ?? 'Could not start the conversation');
    conversation = created;
  }

  // The conversation's last message, preview and unread count are kept by the
  // sms_messages trigger (sync_sms_conversation_on_message).
  const { error: insertError } = await db.from('sms_messages').insert({
    conversation_id: conversation.id,
    direction: 'inbound',
    body,
    from_number: input.from,
    to_number: input.to || conversation.our_phone_number || 'messaging-service',
    provider: 'twilio',
    provider_message_id: input.messageSid,
    // sms_status has no 'received': an inbound text has been delivered to us.
    status: 'delivered',
    sent_at: new Date().toISOString(),
    read_at: null,
  });
  if (insertError) {
    // Two retries at once: the unique message id keeps one.
    if (insertError.code === '23505') return { status: 'duplicate' };
    throw new Error(insertError.message);
  }
  return { status: 'recorded', conversationId: conversation.id };
}

/**
 * A text that matched more than one company is not filed with any of them
 * (it could reach the wrong company); each is told one arrived, without the
 * message itself, so staff can follow up.
 */
export async function logUnmatchedReply(db: any, portfolioIds: string[], from: string): Promise<void> {
  const masked = `ending in ${from.slice(-4)}`;
  const rows = portfolioIds.map((portfolioId) => ({
    portfolio_id: portfolioId,
    channel: 'sms',
    direction: 'inbound',
    status: 'failed',
    subject: 'Text message not matched to a conversation',
    body: `A text from the number ${masked} couldn't be matched to one conversation, so it wasn't added to the SMS inbox. Contact the sender to follow up.`,
  }));
  if (rows.length === 0) return;
  const { error } = await db.from('communications_log').insert(rows);
  if (error) throw new Error(error.message);
}
