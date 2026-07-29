-- Piper's teachable knowledge base. Pinned+active entries are injected into
-- her system prompt on every call; the rest are reachable via her
-- search_knowledge tool. Editing rows changes what she knows immediately —
-- no redeploy.
create table if not exists public.receptionist_knowledge (
  id uuid primary key default gen_random_uuid(),
  category text not null default 'general',
  title text not null,
  body text not null,
  pinned boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists receptionist_knowledge_fts
  on public.receptionist_knowledge
  using gin (to_tsvector('english', title || ' ' || body));

alter table public.receptionist_knowledge enable row level security;

drop policy if exists receptionist_knowledge_operator_all on public.receptionist_knowledge;
create policy receptionist_knowledge_operator_all on public.receptionist_knowledge
  for all
  using (public.is_platform_operator())
  with check (public.is_platform_operator());

-- Ranked search for Piper's tool (service role calls this)
create or replace function public.receptionist_knowledge_search(q text, max_rows int default 3)
returns table (title text, body text, category text)
language sql
stable
security definer
set search_path = public
as $$
  select k.title, k.body, k.category
  from receptionist_knowledge k
  where k.active
    and to_tsvector('english', k.title || ' ' || k.body) @@ plainto_tsquery('english', q)
  order by ts_rank(to_tsvector('english', k.title || ' ' || k.body), plainto_tsquery('english', q)) desc
  limit greatest(1, least(max_rows, 5));
$$;

revoke execute on function public.receptionist_knowledge_search(text, int) from public, anon;
grant execute on function public.receptionist_knowledge_search(text, int) to service_role, authenticated;

-- Seed with Piper's launch facts (teachable from the console hereafter)
insert into public.receptionist_knowledge (category, title, body, pinned) values
('pricing', 'Pricing plans', 'Foundation: $157 per month, up to 200 units. Growth: $382 per month, up to 600 units. Portfolio: $642 per month, up to 1,000 units. Enterprise: custom pricing for 1,000+ units and multi-office operations. Every plan includes every feature, unlimited owners, board members, and vendors. Month to month, no implementation fees, no long-term contract.', true),
('product', 'What Portier369 includes', 'Full double-entry accounting with budgets and automatic late fees; owner assessments and ledgers with print/CSV/PDF export; work orders and vendor management with in-app discussion threads; violations with photo evidence, notices, hearings, fines, and mobile field capture with GPS; architectural review requests with document uploads and board e-signatures; insurance tracking with automatic 30-day and 15-day expiry email reminders; board approvals with electronic signatures; document management with a governing-documents checklist; workflow automation called Flows; and AI features on every plan using the customer''s own AI provider key.', true),
('product', 'Portals and single login', 'Six portals on one login system: management company admin, property manager, board member, homeowner, vendor, and platform operator. An owner who serves on their board gets both portals with one login. Everything owners and vendors see is white-labeled to the management company''s brand.', true),
('sales', 'Migration and onboarding', 'Guided migration is included from AppFolio, Buildium, TOPS, Vantaca, CINC, PayHOA, or spreadsheets: associations, units, owners, balances, and documents are imported with the customer. White-glove setup on every plan; a first association is typically live within a week.', true),
('company', 'Company basics', 'Portier369 is based in Chicago, Illinois. Website: portier369.com. Business hours Monday through Friday, nine to five Central. Demos are booked at portier369.com/demo or by leaving details with Piper.', true),
('product', 'Flows automation', 'Flows lets managers define trigger-to-action rules the system runs hourly — for example: a dues charge 15 days overdue automatically emails the owner, assesses the configured late fee, and alerts the manager. Each rule fires at most once per case and keeps a full audit log.', false),
('sales', 'How Portier369 compares to AppFolio', 'AppFolio prices per unit with monthly minimums around $280 and gates AI behind its most expensive tier; Portier369 is flat per-door from $157 all-inclusive with AI included. Portier369 is association-only — no rental or leasing tooling you pay for but never use. Honest comparison pages are at portier369.com/compare.', false);
;
