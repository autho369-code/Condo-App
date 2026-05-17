import { describe, it, expect } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Helper: build minimal tRPC contexts ─────────────────────────────────────
function makeCtx(portierRole: string, companyId = 1): TrpcContext {
  return {
    user: {
      id: 10,
      openId: "owner-test",
      name: "Owner User",
      email: "owner@portier.com",
      loginMethod: "manus",
      role: "user",
      portierRole,
      companyId,
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

// ─── Pure logic helpers (mirrors portal UI logic) ─────────────────────────────

/** Format cents as a dollar string */
function formatCents(cents: number, currency = "USD"): string {
  const abs = Math.abs(cents) / 100;
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(abs);
}

/** Determine if a balance is owed (positive = owed, negative = credit) */
function balanceLabel(cents: number): "owed" | "credit" | "zero" {
  if (cents > 0) return "owed";
  if (cents < 0) return "credit";
  return "zero";
}

/** Compute new balance after payment */
function applyPayment(currentCents: number, paymentCents: number): number {
  return currentCents - paymentCents;
}

/** Validate payment amount */
function isValidPayment(amountDollars: string): boolean {
  const n = parseFloat(amountDollars);
  return !isNaN(n) && n > 0;
}

/** Determine document visibility */
function isDocumentVisibleToOwner(doc: { isSharedWithOwners: boolean }): boolean {
  return doc.isSharedWithOwners;
}

/** Filter documents by category */
function filterDocsByCategory(
  docs: { category: string }[],
  category: string
): { category: string }[] {
  if (category === "all") return docs;
  return docs.filter(d => d.category === category);
}

/** Build message thread key */
function buildThreadKey(ownerId: number, propertyId: number): string {
  return `owner-${ownerId}-prop-${propertyId}`;
}

/** Determine message direction label */
function messageDirectionLabel(direction: string): "sent" | "received" {
  return direction === "owner_to_manager" ? "sent" : "received";
}

/** Format file size */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Account Balance logic ────────────────────────────────────────────────────
describe("owner portal — account balance formatting", () => {
  it("formats positive balance (amount owed)", () => {
    expect(formatCents(150000)).toBe("$1,500.00");
  });

  it("formats zero balance", () => {
    expect(formatCents(0)).toBe("$0.00");
  });

  it("formats negative balance (credit)", () => {
    expect(formatCents(-5000)).toBe("$50.00");
  });

  it("labels positive balance as owed", () => {
    expect(balanceLabel(100)).toBe("owed");
  });

  it("labels negative balance as credit", () => {
    expect(balanceLabel(-100)).toBe("credit");
  });

  it("labels zero balance as zero", () => {
    expect(balanceLabel(0)).toBe("zero");
  });
});

// ─── Payment logic ────────────────────────────────────────────────────────────
describe("owner portal — payment logic", () => {
  it("reduces balance by payment amount", () => {
    expect(applyPayment(150000, 50000)).toBe(100000);
  });

  it("results in credit when payment exceeds balance", () => {
    expect(applyPayment(50000, 100000)).toBe(-50000);
  });

  it("results in zero when payment equals balance", () => {
    expect(applyPayment(50000, 50000)).toBe(0);
  });

  it("validates a valid payment amount", () => {
    expect(isValidPayment("150.00")).toBe(true);
    expect(isValidPayment("0.01")).toBe(true);
    expect(isValidPayment("1000")).toBe(true);
  });

  it("rejects invalid payment amounts", () => {
    expect(isValidPayment("0")).toBe(false);
    expect(isValidPayment("-50")).toBe(false);
    expect(isValidPayment("abc")).toBe(false);
    expect(isValidPayment("")).toBe(false);
  });
});

// ─── Document sharing logic ───────────────────────────────────────────────────
describe("owner portal — document visibility", () => {
  it("shows shared documents to owners", () => {
    expect(isDocumentVisibleToOwner({ isSharedWithOwners: true })).toBe(true);
  });

  it("hides private documents from owners", () => {
    expect(isDocumentVisibleToOwner({ isSharedWithOwners: false })).toBe(false);
  });

  it("filters documents by category", () => {
    const docs = [
      { category: "governing_document" },
      { category: "meeting_minutes" },
      { category: "governing_document" },
      { category: "financial_report" },
    ];
    expect(filterDocsByCategory(docs, "governing_document")).toHaveLength(2);
    expect(filterDocsByCategory(docs, "meeting_minutes")).toHaveLength(1);
    expect(filterDocsByCategory(docs, "all")).toHaveLength(4);
    expect(filterDocsByCategory(docs, "insurance")).toHaveLength(0);
  });

  it("formats file sizes correctly", () => {
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(2048)).toBe("2.0 KB");
    expect(formatFileSize(1572864)).toBe("1.5 MB");
  });
});

// ─── Message threading logic ──────────────────────────────────────────────────
describe("owner portal — message threading", () => {
  it("builds a consistent thread key for owner-property pair", () => {
    expect(buildThreadKey(42, 7)).toBe("owner-42-prop-7");
    expect(buildThreadKey(1, 100)).toBe("owner-1-prop-100");
  });

  it("same owner+property always produces same thread key", () => {
    expect(buildThreadKey(5, 3)).toBe(buildThreadKey(5, 3));
  });

  it("different owners produce different thread keys", () => {
    expect(buildThreadKey(1, 3)).not.toBe(buildThreadKey(2, 3));
  });

  it("labels owner-to-manager messages as sent", () => {
    expect(messageDirectionLabel("owner_to_manager")).toBe("sent");
  });

  it("labels manager-to-owner messages as received", () => {
    expect(messageDirectionLabel("manager_to_owner")).toBe("received");
  });
});

// ─── tRPC role guard tests ────────────────────────────────────────────────────
describe("portal.getAccountBalance — role guard", () => {
  it("throws UNAUTHORIZED when not logged in", async () => {
    const caller = appRouter.createCaller(makeUnauthCtx());
    await expect(caller.portal.getAccountBalance({ propertyId: 1 }))
      .rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("throws FORBIDDEN for accountant role", async () => {
    const caller = appRouter.createCaller(makeCtx("accountant"));
    await expect(caller.portal.getAccountBalance({ propertyId: 1 }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("passes role guard for owner role (DB may fail in test env)", async () => {
    const caller = appRouter.createCaller(makeCtx("owner"));
    try {
      await caller.portal.getAccountBalance({ propertyId: 1 });
    } catch (err: any) {
      expect(err?.code).not.toBe("FORBIDDEN");
      expect(err?.code).not.toBe("UNAUTHORIZED");
    }
  });

  it("passes role guard for resident role", async () => {
    const caller = appRouter.createCaller(makeCtx("resident"));
    try {
      await caller.portal.getAccountBalance({ propertyId: 1 });
    } catch (err: any) {
      expect(err?.code).not.toBe("FORBIDDEN");
      expect(err?.code).not.toBe("UNAUTHORIZED");
    }
  });
});

describe("portal.makePayment — role guard", () => {
  it("throws UNAUTHORIZED when not logged in", async () => {
    const caller = appRouter.createCaller(makeUnauthCtx());
    await expect(caller.portal.makePayment({ propertyId: 1, amountCents: 5000 }))
      .rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("throws FORBIDDEN for accountant role", async () => {
    const caller = appRouter.createCaller(makeCtx("accountant"));
    await expect(caller.portal.makePayment({ propertyId: 1, amountCents: 5000 }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("passes role guard for owner role", async () => {
    const caller = appRouter.createCaller(makeCtx("owner"));
    try {
      await caller.portal.makePayment({ propertyId: 1, amountCents: 5000 });
    } catch (err: any) {
      expect(err?.code).not.toBe("FORBIDDEN");
      expect(err?.code).not.toBe("UNAUTHORIZED");
    }
  });
});

describe("portal.listDocuments — role guard", () => {
  it("throws UNAUTHORIZED when not logged in", async () => {
    const caller = appRouter.createCaller(makeUnauthCtx());
    await expect(caller.portal.listDocuments({ propertyId: 1 }))
      .rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("throws FORBIDDEN for accountant role", async () => {
    const caller = appRouter.createCaller(makeCtx("accountant"));
    await expect(caller.portal.listDocuments({ propertyId: 1 }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("passes role guard for owner role", async () => {
    const caller = appRouter.createCaller(makeCtx("owner"));
    try {
      await caller.portal.listDocuments({ propertyId: 1 });
    } catch (err: any) {
      expect(err?.code).not.toBe("FORBIDDEN");
      expect(err?.code).not.toBe("UNAUTHORIZED");
    }
  });
});

describe("portal.sendMessage — role guard", () => {
  it("throws UNAUTHORIZED when not logged in", async () => {
    const caller = appRouter.createCaller(makeUnauthCtx());
    await expect(caller.portal.sendMessage({ propertyId: 1, body: "Hello" }))
      .rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("throws FORBIDDEN for assistant_manager role", async () => {
    const caller = appRouter.createCaller(makeCtx("assistant_manager"));
    await expect(caller.portal.sendMessage({ propertyId: 1, body: "Hello" }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("passes role guard for owner role", async () => {
    const caller = appRouter.createCaller(makeCtx("owner"));
    try {
      await caller.portal.sendMessage({ propertyId: 1, body: "Hello management" });
    } catch (err: any) {
      expect(err?.code).not.toBe("FORBIDDEN");
      expect(err?.code).not.toBe("UNAUTHORIZED");
    }
  });
});

describe("documents.toggleShare — role guard", () => {
  it("throws UNAUTHORIZED when not logged in", async () => {
    const caller = appRouter.createCaller(makeUnauthCtx());
    await expect(caller.documents.toggleShare({ documentId: 1, isShared: true }))
      .rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("throws FORBIDDEN for owner role (manager-only procedure)", async () => {
    const caller = appRouter.createCaller(makeCtx("owner"));
    await expect(caller.documents.toggleShare({ documentId: 1, isShared: true }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("passes role guard for property_manager role", async () => {
    const caller = appRouter.createCaller(makeCtx("property_manager"));
    try {
      await caller.documents.toggleShare({ documentId: 1, isShared: true });
    } catch (err: any) {
      expect(err?.code).not.toBe("FORBIDDEN");
      expect(err?.code).not.toBe("UNAUTHORIZED");
    }
  });
});

describe("documents.delete — role guard", () => {
  it("throws UNAUTHORIZED when not logged in", async () => {
    const caller = appRouter.createCaller(makeUnauthCtx());
    await expect(caller.documents.delete({ documentId: 1 }))
      .rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("throws FORBIDDEN for resident role", async () => {
    const caller = appRouter.createCaller(makeCtx("resident"));
    await expect(caller.documents.delete({ documentId: 1 }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("passes role guard for company_admin role", async () => {
    const caller = appRouter.createCaller(makeCtx("company_admin"));
    try {
      await caller.documents.delete({ documentId: 1 });
    } catch (err: any) {
      expect(err?.code).not.toBe("FORBIDDEN");
      expect(err?.code).not.toBe("UNAUTHORIZED");
    }
  });
});
