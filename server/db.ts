import { eq, desc, and, sql } from "drizzle-orm";
import { drizzle, type MySql2Database } from "drizzle-orm/mysql2";
import { createPool } from "mysql2/promise";
import {
  users, companies, properties, propertyAssignments,
  tickets, ticketComments, scheduleEvents, meetings,
  meetingActionItems, vendors, emailThreads,
  type InsertUser, type InsertTicket, type InsertScheduleEvent,
  type InsertMeeting, type InsertVendor, type InsertEmailThread,
  type InsertCompany, type InsertProperty,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

type DB = MySql2Database<Record<string, never>>;
let _db: DB | null = null;

export async function getDb(): Promise<DB | null> {
  if (!_db && ENV.databaseUrl) {
    try {
      const pool = createPool(ENV.databaseUrl);
      _db = drizzle(pool) as unknown as DB;
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
    }
  }
  return _db;
}

// ─── Users ────────────────────────────────────────────────────────────────────
export async function upsertUser(user: InsertUser): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const isOwner = user.openId === ENV.ownerOpenId;
  const updateSet: Record<string, unknown> = { lastSignedIn: new Date() };
  if (user.name) updateSet.name = user.name;
  if (user.email) updateSet.email = user.email;
  if (user.loginMethod) updateSet.loginMethod = user.loginMethod;
  if (isOwner) { updateSet.role = "admin"; updateSet.portierRole = "super_admin"; }
  await (db as any).insert(users).values({
    ...user,
    role: isOwner ? "admin" : "user",
    portierRole: isOwner ? "super_admin" : "user",
    lastSignedIn: new Date(),
  }).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await (db as any).select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0] as typeof users.$inferSelect | undefined;
}

export async function getAllUsers(companyId?: number) {
  const db = await getDb();
  if (!db) return [] as (typeof users.$inferSelect)[];
  if (companyId !== undefined) {
    return (db as any).select().from(users).where(eq(users.companyId, companyId)).orderBy(desc(users.createdAt)) as Promise<(typeof users.$inferSelect)[]>;
  }
  return (db as any).select().from(users).orderBy(desc(users.createdAt)) as Promise<(typeof users.$inferSelect)[]>;
}

export async function updateUserRole(userId: number, portierRole: string, companyId?: number) {
  const db = await getDb();
  if (!db) return;
  const update: Record<string, unknown> = { portierRole };
  if (companyId !== undefined) update.companyId = companyId;
  await (db as any).update(users).set(update).where(eq(users.id, userId));
}

// ─── Companies ────────────────────────────────────────────────────────────────
export async function getAllCompanies() {
  const db = await getDb();
  if (!db) return [] as (typeof companies.$inferSelect)[];
  return (db as any).select().from(companies).orderBy(desc(companies.createdAt)) as Promise<(typeof companies.$inferSelect)[]>;
}

export async function getCompanyById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await (db as any).select().from(companies).where(eq(companies.id, id)).limit(1);
  return result[0] as typeof companies.$inferSelect | undefined;
}

export async function createCompany(data: InsertCompany) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await (db as any).insert(companies).values(data);
}

// ─── Properties ───────────────────────────────────────────────────────────────
export async function getPropertiesByCompany(companyId: number) {
  const db = await getDb();
  if (!db) return [] as (typeof properties.$inferSelect)[];
  return (db as any).select().from(properties).where(eq(properties.companyId, companyId)).orderBy(desc(properties.createdAt)) as Promise<(typeof properties.$inferSelect)[]>;
}

export async function createProperty(data: InsertProperty) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await (db as any).insert(properties).values(data);
}

// ─── Tickets ──────────────────────────────────────────────────────────────────
export async function getTicketsByProperty(propertyId: number) {
  const db = await getDb();
  if (!db) return [] as (typeof tickets.$inferSelect)[];
  return (db as any).select().from(tickets).where(eq(tickets.propertyId, propertyId)).orderBy(desc(tickets.createdAt)) as Promise<(typeof tickets.$inferSelect)[]>;
}

export async function getTicketsByCompany(companyId: number) {
  const db = await getDb();
  if (!db) return [] as (typeof tickets.$inferSelect)[];
  return (db as any).select().from(tickets).where(eq(tickets.companyId, companyId)).orderBy(desc(tickets.createdAt)) as Promise<(typeof tickets.$inferSelect)[]>;
}

export async function createTicket(data: InsertTicket) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await (db as any).insert(tickets).values(data).$returningId();
  return result[0];
}

export async function updateTicketStatus(ticketId: number, status: string) {
  const db = await getDb();
  if (!db) return;
  await (db as any).update(tickets).set({ status, updatedAt: new Date() }).where(eq(tickets.id, ticketId));
}

export async function getTicketComments(ticketId: number) {
  const db = await getDb();
  if (!db) return [] as (typeof ticketComments.$inferSelect)[];
  return (db as any).select().from(ticketComments).where(eq(ticketComments.ticketId, ticketId)).orderBy(ticketComments.createdAt) as Promise<(typeof ticketComments.$inferSelect)[]>;
}

export async function addTicketComment(data: { ticketId: number; authorId: number; content: string; isInternal?: boolean }) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await (db as any).insert(ticketComments).values(data);
}

// ─── Schedule Events ──────────────────────────────────────────────────────────
export async function getEventsByProperty(propertyId: number) {
  const db = await getDb();
  if (!db) return [] as (typeof scheduleEvents.$inferSelect)[];
  return (db as any).select().from(scheduleEvents).where(eq(scheduleEvents.propertyId, propertyId)).orderBy(scheduleEvents.startTime) as Promise<(typeof scheduleEvents.$inferSelect)[]>;
}

export async function getEventsByCompany(companyId: number) {
  const db = await getDb();
  if (!db) return [] as (typeof scheduleEvents.$inferSelect)[];
  return (db as any).select().from(scheduleEvents).where(eq(scheduleEvents.companyId, companyId)).orderBy(scheduleEvents.startTime) as Promise<(typeof scheduleEvents.$inferSelect)[]>;
}

export async function createEvent(data: InsertScheduleEvent) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await (db as any).insert(scheduleEvents).values(data);
}

// ─── Meetings ─────────────────────────────────────────────────────────────────
export async function getMeetingsByProperty(propertyId: number) {
  const db = await getDb();
  if (!db) return [] as (typeof meetings.$inferSelect)[];
  return (db as any).select().from(meetings).where(eq(meetings.propertyId, propertyId)).orderBy(desc(meetings.scheduledAt)) as Promise<(typeof meetings.$inferSelect)[]>;
}

export async function createMeeting(data: InsertMeeting) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await (db as any).insert(meetings).values(data).$returningId();
  return result[0];
}

export async function updateMeeting(meetingId: number, data: Partial<InsertMeeting>) {
  const db = await getDb();
  if (!db) return;
  await (db as any).update(meetings).set({ ...data, updatedAt: new Date() }).where(eq(meetings.id, meetingId));
}

// ─── Vendors ──────────────────────────────────────────────────────────────────
export async function getVendorsByCompany(companyId: number) {
  const db = await getDb();
  if (!db) return [] as (typeof vendors.$inferSelect)[];
  return (db as any).select().from(vendors).where(eq(vendors.companyId, companyId)).orderBy(vendors.name) as Promise<(typeof vendors.$inferSelect)[]>;
}

export async function createVendor(data: InsertVendor) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await (db as any).insert(vendors).values(data);
}

// ─── Email Threads ────────────────────────────────────────────────────────────
export async function getEmailsByCompany(companyId: number) {
  const db = await getDb();
  if (!db) return [] as (typeof emailThreads.$inferSelect)[];
  return (db as any).select().from(emailThreads).where(eq(emailThreads.companyId, companyId)).orderBy(desc(emailThreads.receivedAt)) as Promise<(typeof emailThreads.$inferSelect)[]>;
}

export async function createEmailThread(data: InsertEmailThread) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await (db as any).insert(emailThreads).values(data);
}

export async function markEmailRead(emailId: number) {
  const db = await getDb();
  if (!db) return;
  await (db as any).update(emailThreads).set({ isRead: true }).where(eq(emailThreads.id, emailId));
}
export async function markEmailConverted(emailId: number, ticketId: number) {
  const db = await getDb();
  if (!db) return;
  await (db as any).update(emailThreads).set({ convertedToTicketId: ticketId }).where(eq(emailThreads.id, emailId));
}

// ─── Portal (Resident / Owner) Helpers ──────────────────────────────────────
export async function getTicketsByReporter(reportedById: number) {
  const db = await getDb();
  if (!db) return [] as (typeof tickets.$inferSelect)[];
  return (db as any).select().from(tickets).where(eq(tickets.reportedById, reportedById)).orderBy(desc(tickets.createdAt)) as Promise<(typeof tickets.$inferSelect)[]>;
}

export async function getTicketById(ticketId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await (db as any).select().from(tickets).where(eq(tickets.id, ticketId)).limit(1);
  return result[0] as typeof tickets.$inferSelect | undefined;
}

export async function getPropertyById(propertyId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await (db as any).select().from(properties).where(eq(properties.id, propertyId)).limit(1);
  return result[0] as typeof properties.$inferSelect | undefined;
}

// ─── Dashboard Stats ──────────────────────────────────────────────────────────
export async function getCompanyStats(companyId: number) {
  const db = await getDb();
  if (!db) return { properties: 0, openTickets: 0, vendors: 0 };
  const [propCount] = await (db as any).select({ count: sql<number>`count(*)` }).from(properties).where(eq(properties.companyId, companyId));
  const [ticketCount] = await (db as any).select({ count: sql<number>`count(*)` }).from(tickets).where(and(eq(tickets.companyId, companyId), eq(tickets.status, "open")));
  const [vendorCount] = await (db as any).select({ count: sql<number>`count(*)` }).from(vendors).where(eq(vendors.companyId, companyId));
  return {
    properties: Number(propCount?.count ?? 0),
    openTickets: Number(ticketCount?.count ?? 0),
    vendors: Number(vendorCount?.count ?? 0),
  };
}

export async function getPlatformStats() {
  const db = await getDb();
  if (!db) return { companies: 0, properties: 0, users: 0, tickets: 0 };
  const [compCount] = await (db as any).select({ count: sql<number>`count(*)` }).from(companies);
  const [propCount] = await (db as any).select({ count: sql<number>`count(*)` }).from(properties);
  const [userCount] = await (db as any).select({ count: sql<number>`count(*)` }).from(users);
  const [ticketCount] = await (db as any).select({ count: sql<number>`count(*)` }).from(tickets);
  return {
    companies: Number(compCount?.count ?? 0),
    properties: Number(propCount?.count ?? 0),
    users: Number(userCount?.count ?? 0),
    tickets: Number(ticketCount?.count ?? 0),
  };
}

// ─── Owner Accounts & Payments ────────────────────────────────────────────────
import {
  ownerAccounts, paymentTransactions, propertyDocuments, ownerMessages,
  type InsertOwnerAccount, type InsertPaymentTransaction,
  type InsertPropertyDocument, type InsertOwnerMessage,
} from "../drizzle/schema";

export async function getOwnerAccount(ownerId: number, propertyId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await (db as any).select().from(ownerAccounts)
    .where(and(eq(ownerAccounts.ownerId, ownerId), eq(ownerAccounts.propertyId, propertyId)))
    .limit(1);
  return result[0] as typeof ownerAccounts.$inferSelect | undefined;
}

export async function upsertOwnerAccount(data: InsertOwnerAccount) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await (db as any).insert(ownerAccounts).values(data)
    .onDuplicateKeyUpdate({ set: { balanceCents: data.balanceCents, notes: data.notes, updatedAt: new Date() } });
}

export async function getPaymentsByOwner(ownerId: number, propertyId: number) {
  const db = await getDb();
  if (!db) return [] as (typeof paymentTransactions.$inferSelect)[];
  return (db as any).select().from(paymentTransactions)
    .where(and(eq(paymentTransactions.ownerId, ownerId), eq(paymentTransactions.propertyId, propertyId)))
    .orderBy(desc(paymentTransactions.createdAt)) as Promise<(typeof paymentTransactions.$inferSelect)[]>;
}

export async function createPaymentTransaction(data: InsertPaymentTransaction) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await (db as any).insert(paymentTransactions).values(data).$returningId();
  return result[0];
}

// ─── Property Documents ───────────────────────────────────────────────────────
export async function getDocumentsByProperty(propertyId: number, sharedOnly = false) {
  const db = await getDb();
  if (!db) return [] as (typeof propertyDocuments.$inferSelect)[];
  const conditions = sharedOnly
    ? and(eq(propertyDocuments.propertyId, propertyId), eq(propertyDocuments.isSharedWithOwners, true))
    : eq(propertyDocuments.propertyId, propertyId);
  return (db as any).select().from(propertyDocuments)
    .where(conditions)
    .orderBy(desc(propertyDocuments.createdAt)) as Promise<(typeof propertyDocuments.$inferSelect)[]>;
}

export async function createPropertyDocument(data: InsertPropertyDocument) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await (db as any).insert(propertyDocuments).values(data).$returningId();
  return result[0];
}

export async function toggleDocumentShare(documentId: number, isShared: boolean) {
  const db = await getDb();
  if (!db) return;
  await (db as any).update(propertyDocuments)
    .set({ isSharedWithOwners: isShared, updatedAt: new Date() })
    .where(eq(propertyDocuments.id, documentId));
}

export async function deletePropertyDocument(documentId: number) {
  const db = await getDb();
  if (!db) return;
  await (db as any).delete(propertyDocuments).where(eq(propertyDocuments.id, documentId));
}

export async function getDocumentById(documentId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await (db as any).select().from(propertyDocuments)
    .where(eq(propertyDocuments.id, documentId)).limit(1);
  return result[0] as typeof propertyDocuments.$inferSelect | undefined;
}

// ─── Owner Messages ───────────────────────────────────────────────────────────
export async function getOwnerMessages(ownerId: number, propertyId: number) {
  const db = await getDb();
  if (!db) return [] as (typeof ownerMessages.$inferSelect)[];
  return (db as any).select().from(ownerMessages)
    .where(and(eq(ownerMessages.ownerId, ownerId), eq(ownerMessages.propertyId, propertyId)))
    .orderBy(ownerMessages.createdAt) as Promise<(typeof ownerMessages.$inferSelect)[]>;
}

export async function createOwnerMessage(data: InsertOwnerMessage) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await (db as any).insert(ownerMessages).values(data).$returningId();
  return result[0];
}

export async function markMessagesRead(ownerId: number, propertyId: number) {
  const db = await getDb();
  if (!db) return;
  await (db as any).update(ownerMessages)
    .set({ isRead: true })
    .where(and(
      eq(ownerMessages.ownerId, ownerId),
      eq(ownerMessages.propertyId, propertyId),
      eq(ownerMessages.direction, "manager_to_owner"),
    ));
}

export async function getUnreadMessageCountForManager(companyId: number) {
  const db = await getDb();
  if (!db) return 0;
  const [row] = await (db as any).select({ count: sql<number>`count(*)` })
    .from(ownerMessages)
    .where(and(eq(ownerMessages.companyId, companyId), eq(ownerMessages.direction, "owner_to_manager"), eq(ownerMessages.isRead, false)));
  return Number(row?.count ?? 0);
}

export async function getOwnerMessagesByCompany(companyId: number) {
  const db = await getDb();
  if (!db) return [] as (typeof ownerMessages.$inferSelect)[];
  return (db as any).select().from(ownerMessages)
    .where(eq(ownerMessages.companyId, companyId))
    .orderBy(desc(ownerMessages.createdAt)) as Promise<(typeof ownerMessages.$inferSelect)[]>;
}

// ─── Owner Notifications ──────────────────────────────────────────────────────
import {
  ownerNotifications,
  type InsertOwnerNotification,
} from "../drizzle/schema";

export async function createOwnerNotification(data: InsertOwnerNotification) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await (db as any).insert(ownerNotifications).values(data).$returningId();
  return result[0] as { id: number } | undefined;
}

export async function getNotificationsByOwner(ownerId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [] as (typeof ownerNotifications.$inferSelect)[];
  return (db as any).select().from(ownerNotifications)
    .where(eq(ownerNotifications.ownerId, ownerId))
    .orderBy(desc(ownerNotifications.createdAt))
    .limit(limit) as Promise<(typeof ownerNotifications.$inferSelect)[]>;
}

export async function getUnreadNotificationCount(ownerId: number) {
  const db = await getDb();
  if (!db) return 0;
  const [row] = await (db as any).select({ count: sql<number>`count(*)` })
    .from(ownerNotifications)
    .where(and(eq(ownerNotifications.ownerId, ownerId), eq(ownerNotifications.isRead, false)));
  return Number(row?.count ?? 0);
}

export async function markNotificationRead(notificationId: number, ownerId: number) {
  const db = await getDb();
  if (!db) return;
  await (db as any).update(ownerNotifications)
    .set({ isRead: true, readAt: new Date() })
    .where(and(eq(ownerNotifications.id, notificationId), eq(ownerNotifications.ownerId, ownerId)));
}

export async function markAllNotificationsRead(ownerId: number) {
  const db = await getDb();
  if (!db) return;
  await (db as any).update(ownerNotifications)
    .set({ isRead: true, readAt: new Date() })
    .where(and(eq(ownerNotifications.ownerId, ownerId), eq(ownerNotifications.isRead, false)));
}

export async function markNotificationEmailSent(notificationId: number) {
  const db = await getDb();
  if (!db) return;
  await (db as any).update(ownerNotifications)
    .set({ emailSent: true, emailSentAt: new Date() })
    .where(eq(ownerNotifications.id, notificationId));
}

/**
 * Get all owners who have an owner_account for a specific property.
 * This is the correct property-scoped lookup — it only returns owners
 * explicitly linked to this property via the owner_accounts table,
 * preventing cross-property notifications within the same company.
 */
export async function getOwnersByProperty(propertyId: number) {
  const db = await getDb();
  if (!db) return [] as (typeof users.$inferSelect)[];
  // Find all owner IDs from owner_accounts for this property
  const accounts = await (db as any).select({ ownerId: ownerAccounts.ownerId })
    .from(ownerAccounts)
    .where(eq(ownerAccounts.propertyId, propertyId)) as { ownerId: number }[];
  if (accounts.length === 0) return [];
  const ownerIds = accounts.map(a => a.ownerId);
  // Fetch the user records for those owner IDs
  const allUsers = await (db as any).select().from(users)
    .where(eq(users.portierRole, "owner")) as (typeof users.$inferSelect)[];
  return allUsers.filter(u => ownerIds.includes(u.id));
}
