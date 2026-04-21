# Schema Gaps — Follow-Up

## Missing from AppFolio vs our DB

### Add to `owners` table
- `pets` jsonb — array of {name, type, breed, notes}
- `mailing_address_override` boolean — if different from unit address

### Add to `units` table  
- `home_warranty_company` text
- `home_warranty_expires` date
- `notes` text
- `bathrooms` smallint (only bedrooms exists currently)

### Missing tables to create

#### `maintenance_projects`
For multi-WO scoped projects (e.g. "Roof Replacement 2026")
```sql
create table maintenance_projects (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid references portfolios(id),
  association_id uuid references associations(id),
  title text not null,
  description text,
  budget numeric(14,2),
  status text default 'planning', -- planning, active, complete, cancelled
  start_date date,
  end_date date,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);
-- Then add project_id FK to work_orders
```

#### `inventory_items`
For maintenance supply tracking
```sql
create table inventory_items (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid references portfolios(id),
  name text not null,
  description text,
  sku text,
  unit_of_measure text,
  quantity_on_hand numeric,
  reorder_point numeric,
  unit_cost numeric(14,2),
  location text,
  created_at timestamptz default now()
);
```

#### `unit_turns`
Track unit move-out/move-in preparation
```sql
create table unit_turns (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid references units(id),
  association_id uuid references associations(id),
  move_out_date date,
  move_in_date date,
  status text default 'pending', -- pending, in_progress, complete
  notes text,
  created_at timestamptz default now()
);
```

### Tables to DELETE (orphaned, unrelated to HOA)
- `shares` — AI agent sharing, not relevant
- `workflows` — AI workflows, not relevant  
- `agents` — AI agents, not relevant

### RLS Gaps
- Most tables need INSERT/UPDATE/DELETE policies (not just SELECT)
- `vendors` — needs portfolio_id check on all operations
- `work_orders` — vendor should only see their own WOs
- `violations` — owners should only see their own unit's violations
