// In-house maintenance team scoreboard: per staff member, what they have open,
// what they finished in the window, how fast, and the labor they logged.
// Pure — the page loads rows (RLS-scoped) and passes them in.

const DAY_MS = 86_400_000;
const CLOSED = new Set(['done', 'completed', 'billed', 'closed', 'cancelled']);
const FINISHED = new Set(['done', 'completed', 'billed', 'closed']);

export interface TeamWorkOrder {
  id: string;
  assignee_id: string | null;
  vendor_id?: string | null;
  status: string;
  priority: string | null;
  created_at: string;
  scheduled_date: string | null;
  completed_date: string | null;
}

export interface TeamLaborEntry {
  tech_id: string | null;
  tech_name: string | null;
  date_worked: string;
  hours: number | string | null;
  labor_cost: number | string | null;
}

export interface TeamMemberStats {
  id: string;
  name: string;
  open: number;
  overdue: number;
  completed: number;
  emergenciesCompleted: number;
  averageDaysToComplete: number | null;
  hours: number;
  laborCost: number;
  lastWorked: string | null;
}

export interface TeamScoreboard {
  members: TeamMemberStats[];
  /** Logged by someone who isn't a staff account (e.g. a day laborer typed by name). */
  otherLabor: { name: string; hours: number; laborCost: number }[];
  /** Open work orders with neither an in-house assignee nor a vendor. */
  unassignedOpen: number;
}

export function buildTeamScoreboard(opts: {
  staff: { id: string; name: string }[];
  workOrders: TeamWorkOrder[];
  labor: TeamLaborEntry[];
  since: string; // YYYY-MM-DD — window start for completions and labor
  today: string; // YYYY-MM-DD
}): TeamScoreboard {
  const { staff, workOrders, labor, since, today } = opts;
  const byId = new Map<string, TeamMemberStats>();
  const member = (id: string, name: string) => {
    let m = byId.get(id);
    if (!m) {
      m = { id, name, open: 0, overdue: 0, completed: 0, emergenciesCompleted: 0, averageDaysToComplete: null, hours: 0, laborCost: 0, lastWorked: null };
      byId.set(id, m);
    }
    return m;
  };
  for (const s of staff) member(s.id, s.name);

  const completionDays = new Map<string, number[]>();
  let unassignedOpen = 0;
  for (const wo of workOrders) {
    const open = !CLOSED.has(wo.status);
    if (!wo.assignee_id) {
      if (open && !wo.vendor_id) unassignedOpen += 1;
      continue;
    }
    const m = member(wo.assignee_id, 'Former staff');
    if (open) {
      m.open += 1;
      if (wo.scheduled_date && wo.scheduled_date < today) m.overdue += 1;
    } else if (FINISHED.has(wo.status) && wo.completed_date && wo.completed_date >= since) {
      m.completed += 1;
      if (wo.priority === 'emergency') m.emergenciesCompleted += 1;
      const days = (Date.parse(wo.completed_date) - Date.parse(wo.created_at.slice(0, 10))) / DAY_MS;
      if (Number.isFinite(days) && days >= 0) completionDays.set(m.id, [...(completionDays.get(m.id) ?? []), days]);
    }
  }
  for (const [id, days] of completionDays) {
    const m = byId.get(id)!;
    m.averageDaysToComplete = Math.round((days.reduce((a, b) => a + b, 0) / days.length) * 10) / 10;
  }

  const other = new Map<string, { name: string; hours: number; laborCost: number }>();
  for (const entry of labor) {
    if (entry.date_worked < since) continue;
    const hours = Number(entry.hours ?? 0) || 0;
    const cost = Number(entry.labor_cost ?? 0) || 0;
    if (entry.tech_id) {
      const m = member(entry.tech_id, entry.tech_name?.trim() || 'Former staff');
      m.hours += hours;
      m.laborCost += cost;
      if (!m.lastWorked || entry.date_worked > m.lastWorked) m.lastWorked = entry.date_worked;
    } else {
      const name = entry.tech_name?.trim() || 'Unnamed';
      const key = name.toLowerCase();
      const o = other.get(key) ?? { name, hours: 0, laborCost: 0 };
      o.hours += hours;
      o.laborCost += cost;
      other.set(key, o);
    }
  }

  const round = (n: number) => Math.round(n * 100) / 100;
  const members = [...byId.values()]
    .map((m) => ({ ...m, hours: round(m.hours), laborCost: round(m.laborCost) }))
    .filter((m) => m.open || m.completed || m.hours || staff.some((s) => s.id === m.id))
    .sort((a, b) => b.completed - a.completed || b.open - a.open || a.name.localeCompare(b.name));
  return {
    members,
    otherLabor: [...other.values()].map((o) => ({ ...o, hours: round(o.hours), laborCost: round(o.laborCost) })).sort((a, b) => b.hours - a.hours),
    unassignedOpen,
  };
}
