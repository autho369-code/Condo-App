import { describe, it, expect } from "vitest";

// ─── Pure helpers mirrored from KanbanBoard.tsx ───────────────────────────────

type TicketStatus = "open" | "in_progress" | "pending_vendor" | "resolved" | "closed";

const COLUMNS: TicketStatus[] = ["open", "in_progress", "pending_vendor", "resolved", "closed"];

function normalizeStatus(raw: string | null | undefined): TicketStatus {
  if (!raw) return "open";
  if (COLUMNS.includes(raw as TicketStatus)) return raw as TicketStatus;
  return "open";
}

function groupByStatus(tickets: { id: number; status: string | null }[]) {
  const groups: Record<TicketStatus, number[]> = {
    open: [],
    in_progress: [],
    pending_vendor: [],
    resolved: [],
    closed: [],
  };
  for (const t of tickets) {
    const col = normalizeStatus(t.status);
    groups[col].push(t.id);
  }
  return groups;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("normalizeStatus", () => {
  it("returns 'open' for null", () => {
    expect(normalizeStatus(null)).toBe("open");
  });

  it("returns 'open' for undefined", () => {
    expect(normalizeStatus(undefined)).toBe("open");
  });

  it("returns 'open' for an unknown status string", () => {
    expect(normalizeStatus("unknown_status")).toBe("open");
  });

  it("passes through valid statuses unchanged", () => {
    for (const s of COLUMNS) {
      expect(normalizeStatus(s)).toBe(s);
    }
  });
});

describe("groupByStatus", () => {
  it("groups tickets into the correct columns", () => {
    const tickets = [
      { id: 1, status: "open" },
      { id: 2, status: "in_progress" },
      { id: 3, status: "pending_vendor" },
      { id: 4, status: "resolved" },
      { id: 5, status: "closed" },
    ];
    const groups = groupByStatus(tickets);
    expect(groups.open).toContain(1);
    expect(groups.in_progress).toContain(2);
    expect(groups.pending_vendor).toContain(3);
    expect(groups.resolved).toContain(4);
    expect(groups.closed).toContain(5);
  });

  it("places tickets with null status into 'open'", () => {
    const tickets = [{ id: 10, status: null }];
    const groups = groupByStatus(tickets);
    expect(groups.open).toContain(10);
  });

  it("places tickets with invalid status into 'open'", () => {
    const tickets = [{ id: 11, status: "legacy_status" }];
    const groups = groupByStatus(tickets);
    expect(groups.open).toContain(11);
  });

  it("handles an empty ticket list", () => {
    const groups = groupByStatus([]);
    for (const col of COLUMNS) {
      expect(groups[col]).toHaveLength(0);
    }
  });

  it("correctly distributes multiple tickets per column", () => {
    const tickets = [
      { id: 1, status: "open" },
      { id: 2, status: "open" },
      { id: 3, status: "resolved" },
    ];
    const groups = groupByStatus(tickets);
    expect(groups.open).toHaveLength(2);
    expect(groups.resolved).toHaveLength(1);
  });
});

describe("COLUMNS order", () => {
  it("has exactly 5 columns in workflow order", () => {
    expect(COLUMNS).toHaveLength(5);
    expect(COLUMNS[0]).toBe("open");
    expect(COLUMNS[4]).toBe("closed");
  });
});
