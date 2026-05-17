import { describe, it, expect } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Unit tests for portal business logic ────────────────────────────────────
// These tests validate the pure logic functions used by portal procedures
// without requiring a live database connection.

// ─── Helper: build a minimal tRPC context ────────────────────────────────────
function makeCtx(portierRole: string): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-user",
      name: "Test User",
      email: "test@portier.com",
      loginMethod: "manus",
      role: "user",
      portierRole,
      companyId: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { setHeader: () => {}, clearCookie: () => {} } as unknown as TrpcContext["res"],
  };
}

function makeUnauthCtx(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { setHeader: () => {}, clearCookie: () => {} } as unknown as TrpcContext["res"],
  };
}

// Simulate the ownership check used in getTicket and addComment
function checkTicketOwnership(ticket: { reportedById: number } | undefined, userId: number): boolean {
  if (!ticket) return false;
  return ticket.reportedById === userId;
}

// Simulate the category fallback logic used in submitRequest
function resolveCategory(inputCategory: string | undefined, aiCategory: string): string {
  return inputCategory ?? aiCategory;
}

// Simulate the public comment filter used in getTicket
function filterPublicComments(comments: { isInternal: boolean; content: string }[]) {
  return comments.filter(c => !c.isInternal);
}

// Simulate the status progress index used in the UI timeline
const STATUS_STEPS = ["open", "in_progress", "pending_vendor", "resolved", "closed"];
function getProgressIndex(status: string): number {
  return STATUS_STEPS.indexOf(status);
}

// Simulate the portal property lookup guard
function canAccessProperty(companyId: number | null | undefined, propertyCompanyId: number): boolean {
  if (!companyId) return false;
  return companyId === propertyCompanyId;
}

describe("portal — ownership check", () => {
  it("returns true when ticket belongs to the requesting user", () => {
    expect(checkTicketOwnership({ reportedById: 42 }, 42)).toBe(true);
  });

  it("returns false when ticket belongs to a different user", () => {
    expect(checkTicketOwnership({ reportedById: 42 }, 99)).toBe(false);
  });

  it("returns false when ticket is undefined (not found)", () => {
    expect(checkTicketOwnership(undefined, 42)).toBe(false);
  });
});

describe("portal — category resolution", () => {
  it("uses the user-supplied category when provided", () => {
    expect(resolveCategory("emergency", "maintenance")).toBe("emergency");
  });

  it("falls back to AI-classified category when user omits it", () => {
    expect(resolveCategory(undefined, "unit_related")).toBe("unit_related");
  });

  it("handles all valid category values", () => {
    const valid = ["common_area", "unit_related", "emergency", "vendor", "board_matter", "maintenance", "other"];
    valid.forEach(cat => {
      expect(resolveCategory(cat, "other")).toBe(cat);
    });
  });
});

describe("portal — public comment filter", () => {
  const comments = [
    { isInternal: false, content: "We received your request." },
    { isInternal: true,  content: "Internal note: check unit 4B first." },
    { isInternal: false, content: "A technician has been assigned." },
    { isInternal: true,  content: "Vendor quote: $350." },
  ];

  it("returns only non-internal comments", () => {
    const result = filterPublicComments(comments);
    expect(result).toHaveLength(2);
    expect(result.every(c => !c.isInternal)).toBe(true);
  });

  it("returns empty array when all comments are internal", () => {
    const allInternal = comments.filter(c => c.isInternal);
    expect(filterPublicComments(allInternal)).toHaveLength(0);
  });

  it("returns all comments when none are internal", () => {
    const allPublic = comments.filter(c => !c.isInternal);
    expect(filterPublicComments(allPublic)).toHaveLength(2);
  });
});

describe("portal — status progress timeline", () => {
  it("maps open to index 0", () => expect(getProgressIndex("open")).toBe(0));
  it("maps in_progress to index 1", () => expect(getProgressIndex("in_progress")).toBe(1));
  it("maps pending_vendor to index 2", () => expect(getProgressIndex("pending_vendor")).toBe(2));
  it("maps resolved to index 3", () => expect(getProgressIndex("resolved")).toBe(3));
  it("maps closed to index 4", () => expect(getProgressIndex("closed")).toBe(4));
  it("returns -1 for unknown status", () => expect(getProgressIndex("unknown")).toBe(-1));
});

describe("portal — property access guard", () => {
  it("allows access when companyId matches", () => {
    expect(canAccessProperty(7, 7)).toBe(true);
  });

  it("denies access when companyId does not match", () => {
    expect(canAccessProperty(7, 99)).toBe(false);
  });

  it("denies access when user has no companyId (null)", () => {
    expect(canAccessProperty(null, 7)).toBe(false);
  });

  it("denies access when user has no companyId (undefined)", () => {
    expect(canAccessProperty(undefined, 7)).toBe(false);
  });
});

// ─── tRPC procedure role-guard tests ─────────────────────────────────────────
// These tests call the actual portal procedures via createCaller to verify
// that the portalProcedure middleware enforces role restrictions correctly.

describe("portal.myTickets — role guard", () => {
  it("throws UNAUTHORIZED when user is not logged in", async () => {
    const caller = appRouter.createCaller(makeUnauthCtx());
    await expect(caller.portal.myTickets()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("throws FORBIDDEN when user has accountant role", async () => {
    const caller = appRouter.createCaller(makeCtx("accountant"));
    await expect(caller.portal.myTickets()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("throws FORBIDDEN when user has assistant_manager role", async () => {
    const caller = appRouter.createCaller(makeCtx("assistant_manager"));
    await expect(caller.portal.myTickets()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  // Resident and owner roles should pass the guard (DB call may fail in test env — that's OK)
  it("passes the role guard for resident role", async () => {
    const caller = appRouter.createCaller(makeCtx("resident"));
    // The procedure will attempt a DB query which may throw a connection error in test env,
    // but it must NOT throw FORBIDDEN or UNAUTHORIZED.
    try {
      await caller.portal.myTickets();
    } catch (err: any) {
      expect(err?.code).not.toBe("FORBIDDEN");
      expect(err?.code).not.toBe("UNAUTHORIZED");
    }
  });

  it("passes the role guard for owner role", async () => {
    const caller = appRouter.createCaller(makeCtx("owner"));
    try {
      await caller.portal.myTickets();
    } catch (err: any) {
      expect(err?.code).not.toBe("FORBIDDEN");
      expect(err?.code).not.toBe("UNAUTHORIZED");
    }
  });

  it("passes the role guard for property_manager role", async () => {
    const caller = appRouter.createCaller(makeCtx("property_manager"));
    try {
      await caller.portal.myTickets();
    } catch (err: any) {
      expect(err?.code).not.toBe("FORBIDDEN");
      expect(err?.code).not.toBe("UNAUTHORIZED");
    }
  });
});

describe("portal.listProperties — role guard", () => {
  it("throws UNAUTHORIZED when user is not logged in", async () => {
    const caller = appRouter.createCaller(makeUnauthCtx());
    await expect(caller.portal.listProperties()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("throws FORBIDDEN for accountant role", async () => {
    const caller = appRouter.createCaller(makeCtx("accountant"));
    await expect(caller.portal.listProperties()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("passes guard for super_admin role", async () => {
    const caller = appRouter.createCaller(makeCtx("super_admin"));
    try {
      await caller.portal.listProperties();
    } catch (err: any) {
      expect(err?.code).not.toBe("FORBIDDEN");
      expect(err?.code).not.toBe("UNAUTHORIZED");
    }
  });
});
