import { z } from "zod";
import { serialize } from "cookie";
import { router, publicProcedure, protectedProcedure, adminProcedure, companyProcedure, portalProcedure } from "./_core/trpc";
import { COOKIE_NAME } from "../shared/const";
import {
  getAllCompanies, getCompanyById, createCompany,
  getPropertiesByCompany, createProperty,
  getTicketsByCompany, getTicketsByProperty, createTicket, updateTicketStatus, getTicketComments, addTicketComment,
  getEventsByCompany, getEventsByProperty, createEvent,
  getMeetingsByProperty, createMeeting, updateMeeting,
  getVendorsByCompany, createVendor,
  getEmailsByCompany, createEmailThread, markEmailRead, markEmailConverted,
  getAllUsers, updateUserRole, getPlatformStats, getCompanyStats,
  getTicketsByReporter, getTicketById, getPropertyById,
  // Owner portal additions
  getOwnerAccount, upsertOwnerAccount, getPaymentsByOwner, createPaymentTransaction,
  getDocumentsByProperty, createPropertyDocument, toggleDocumentShare, deletePropertyDocument, getDocumentById,
  getOwnerMessages, createOwnerMessage, markMessagesRead, getOwnerMessagesByCompany,
  getOwnerMessageThreads, getThreadMessages, markThreadReadByManager, getTotalUnreadManagerCount,
} from "./db";
import { classifyTicket, draftEmailReply, summarizeMeeting } from "./_core/llm";
import { getEmailConnectionsByUser, deactivateEmailConnection } from "./email/emailDb";
import { getAttachmentsByTicket, deleteAttachment as dbDeleteAttachment } from "./attachments/attachmentDb";
import { syncEmailConnection } from "./email/emailRoutes";
import { categorizeEmail, saveCategorization, bulkCategorizeCompanyEmails } from "./email/categorize";
import { ENV } from "./_core/env";
import { notifyDocumentShared, notifyManagerReply, notifyTicketUpdate } from "./notifications/notificationService";
import {
  getNotificationsByOwner, getUnreadNotificationCount,
  markNotificationRead, markAllNotificationsRead,
  getNotificationPrefs, upsertNotificationPrefs,
  type NotificationPrefsShape,
} from "./db";

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
      .mutation(async ({ input }) => {
        // Fetch old status before updating so we can pass it to the notification
        const ticket = await getTicketById(input.ticketId);
        const oldStatus = ticket?.status ?? "open";
        await updateTicketStatus(input.ticketId, input.status);
        // Fire-and-forget: notify the owner about the status change
        notifyTicketUpdate({
          ticketId: input.ticketId,
          newStatus: input.status,
          oldStatus,
        }).catch(err => console.error("[updateStatus] Notification error:", err));
        return { success: true };
      }),
    comments: companyProcedure
      .input(z.object({ ticketId: z.number() }))
      .query(({ input }) => getTicketComments(input.ticketId)),
    addComment: companyProcedure
      .input(z.object({ ticketId: z.number(), content: z.string().min(1), isInternal: z.boolean().optional() }))
      .mutation(({ ctx, input }) => addTicketComment({ ...input, authorId: ctx.user.id })),
    // ── Attachments ────────────────────────────────────────────────────────
    listAttachments: companyProcedure
      .input(z.object({ ticketId: z.number() }))
      .query(async ({ ctx, input }) => {
        if (!ctx.user.companyId) return [];
        // Verify ticket belongs to this company
        const allTickets = await getTicketsByCompany(ctx.user.companyId);
        const ticket = allTickets.find(t => t.id === input.ticketId);
        if (!ticket) return [];
        return getAttachmentsByTicket(input.ticketId);
      }),
    deleteAttachment: companyProcedure
      .input(z.object({ attachmentId: z.number(), ticketId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user.companyId) throw new Error("No company");
        // Verify ticket belongs to this company
        const allTickets = await getTicketsByCompany(ctx.user.companyId);
        const ticket = allTickets.find(t => t.id === input.ticketId);
        if (!ticket) throw new Error("Ticket not found");
        await dbDeleteAttachment(input.attachmentId, ctx.user.id);
        return { success: true };
      }),
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

  // ─── Portal (Resident / Owner) ─────────────────────────────────────────────
  portal: router({
    submitRequest: portalProcedure
      .input(z.object({
        propertyId: z.number(),
        title: z.string().min(1),
        description: z.string().optional(),
        category: z.enum(["common_area","unit_related","emergency","vendor","board_matter","maintenance","other"]).optional(),
        unitNumber: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const property = await getPropertyById(input.propertyId);
        if (!property) throw new Error("Property not found");
        const category = input.category ?? await classifyTicket(input.title, input.description ?? "") as any;
        const result = await createTicket({
          ...input,
          category,
          companyId: property.companyId,
          source: "portal",
          reportedById: ctx.user.id,
          priority: "medium",
        });
        return { ticketId: result?.id, success: true };
      }),
    myTickets: portalProcedure.query(async ({ ctx }) => {
      return getTicketsByReporter(ctx.user.id);
    }),
    getTicket: portalProcedure
      .input(z.object({ ticketId: z.number() }))
      .query(async ({ ctx, input }) => {
        const ticket = await getTicketById(input.ticketId);
        if (!ticket || ticket.reportedById !== ctx.user.id) throw new Error("Ticket not found");
        const comments = await getTicketComments(input.ticketId);
        const property = ticket.propertyId ? await getPropertyById(ticket.propertyId) : null;
        const publicComments = comments.filter(c => !c.isInternal);
        return { ticket, comments: publicComments, property };
      }),
    addComment: portalProcedure
      .input(z.object({ ticketId: z.number(), content: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        const ticket = await getTicketById(input.ticketId);
        if (!ticket || ticket.reportedById !== ctx.user.id) throw new Error("Ticket not found");
        await addTicketComment({ ticketId: input.ticketId, authorId: ctx.user.id, content: input.content, isInternal: false });
        return { success: true };
      }),
    getProperty: portalProcedure
      .input(z.object({ propertyId: z.number() }))
      .query(async ({ input }) => getPropertyById(input.propertyId)),
    listProperties: portalProcedure.query(async ({ ctx }) => {
      if (ctx.user.companyId) return getPropertiesByCompany(ctx.user.companyId);
      return [];
    }),

    // ── Account Balance ────────────────────────────────────────────────────
    getAccountBalance: portalProcedure
      .input(z.object({ propertyId: z.number() }))
      .query(async ({ ctx, input }) => {
        const account = await getOwnerAccount(ctx.user.id, input.propertyId);
        const transactions = await getPaymentsByOwner(ctx.user.id, input.propertyId);
        return {
          balanceCents: account?.balanceCents ?? 0,
          currency: account?.currency ?? "USD",
          notes: account?.notes ?? null,
          transactions,
        };
      }),

    // ── Make Payment ───────────────────────────────────────────────────────
    makePayment: portalProcedure
      .input(z.object({
        propertyId: z.number(),
        amountCents: z.number().min(1),
        method: z.enum(["ach", "credit_card", "check", "wire", "other"]).optional(),
        description: z.string().optional(),
        referenceNumber: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const property = await getPropertyById(input.propertyId);
        if (!property) throw new Error("Property not found");
        // Create the payment transaction record (pending status)
        const result = await createPaymentTransaction({
          ownerId: ctx.user.id,
          propertyId: input.propertyId,
          companyId: property.companyId,
          amountCents: input.amountCents,
          method: input.method ?? "other",
          status: "pending",
          description: input.description,
          referenceNumber: input.referenceNumber,
        });
        // Update the owner's balance (reduce by payment amount)
        const existing = await getOwnerAccount(ctx.user.id, input.propertyId);
        await upsertOwnerAccount({
          ownerId: ctx.user.id,
          propertyId: input.propertyId,
          companyId: property.companyId,
          balanceCents: (existing?.balanceCents ?? 0) - input.amountCents,
          currency: existing?.currency ?? "USD",
        });
        return { transactionId: result?.id, success: true };
      }),

    // ── Shared Documents ───────────────────────────────────────────────────
    listDocuments: portalProcedure
      .input(z.object({ propertyId: z.number() }))
      .query(async ({ input }) => {
        return getDocumentsByProperty(input.propertyId, true);
      }),

    // ── Owner Messages ─────────────────────────────────────────────────────
    getMessages: portalProcedure
      .input(z.object({ propertyId: z.number() }))
      .query(async ({ ctx, input }) => {
        await markMessagesRead(ctx.user.id, input.propertyId);
        return getOwnerMessages(ctx.user.id, input.propertyId);
      }),

    sendMessage: portalProcedure
      .input(z.object({
        propertyId: z.number(),
        subject: z.string().optional(),
        body: z.string().min(1),
        channel: z.enum(["in_app", "email", "text"]).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const property = await getPropertyById(input.propertyId);
        if (!property) throw new Error("Property not found");
        const threadKey = `owner-${ctx.user.id}-prop-${input.propertyId}`;
        await createOwnerMessage({
          propertyId: input.propertyId,
          companyId: property.companyId,
          ownerId: ctx.user.id,
          direction: "owner_to_manager",
          channel: input.channel ?? "in_app",
          subject: input.subject,
          body: input.body,
          threadKey,
        });
        return { success: true };
      }),

    // ── Notifications ────────────────────────────────────────────────────────────────────────
    getNotifications: portalProcedure.query(async ({ ctx }) => {
      return getNotificationsByOwner(ctx.user.id, 50);
    }),

    getUnreadCount: portalProcedure.query(async ({ ctx }) => {
      const count = await getUnreadNotificationCount(ctx.user.id);
      return { count };
    }),

    markNotificationRead: portalProcedure
      .input(z.object({ notificationId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await markNotificationRead(input.notificationId, ctx.user.id);
        return { success: true };
      }),

    markAllNotificationsRead: portalProcedure.mutation(async ({ ctx }) => {
      await markAllNotificationsRead(ctx.user.id);
      return { success: true };
    }),

    // ── Notification Preferences ────────────────────────────────────────────
    getNotificationPrefs: portalProcedure.query(async ({ ctx }) => {
      return getNotificationPrefs(ctx.user.id);
    }),

    saveNotificationPrefs: portalProcedure
      .input(
        z.object({
          docSharedInApp:    z.boolean().optional(),
          docSharedEmail:    z.boolean().optional(),
          paymentDueInApp:   z.boolean().optional(),
          paymentDueEmail:   z.boolean().optional(),
          msgReceivedInApp:  z.boolean().optional(),
          msgReceivedEmail:  z.boolean().optional(),
          ticketUpdateInApp: z.boolean().optional(),
          ticketUpdateEmail: z.boolean().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await upsertNotificationPrefs(ctx.user.id, input);
        return { success: true };
      }),
  }),

  // ─── Documents (Manager-side) ──────────────────────────────────────────────
  documents: router({
    listByProperty: companyProcedure
      .input(z.object({ propertyId: z.number() }))
      .query(async ({ ctx, input }) => {
        if (!ctx.user.companyId) return [];
        return getDocumentsByProperty(input.propertyId, false);
      }),
    toggleShare: companyProcedure
      .input(z.object({ documentId: z.number(), isShared: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user.companyId) throw new Error("No company");
        // Verify document belongs to this company
        const doc = await getDocumentById(input.documentId);
        if (!doc || doc.companyId !== ctx.user.companyId) throw new Error("Document not found");
        const wasShared = doc.isSharedWithOwners;
        await toggleDocumentShare(input.documentId, input.isShared);
        // Fire notifications when sharing is newly enabled
        if (input.isShared && !wasShared) {
          // Non-blocking: do not await so the mutation returns quickly
          notifyDocumentShared(input.documentId).catch(err =>
            console.error("[toggleShare] Notification error:", err)
          );
        }
        return { success: true };
      }),
    delete: companyProcedure
      .input(z.object({ documentId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user.companyId) throw new Error("No company");
        const doc = await getDocumentById(input.documentId);
        if (!doc || doc.companyId !== ctx.user.companyId) throw new Error("Document not found");
        await deletePropertyDocument(input.documentId);
        return { success: true };
      }),
    // Manager inbox: see all owner messages for their company (legacy flat list)
    ownerMessages: companyProcedure.query(async ({ ctx }) => {
      if (!ctx.user.companyId) return [];
      return getOwnerMessagesByCompany(ctx.user.companyId);
    }),

    // Manager inbox: grouped threads with unread counts
    getMessageThreads: companyProcedure.query(async ({ ctx }) => {
      if (!ctx.user.companyId) return [];
      return getOwnerMessageThreads(ctx.user.companyId);
    }),

    // All messages in a specific thread
    getThreadMessages: companyProcedure
      .input(z.object({ threadKey: z.string() }))
      .query(async ({ ctx, input }) => {
        if (!ctx.user.companyId) return [];
        return getThreadMessages(ctx.user.companyId, input.threadKey);
      }),

    // Mark all owner→manager messages in a thread as read by manager
    markThreadRead: companyProcedure
      .input(z.object({ threadKey: z.string() }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user.companyId) throw new Error("No company");
        await markThreadReadByManager(ctx.user.companyId, input.threadKey);
        return { success: true };
      }),

    // Total unread count badge for sidebar nav
    getTotalUnread: companyProcedure.query(async ({ ctx }) => {
      if (!ctx.user.companyId) return { count: 0 };
      const count = await getTotalUnreadManagerCount(ctx.user.companyId);
      return { count };
    }),

    replyToOwner: companyProcedure
      .input(z.object({
        ownerId: z.number(),
        propertyId: z.number(),
        threadKey: z.string(),
        body: z.string().min(1),
        subject: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user.companyId) throw new Error("No company");
        await createOwnerMessage({
          propertyId: input.propertyId,
          companyId: ctx.user.companyId,
          ownerId: input.ownerId,
          managerId: ctx.user.id,
          direction: "manager_to_owner",
          channel: "in_app",
          subject: input.subject,
          body: input.body,
          threadKey: input.threadKey,
        });
        // Mark thread as read by manager since they just replied
        await markThreadReadByManager(ctx.user.companyId, input.threadKey);

        // Fire-and-forget: notify the owner about the manager's reply
        // Fetch property name for the notification body
        getPropertyById(input.propertyId).then(property => {
          notifyManagerReply({
            ownerId: input.ownerId,
            propertyId: input.propertyId,
            companyId: ctx.user.companyId!,
            managerName: ctx.user.name ?? "Your Property Manager",
            replyBody: input.body,
            propertyName: property?.name ?? "your property",
          }).catch(err => console.error("[replyToOwner] Notification error:", err));
        }).catch(err => console.error("[replyToOwner] Property lookup error:", err));

        return { success: true };
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
    // ── Convert email to ticket ─────────────────────────────────────────────
    convertToTicket: companyProcedure
      .input(z.object({
        emailId: z.number(),
        // Ticket fields — pre-filled from AI but user can override
        propertyId: z.number(),
        title: z.string().min(1),
        description: z.string().optional(),
        priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
        category: z.enum(["common_area","unit_related","emergency","vendor","board_matter","maintenance","other"]).optional(),
        unitNumber: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user.companyId) throw new Error("No company");
        // Verify the email belongs to this company
        const emails = await getEmailsByCompany(ctx.user.companyId);
        const email = emails.find(e => e.id === input.emailId);
        if (!email) throw new Error("Email not found");
        // Prevent duplicate conversion
        if ((email as any).convertedToTicketId) {
          throw new Error(`Already converted to ticket #${(email as any).convertedToTicketId}`);
        }
        // Create the ticket sourced from email
        const { emailId, ...ticketData } = input;
        const result = await createTicket({
          ...ticketData,
          companyId: ctx.user.companyId,
          source: "email",
          reportedById: ctx.user.id,
          sourceEmailId: emailId,
        });
        const ticketId = result?.id;
        if (!ticketId) throw new Error("Failed to create ticket");
        // Link the email back to the ticket
        await markEmailConverted(emailId, ticketId);
        return { ticketId, success: true };
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
