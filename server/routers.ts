import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import { reportsRouter } from "./routers/reports";
import { z } from "zod";
import {
  acceptInvitation,
  approveBill,
  createCompany,
  createInvitation,
  getAllCompanies,
  getAllInvitations,
  getAllUsers,
  getBankAccounts,
  getDashboardStats,
  getDiagnosticFlags,
  getGlAccounts,
  getInvitationByToken,
  getInvitationsByInviter,
  getOwners,
  createOwner,
  createVendor,
  getProperties,
  getRecentActivity,
  getScheduledReports,
  getTransactions,
  getVendors,
  getUserByOpenId,
  logActivity,
  revokeInvitation,
  upsertUser,
  getAccessiblePropertyIds,
  updateUserRole,
} from "./db";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";

// ─── RBAC MIDDLEWARE FACTORIES ────────────────────────────────────────────────
const WRITE_ROLES = ["super_admin", "company_admin", "portfolio_manager", "manager", "accountant", "assistant", "admin"];
const MANAGER_ROLES = ["super_admin", "company_admin", "portfolio_manager", "manager", "accountant", "assistant", "admin"];
const ADMIN_ROLES = ["super_admin", "admin"];
const INVITE_ROLES = ["super_admin", "manager", "portfolio_manager", "admin"];

function requireRole(allowedRoles: string[]) {
  return protectedProcedure.use(({ ctx, next }) => {
    if (!allowedRoles.includes(ctx.user.role)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Insufficient permissions" });
    }
    return next({ ctx });
  });
}

const superAdminProcedure = requireRole(ADMIN_ROLES);
const writeProcedure = requireRole(WRITE_ROLES);
const managerProcedure = requireRole(MANAGER_ROLES);
const inviteProcedure = requireRole(INVITE_ROLES);

// ─── MAIN ROUTER ──────────────────────────────────────────────────────────────
export const appRouter = router({
  system: systemRouter,

  // ─── AUTH ────────────────────────────────────────────────────────────────
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ─── COMPANIES ───────────────────────────────────────────────────────────
  companies: router({
    list: superAdminProcedure.query(() => getAllCompanies()),
    create: superAdminProcedure
      .input(
        z.object({
          name: z.string().min(1),
          code: z.string().min(1),
          email: z.string().email().optional(),
          phone: z.string().optional(),
          address: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        await createCompany(input);
        await logActivity({ userId: ctx.user.id, activityType: "property_updated", title: `Company "${input.name}" created` });
        return { success: true };
      }),
  }),

  // ─── PROPERTIES ──────────────────────────────────────────────────────────
  properties: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const ids = await getAccessiblePropertyIds(ctx.user as any);
      return getProperties(ids);
    }),
    get: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input, ctx }) => {
      const ids = await getAccessiblePropertyIds(ctx.user as any);
      if (ids !== null && !ids.includes(input.id)) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const props = await getProperties(null);
      return props.find((p: any) => p.id === input.id) ?? null;
    }),
    create: writeProcedure
      .input(
        z.object({
          name: z.string().min(1),
          type: z.enum(["hoa", "condo", "commercial", "residential"]),
          address: z.string().optional(),
          city: z.string().optional(),
          state: z.string().optional(),
          zip: z.string().optional(),
          companyId: z.number().optional(),
          units: z.number().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const { createProperty } = await import("./db");
        await createProperty({ ...input, companyId: input.companyId ?? ctx.user.companyId ?? 1 });
        await logActivity({ userId: ctx.user.id, activityType: "property_updated", title: `Property "${input.name}" created` });
        return { success: true };
      }),
  }),

  // ─── USERS ───────────────────────────────────────────────────────────────
  users: router({
    list: superAdminProcedure.query(() => getAllUsers()),
    updateRole: superAdminProcedure
      .input(z.object({ userId: z.number(), role: z.string() }))
      .mutation(async ({ input }) => {
        await updateUserRole(input.userId, input.role);
        return { success: true };
      }),
  }),

  // ─── INVITATIONS ─────────────────────────────────────────────────────────
  invitations: router({
    list: protectedProcedure.query(({ ctx }) => {
      if (["super_admin", "admin"].includes(ctx.user.role)) return getAllInvitations();
      return getInvitationsByInviter(ctx.user.id);
    }),
    send: inviteProcedure
      .input(
        z.object({
          email: z.string().email(),
          role: z.enum(["company_admin", "portfolio_manager", "manager", "accountant", "assistant", "board_member"]),
          companyId: z.number().optional(),
          assignedPropertyIds: z.array(z.number()).optional(),
          origin: z.string(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const token = nanoid(32);
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        await createInvitation({
          token,
          email: input.email,
          role: input.role,
          companyId: input.companyId ?? ctx.user.companyId ?? undefined,
          assignedPropertyIds: input.assignedPropertyIds,
          invitedBy: ctx.user.id,
          expiresAt,
        });
        await logActivity({
          userId: ctx.user.id,
          activityType: "user_invited",
          title: `Invited ${input.email} as ${input.role}`,
        });
        const inviteUrl = `${input.origin}/invite/accept?token=${token}`;
        return { success: true, inviteUrl, token };
      }),
    accept: publicProcedure
      .input(z.object({ token: z.string() }))
      .mutation(async ({ input }) => {
        const inv = await getInvitationByToken(input.token);
        if (!inv) throw new TRPCError({ code: "NOT_FOUND", message: "Invitation not found" });
        if (inv.status !== "pending") throw new TRPCError({ code: "BAD_REQUEST", message: "Invitation already used or expired" });
        if (new Date() > new Date(inv.expiresAt)) throw new TRPCError({ code: "BAD_REQUEST", message: "Invitation expired" });
        return { success: true, invitation: inv };
      }),
    revoke: inviteProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await revokeInvitation(input.id as any);
        return { success: true };
      }),
  }),

  // ─── DASHBOARD ───────────────────────────────────────────────────────────
  dashboard: router({
    stats: protectedProcedure.query(async ({ ctx }) => {
      const ids = await getAccessiblePropertyIds(ctx.user as any);
      return getDashboardStats(ids);
    }),
    recentActivity: protectedProcedure
      .input(z.object({ hours: z.number().default(24) }).optional())
      .query(async ({ ctx, input }) => {
        const ids = await getAccessiblePropertyIds(ctx.user as any);
        return getRecentActivity(ids, input?.hours ?? 24);
      }),
  }),

  // ─── ACCOUNTING ──────────────────────────────────────────────────────────
  accounting: router({
    receipts: protectedProcedure
      .input(z.object({ status: z.string().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const ids = await getAccessiblePropertyIds(ctx.user as any);
        return getTransactions(ids, "receipt", input?.status);
      }),
    charges: protectedProcedure.query(async ({ ctx }) => {
      const ids = await getAccessiblePropertyIds(ctx.user as any);
      return getTransactions(ids, "charge");
    }),
    bankDeposits: protectedProcedure.query(async ({ ctx }) => {
      const ids = await getAccessiblePropertyIds(ctx.user as any);
      return getTransactions(ids, "bank_deposit");
    }),
    bills: protectedProcedure
      .input(z.object({ status: z.string().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const ids = await getAccessiblePropertyIds(ctx.user as any);
        return getTransactions(ids, "bill", input?.status);
      }),
    payments: protectedProcedure.query(async ({ ctx }) => {
      const ids = await getAccessiblePropertyIds(ctx.user as any);
      return getTransactions(ids, "payment");
    }),
    approveBill: writeProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role === "board_member") throw new TRPCError({ code: "FORBIDDEN" });
        await approveBill(input.id);
        await logActivity({ userId: ctx.user.id, activityType: "bill_approved", title: `Bill #${input.id} approved` });
        return { success: true };
      }),
    journalEntries: protectedProcedure.query(async ({ ctx }) => {
      const ids = await getAccessiblePropertyIds(ctx.user as any);
      return getTransactions(ids, "journal_entry");
    }),
    bankAccounts: protectedProcedure.query(async ({ ctx }) => {
      const ids = await getAccessiblePropertyIds(ctx.user as any);
      return getBankAccounts(ids);
    }),
    glAccounts: protectedProcedure.query(({ ctx }) => {
      const companyId = ctx.user.companyId ?? 1;
      return getGlAccounts(companyId);
    }),
    diagnostics: protectedProcedure.query(async ({ ctx }) => {
      const ids = await getAccessiblePropertyIds(ctx.user as any);
      return getDiagnosticFlags(ids);
    }),
  }),

  // ─── OWNERS ──────────────────────────────────────────────────────────────
  owners: router({
    list: protectedProcedure
      .input(z.object({ search: z.string().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const ids = await getAccessiblePropertyIds(ctx.user as any);
        return getOwners(ids, input?.search);
      }),
    create: writeProcedure
      .input(z.object({
        propertyId: z.number(),
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        unit: z.string().optional(),
        portalAccess: z.boolean().optional(),
      }))
      .mutation(({ input }) => createOwner(input)),
  }),

  // ─── VENDORS ─────────────────────────────────────────────────────────────
  vendors: router({
    list: protectedProcedure
      .input(z.object({ search: z.string().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const ids = await getAccessiblePropertyIds(ctx.user as any);
        return getVendors(ids, input?.search);
      }),
    create: writeProcedure
      .input(z.object({
        companyName: z.string().min(1),
        contactName: z.string().optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        address: z.string().optional(),
        paymentType: z.enum(["check", "ach", "online", "credit_card"]).optional(),
        w9OnFile: z.boolean().optional(),
        is1099Vendor: z.boolean().optional(),
      }))
      .mutation(({ ctx, input }) => createVendor({ ...input, companyId: ctx.user.companyId ?? 1 })),
  }),

  // ─── ACTIVITY ────────────────────────────────────────────────────────────
  activity: router({
    list: protectedProcedure
      .input(z.object({ limit: z.number().default(50) }).optional())
      .query(async ({ ctx, input }) => {
        const ids = await getAccessiblePropertyIds(ctx.user as any);
        return getRecentActivity(ids, 720, input?.limit ?? 50);
      }),
  }),

  // ─── SEARCH ──────────────────────────────────────────────────────────────
  search: router({
    global: protectedProcedure
      .input(z.object({ q: z.string() }))
      .query(async ({ ctx, input }) => {
        const ids = await getAccessiblePropertyIds(ctx.user as any);
        const [properties, owners, vendors, transactions] = await Promise.all([
          getProperties(ids),
          getOwners(ids, input.q),
          getVendors(ids, input.q),
          getTransactions(ids, undefined, undefined),
        ]);
        const filteredProps = properties.filter((p: any) =>
          p.name.toLowerCase().includes(input.q.toLowerCase()) ||
          (p.city ?? "").toLowerCase().includes(input.q.toLowerCase())
        );
        return {
          associations: filteredProps.slice(0, 5),
          people: [
            ...owners.slice(0, 3).map((o: any) => ({ id: o.id, name: `${o.firstName ?? ""} ${o.lastName ?? ""}`.trim(), type: "Owner" })),
            ...vendors.slice(0, 3).map((v: any) => ({ id: v.id, name: v.companyName, type: "Vendor" })),
          ],
          transactions: transactions.slice(0, 5),
        };
      }),
  }),

  // ─── ADMIN ───────────────────────────────────────────────────────────────
  admin: router({
    companies: superAdminProcedure.query(() => getAllCompanies()),
    users: superAdminProcedure
      .input(z.object({ search: z.string().optional() }).optional())
      .query(({ input }) => getAllUsers(input?.search)),
    properties: superAdminProcedure.query(() => getProperties(null)),
  }),

  // ─── PEOPLE ──────────────────────────────────────────────────────────────
  people: router({
    owners: protectedProcedure.query(async ({ ctx }) => {
      const ids = await getAccessiblePropertyIds(ctx.user as any);
      return getOwners(ids);
    }),
    vendors: protectedProcedure.query(async ({ ctx }) => {
      const ids = await getAccessiblePropertyIds(ctx.user as any);
      return getVendors(ids);
    }),
  }),

  // ─── REPORTS ─────────────────────────────────────────────────────────────
  reports: reportsRouter,
});

export type AppRouter = typeof appRouter;

// ─── REPORT CATEGORIES DATA ───────────────────────────────────────────────────
const REPORT_CATEGORIES = [
  {
    name: "Accounting Reports",
    reports: [
      "Account Totals", "Balance Sheet", "Balance Sheet - Comparative", "Balance Sheet - Property Comparison",
      "Bank Account Activity", "Bank Account Association", "Cash Flow", "Cash Flow - 12 Month",
      "Cash Flow - Property Comparison", "Cash Flow Detail", "Chart of Accounts", "Expense Distribution",
      "General Ledger", "Income Statement", "Income Statement - 12 Month", "Income Statement - Comparative",
      "Income Statement - Property Comparison", "Income Statement (Date Range)", "Loans", "Trial Balance",
      "Trial Balance by Property", "Trust Account Balance", "Trust Account Detail",
    ],
  },
  {
    name: "Association Reports",
    reports: [
      "Association Work Order", "Budget Comparison", "Budget vs Actual", "Capital Improvement Plan",
      "Delinquency Report", "Fund Balance", "Fund Income Statement", "Homeowner Delinquency",
      "Homeowner Statement", "Meeting Minutes", "Reserve Fund Analysis", "Unit Ledger",
    ],
  },
  {
    name: "Diagnostic Reports",
    reports: [
      "Account Balance Diagnostic", "Bank Reconciliation Diagnostic", "GL Account Diagnostic",
      "Prepaid Expense Diagnostic", "Undeposited Funds Diagnostic", "Unreconciled Transactions",
    ],
  },
  {
    name: "Maintenance Reports",
    reports: [
      "Open Work Orders", "Work Order History", "Vendor Performance", "Maintenance Cost by Property",
      "Recurring Maintenance Schedule", "Inspection Report",
    ],
  },
  {
    name: "Property / Unit Reports",
    reports: [
      "Property Summary", "Unit Occupancy", "Unit Ledger", "Owner Directory",
      "Owner Statement", "Delinquent Owners", "Move-In / Move-Out Report",
    ],
  },
  {
    name: "Tax Reports",
    reports: [
      "1099 Detail", "1099 Summary", "Vendor 1099 Detail", "Tax Summary by Property",
      "Depreciation Schedule", "Year-End Tax Package",
    ],
  },
  {
    name: "Transaction Reports",
    reports: [
      "Transaction Detail", "Transaction Summary", "Check Register", "Payment History",
      "Receipt Register", "Charge Register", "Journal Entry Register", "Bank Transfer Register",
      "Voided Transactions", "Recurring Transaction Summary",
    ],
  },
  {
    name: "Scheduled Reports",
    reports: [
      "Daily Financial Summary", "Weekly Delinquency Update", "Monthly Income Statement",
      "Quarterly Reserve Analysis", "Annual Budget Report",
    ],
  },
];
