-- SMS reply routing (Codex and security review on #369).
--
-- With a Twilio Messaging Service, Twilio picks the sending number. A reply
-- from a number several companies know goes to the company that texted them
-- from the number they replied to. That proof must be one staff can't write:
-- sms_messages.from_number and sms_conversations.our_phone_number are
-- editable by the company's staff (another company could claim a customer's
-- replies). provider_from_number is the number Twilio reports it used, set
-- only by the delivery cron and the status callback (service role).

alter table public.sms_messages add column if not exists provider_from_number text;

comment on column public.sms_messages.provider_from_number is
  'The number Twilio sent this message from (from its API or status callback). Set only by the server; replies are routed by it.';

-- A definer RPC signed-in users can call must never write provider_from_number
-- from a value the caller passes. Messages sent before this have it null (none
-- existed live), so no backfill: from_number is staff-editable.

-- Signed-in users can't set or change it, and can't move a message once
-- written: the recipient, conversation, direction and Twilio id are what
-- replies are matched on, and a message can be mid-send (claimed, not yet
-- given its Twilio id) at any moment (security review). The app never
-- changes them; the server and definer functions still can.
create or replace function public.sms_messages_guard_provider_from()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $function$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.provider_from_number := null;
      new.provider_message_id := null;
    else
      new.provider_from_number := old.provider_from_number;
      new.provider_message_id := old.provider_message_id;
      new.to_number := old.to_number;
      new.conversation_id := old.conversation_id;
      new.direction := old.direction;
    end if;
  end if;
  return new;
end $function$;

revoke all on function public.sms_messages_guard_provider_from() from public, anon, authenticated;

drop trigger if exists sms_messages_guard_provider_from on public.sms_messages;
create trigger sms_messages_guard_provider_from
  before insert or update on public.sms_messages
  for each row execute function public.sms_messages_guard_provider_from();

create index if not exists sms_messages_reply_routing_idx
  on public.sms_messages(conversation_id, provider_from_number, to_number)
  where direction = 'outbound' and provider_from_number is not null;

-- Every company that knows a phone number (a conversation or texting
-- consent), without a row cap one company's rows could fill.
create or replace function public.sms_sender_companies(p_phone text)
returns setof uuid
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select c.portfolio_id from public.sms_conversations c
   where c.with_phone_number = p_phone and c.portfolio_id is not null
  union
  select o.portfolio_id from public.sms_opt_ins o
   where o.phone_number = p_phone and o.entity_type in ('owner', 'vendor') and o.portfolio_id is not null
$function$;

-- The conversations in which we texted this person from the number they
-- replied to, as Twilio reported it.
create or replace function public.sms_reply_conversations(p_from text, p_to text)
returns table (id uuid, portfolio_id uuid, archived_at timestamptz, last_message_at timestamptz)
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select c.id, c.portfolio_id, c.archived_at, c.last_message_at
    from public.sms_conversations c
   where c.with_phone_number = p_from
     and exists (
       select 1 from public.sms_messages m
        where m.conversation_id = c.id and m.direction = 'outbound'
          and m.provider_from_number = p_to and m.to_number = p_from)
$function$;

revoke all on function public.sms_sender_companies(text) from public, anon, authenticated;
revoke all on function public.sms_reply_conversations(text, text) from public, anon, authenticated;
grant execute on function public.sms_sender_companies(text) to service_role;
grant execute on function public.sms_reply_conversations(text, text) to service_role;
