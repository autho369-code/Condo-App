import { z } from "zod";
import { serialize } from "cookie";
import { router, publicProcedure, protectedProcedure, adminProcedure, companyProcedure } from "./_core/trpc";
import { COOKIE_NAME } from "../shared/const";
import {
  getAllCompanies, getCompanyById, createCompany,
  getPropertiesByCompany, createProperty,
  getTicketsByCompany, getTicketsByProperty, createTicket, updateTicketStatus, getTicketComments, addTicketComment,
  getEventsByCompany, getEventsByProperty, createEvent,
  getMeetingsByProperty, createMeeting, updateMeeting,
  getVendorsByCompany, createVendor,
  getEmailsByCompany, createEmailThread, markEmailRead,
  getAllUsers, updateUserRole, getPlatformStats, getCompanyStats,
} from "./db";
import { classifyTicket, draftEmailReply, summarizeMeeting } from "./_core/llm";
import { getEmailConnectionsByUser, deactivateEmailConnection } from "./email/emailDb";
import { syncEmailConnection } from "./email/emailRoutes";
import { categorizeEmail, saveCategorization, bulkCategorizeCompanyEmails } from "./email/categorize";
import { ENV } from "./_core/env";

export const appRouter = router({
  // ─── Auth ──────────────────────────────────────────────────────────────────
  auth: router({
    me: publicProcedure.query(({ ctx }) => ctx.user ?? null),
    logout: publicProcedure.mutation(({ ctx }) => {
      const isSecure = ctx.req.protocol === "https";
      const cookieStr = serialize(COOKIE_NAME, "", {
        httpOnly: true,
        secure: isSecure,
        sameSite: isSecure ? "none" : "lax",
        maxAge: -1,
        path: "/",
      });
      ctx.res.setHeader("Set-Cookie", cookieStr);
      return { success: true };
    }),
  }),

  // ─── SuperAdmin ────────────────────────────────────────────────────────────
  admin: router({
    platformStats: adminProcedure.query(() => getPlatformStats()),
    allCompanies: adminProcedure.query(() => getAllCompanies()),
    allUsers: adminProcedure.query(() => getAllUsers()),
    updateUserRole: adminProcedure
      .input(z.object({ userId: z.number(), portierRole: z.string(), companyId: z.number().optional() }))
      .mutation(({ input }) => updateUserRole(input.userId, input.portierRole, input.companyId)),
    createCompany: adminProcedure
      .input(z.object({
        name: z.string().min(1),
        slug: z.string().min(1),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        address: z.string().optional(),
        tier: z.enum(["starter", "growth", "professional", "enterprise"]).optional(),
      }))
      .mutation(({ input }) => createCompany(input)),
  }),

  // ─── Companies ─────────────────────────────────────────────────────────────
  company: router({
    mine: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.user?.companyId) return null;
      return getCompanyById(ctx.user.companyId);
    }),
    stats: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.user?.companyId) return { properties: 0, openTickets: 0, vendors: 0 };
      return getCompanyStats(ctx.user.companyId);
    }),
    properties: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.user?.companyId) return [];
      return getPropertiesByCompany(ctx.user.companyId);
    }),
    addProperty: companyProcedure
      .input(z.object({
        name: z.string().min(1),
        address: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        zip: z.string().optional(),
        unitCount: z.number().optional(),
        propertyType: z.enum(["condominium", "hoa", "coop"]).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user.companyId) throw new Error("No company assigned");
        return createProperty({ ...input, companyId: ctx.user.companyId });
      }),
    users: companyProcedure.query(async ({ ctx }) => {
      if (!ctx.user.companyId) return [];
      return getAllUsers(ctx.user.companyId);
    }),
    vendors: companyProcedure.query(async ({ ctx }) => {
      if (!ctx.user.companyId) return [];
      return getVendorsByCompany(ctx.user.companyId);
    }),
    addVendor: companyProcedure
      .input(z.object({
        name: z.string().min(1),
        contactName: z.string().optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        category: z.enum(["plumbing","electrical","hvac","landscaping","cleaning","security","elevator","general","other"]).optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user.companyId) throw new Error("No company assigned");
        return createVendor({ ...input, companyId: ctx.user.companyId });
      }),
  }),

  // ─── Tickets ───────────────────────────────────────────────────────────────
  tickets: router({
    list: companyProcedure
      .input(z.object({ propertyId: z.number().optional() }))
      .query(async ({ ctx, input }) => {
        if (!ctx.user.companyId) return [];
        if (input.propertyId) return getTicketsByProperty(input.propertyId);
        return getTicketsByCompany(ctx.user.companyId);
      }),
    create: companyProcedure
      .input(z.object({
        propertyId: z.number(),
        title: z.string().min(1),
        description: z.string().optional(),
        priority: z.enum(["low","medium","high","urgent"]).optional(),
        unitNumber: z.string().optional(),
        source: z.enum(["portal","email","phone","manager","system"]).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user.companyId) throw new Error("No company");
        // AI classify
        const category = await classifyTicket(input.title, input.description ?? "");
        return createTicket({
          ...input,
          companyId: ctx.user.companyId,
          category: category as any,
          reportedById: ctx.user.id,
        });
      }),
    updateStatus: companyProcedure
      .input(z.object({ ticketId: z.number(), status: z.enum(["open","in_progress","pending_vendor","resolved","closed"]) }))
      .mutation(({ input }) => updateTicketStatus(input.ticketId, input.status)),
    comments: companyProcedure
      .input(z.object({ ticketId: z.number() }))
      .query(({ input }) => getTicketComments(input.ticketId)),
    addComment: companyProcedure
      .input(z.object({ ticketId: z.number(), content: z.string().min(1), isInternal: z.boolean().optional() }))
      .mutation(({ ctx, input }) => addTicketComment({ ...input, authorId: ctx.user.id })),
  }),

  // ─── Schedule ──────────────────────────────────────────────────────────────
  schedule: router({
    list: companyProcedure
      .input(z.object({ propertyId: z.number().optional() }))
      .query(async ({ ctx, input }) => {
        if (!ctx.user.companyId) return [];
        if (input.propertyId) return getEventsByProperty(input.propertyId);
        return getEventsByCompany(ctx.user.companyId);
      }),
    create: companyProcedure
      .input(z.object({
        propertyId: z.number(),
        title: z.string().min(1),
        description: z.string().optional(),
        eventType: z.enum(["inspection","vendor_visit","maintenance","board_meeting","deadline","owner_meeting","other"]).optional(),
        startTime: z.date(),
        endTime: z.date().optional(),
        isAllDay: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user.companyId) throw new Error("No company");
        return createEvent({ ...input, companyId: ctx.user.companyId, createdById: ctx.user.id });
      }),
  }),

  // ─── Meetings ──────────────────────────────────────────────────────────────
  meetings: router({
    list: companyProcedure
      .input(z.object({ propertyId: z.number() }))
      .query(({ input }) => getMeetingsByProperty(input.propertyId)),
    create: companyProcedure
      .input(z.object({
        propertyId: z.number(),
        title: z.string().min(1),
        meetingType: z.enum(["board_meeting","annual_meeting","special_meeting","committee_meeting","vendor_meeting","internal"]).optional(),
        scheduledAt: z.date().optional(),
        location: z.string().optional(),
        agenda: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user.companyId) throw new Error("No company");
        return createMeeting({ ...input, companyId: ctx.user.companyId, createdById: ctx.user.id });
      }),
    saveMinutes: companyProcedure
      .input(z.object({ meetingId: z.number(), minutes: z.string() }))
      .mutation(({ input }) => updateMeeting(input.meetingId, { minutes: input.minutes })),
    generateSummary: companyProcedure
      .input(z.object({ meetingId: z.number(), agenda: z.string(), minutes: z.string() }))
      .mutation(async ({ input }) => {
        const summary = await summarizeMeeting(input.agenda, input.minutes);
        await updateMeeting(input.meetingId, { aiSummary: summary });
        return { summary };
      }),
  }),

  // ─── Email Hub ─────────────────────────────────────────────────────────────
  email: router({
    list: companyProcedure.query(async ({ ctx }) => {
      if (!ctx.user.companyId) return [];
      return getEmailsByCompany(ctx.user.companyId);
    }),
    add: companyProcedure
      .input(z.object({
        propertyId: z.number().optional(),
        ticketId: z.number().optional(),
        subject: z.string().optional(),
        fromAddress: z.string().optional(),
        toAddresses: z.string().optional(),
        bodyPreview: z.string().optional(),
        fullBody: z.string().optional(),
        source: z.enum(["gmail","outlook","manual"]).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user.companyId) throw new Error("No company");
        return createEmailThread({ ...input, companyId: ctx.user.companyId });
      }),
    markRead: companyProcedure
      .input(z.object({ emailId: z.number() }))
      .mutation(({ input }) => markEmailRead(input.emailId)),
    draftReply: companyProcedure
      .input(z.object({ subject: z.string(), body: z.string() }))
      .mutation(async ({ input }) => {
        const draft = await draftEmailReply(input.subject, input.body);
        return { draft };
      }),
    // ── Connected accounts ──────────────────────────────────────────────────
    listConnections: protectedProcedure.query(async ({ ctx }) => {
      return getEmailConnectionsByUser(ctx.user.id);
    }),
    disconnectAccount: protectedProcedure
      .input(z.object({ connectionId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        // Verify the connection belongs to the current user
        const connections = await getEmailConnectionsByUser(ctx.user.id);
        const owned = connections.some(c => c.id === input.connectionId);
        if (!owned) throw new Error("Not authorized to disconnect this account");
        await deactivateEmailConnection(input.connectionId);
        return { success: true };
      }),
    syncEmails: protectedProcedure
      .input(z.object({ connectionId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        // Verify the connection belongs to the current user
        const connections = await getEmailConnectionsByUser(ctx.user.id);
        const owned = connections.some(c => c.id === input.connectionId);
        if (!owned) return { synced: 0, error: "Not authorized to sync this account" };
        return syncEmailConnection(input.connectionId);
      }),
    // ── AI Categorization ───────────────────────────────────────────────────
    recategorize: companyProcedure
      .input(z.object({ emailId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user.companyId) throw new Error("No company");
        // Fetch the email
        const emails = await getEmailsByCompany(ctx.user.companyId);
        const email = emails.find(e => e.id === input.emailId);
        if (!email) throw new Error("Email not found");
        // Fetch company properties for matching
        const props = await getPropertiesByCompany(ctx.user.companyId);
        const result = await categorizeEmail(
          input.emailId,
          email.subject ?? "",
          (email as any).fullBody ?? email.bodyPreview ?? "",
          props.map(p => ({ id: p.id, name: p.name, address: p.address, city: p.city }))
        );
        await saveCategorization(input.emailId, result);
        return result;
      }),
    bulkRecategorize: companyProcedure
      .mutation(async ({ ctx }) => {
        if (!ctx.user.companyId) throw new Error("No company");
        const props = await getPropertiesByCompany(ctx.user.companyId);
        return bulkCategorizeCompanyEmails(
          ctx.user.companyId,
          props.map(p => ({ id: p.id, name: p.name, address: p.address, city: p.city }))
        );
      }),
    // Return OAuth URLs for the frontend to redirect to
    getConnectUrl: protectedProcedure
      .input(z.object({ provider: z.enum(["gmail", "outlook"]), origin: z.string() }))
      .query(async ({ input }) => {
        if (input.provider === "gmail") {
          if (!ENV.gmailClientId) return { url: null, configured: false };
          const { buildGmailAuthUrl } = await import("./email/gmail");
          const state = Buffer.from(JSON.stringify({ origin: input.origin })).toString("base64");
          return { url: buildGmailAuthUrl(state, input.origin), configured: true };
        } else {
          if (!ENV.outlookClientId) return { url: null, configured: false };
          const { buildOutlookAuthUrl } = await import("./email/outlook");
          const state = Buffer.from(JSON.stringify({ origin: input.origin })).toString("base64");
          return { url: buildOutlookAuthUrl(state, input.origin), configured: true };
        }
      }),
  }),
});

export type AppRouter = typeof appRouter;
