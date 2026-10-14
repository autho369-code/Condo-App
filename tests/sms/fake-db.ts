export type Row = Record<string, any>;

/** Minimal chainable stand-in for the service client. */
export function fakeDb(tables: Record<string, Row[]>) {
  function builder(table: string) {
    const state: { op: string; payload?: any; filters: [string, string, any][] } = { op: 'select', filters: [] };
    const rows = () => (tables[table] ?? []).filter((r) => state.filters.every(([k, c, v]) => {
      if (k === 'eq') return r[c] === v;
      if (k === 'is') return (r[c] ?? null) === v;
      if (k === 'in') return (v as any[]).includes(r[c]);
      if (k === 'not_null') return r[c] != null;
      return true;
    }));
    const run = () => {
      if (state.op === 'insert') {
        const added = { id: `${table}-${(tables[table]?.length ?? 0) + 1}`, ...state.payload };
        (tables[table] ??= []).push(added);
        return { data: added, error: null };
      }
      if (state.op === 'update') {
        const hit = rows();
        hit.forEach((r) => Object.assign(r, state.payload));
        return { data: hit, error: null };
      }
      return { data: rows(), error: null };
    };
    const b: any = {
      select() { return b; },
      insert(p: any) { state.op = 'insert'; state.payload = p; return b; },
      update(p: any) { state.op = 'update'; state.payload = p; return b; },
      eq(c: string, v: any) { state.filters.push(['eq', c, v]); return b; },
      is(c: string, v: any) { state.filters.push(['is', c, v]); return b; },
      in(c: string, v: any[]) { state.filters.push(['in', c, v]); return b; },
      not(c: string) { state.filters.push(['not_null', c, null]); return b; },
      order() { return b; },
      limit() { return b; },
      async single() { return run(); },
      async maybeSingle() { const r = run(); return { data: Array.isArray(r.data) ? r.data[0] ?? null : r.data, error: null }; },
      then(resolve: any) { resolve(run()); },
    };
    return b;
  }
  const rpcCalls: { fn: string; args: any }[] = [];
  return { from: (t: string) => builder(t), rpc: async (fn: string, args: any) => {
    rpcCalls.push({ fn, args });
    // Same rows the server-only routing functions return.
    if (fn === 'sms_sender_companies') {
      const ids = [
        ...(tables.sms_conversations ?? []).filter((c) => c.with_phone_number === args.p_phone).map((c) => c.portfolio_id),
        ...(tables.sms_opt_ins ?? []).filter((o) => o.phone_number === args.p_phone && ['owner', 'vendor'].includes(o.entity_type)).map((o) => o.portfolio_id),
      ];
      return { data: [...new Set(ids)], error: null };
    }
    if (fn === 'sms_reply_conversations') {
      const data = (tables.sms_conversations ?? []).filter((c) => c.with_phone_number === args.p_from
        && (tables.sms_messages ?? []).some((m) => m.conversation_id === c.id && m.direction === 'outbound'
          && m.provider_from_number === args.p_to && m.to_number === args.p_from))
        .map((c) => ({ id: c.id, portfolio_id: c.portfolio_id, archived_at: c.archived_at ?? null, last_message_at: c.last_message_at ?? null }));
      return { data, error: null };
    }
    return { data: null, error: null };
  }, rpcCalls };
}
