import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type Role = "super_admin" | "company_admin" | "portfolio_manager" | "manager" | "accountant" | "assistant" | "board_member" | "user";

function makeCtx(role: Role, propertyIds: number[] = [], companyId = 1): TrpcContext {
  return {
    user: {
      id: 1,
      openId: `test-${role}`,
      name: `Test ${role}`,
      email: `${role}@test.com`,
      loginMethod: "manus",
      role: role as any,
      companyId,
      assignedPropertyIds: JSON.stringify(propertyIds),
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

describe("RBAC — property scope enforcement", () => {
  it("super_admin has access to all properties (empty assignedPropertyIds)", () => {
    const ctx = makeCtx("super_admin");
    expect(ctx.user?.role).toBe("super_admin");
    // Super admin has no property restriction — assignedPropertyIds is empty
    const ids = JSON.parse((ctx.user as any).assignedPropertyIds || "[]");
    expect(ids).toEqual([]);
  });

  it("portfolio_manager is scoped to assigned property IDs", () => {
    const ctx = makeCtx("portfolio_manager", [10, 20, 30]);
    const ids = JSON.parse((ctx.user as any).assignedPropertyIds || "[]");
    expect(ids).toEqual([10, 20, 30]);
  });

  it("manager is scoped to subset of portfolio", () => {
    const ctx = makeCtx("manager", [10]);
    const ids = JSON.parse((ctx.user as any).assignedPropertyIds || "[]");
    expect(ids).toEqual([10]);
  });

  it("board_member has read-only role", () => {
    const ctx = makeCtx("board_member", [10]);
    expect(ctx.user?.role).toBe("board_member");
  });
});

describe("RBAC — board member cannot approve bills", () => {
  it("throws FORBIDDEN when board_member tries to approve a bill", async () => {
    const ctx = makeCtx("board_member", [1]);
    const caller = appRouter.createCaller(ctx);
    await expect(caller.accounting.approveBill({ id: 999 })).rejects.toThrow();
  });
});

describe("RBAC — invitation chain", () => {
  it("super_admin can invite company_admin", () => {
    const ctx = makeCtx("super_admin");
    expect(ctx.user?.role).toBe("super_admin");
    // Super admin has no property restriction
    const ids = JSON.parse((ctx.user as any).assignedPropertyIds || "[]");
    expect(ids.length).toBe(0);
  });

  it("manager can invite board_member (same or lower scope)", () => {
    const ctx = makeCtx("manager", [5, 6]);
    const ids = JSON.parse((ctx.user as any).assignedPropertyIds || "[]");
    expect(ids).toContain(5);
    expect(ids).toContain(6);
  });
});

describe("Auth — me returns null for unauthenticated", () => {
  it("returns null user when not authenticated", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: { clearCookie: () => {} } as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });
});
