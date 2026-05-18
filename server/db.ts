import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  bankAccounts,
  companies,
  diagnosticFlags,
  glAccounts,
  invitations,
  journalEntryLines,
  owners,
  properties,
  recentActivity,
  scheduledReports,
  transactions,
  users,
  vendors,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── USER HELPERS ─────────────────────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};

  const textFields = ["name", "email", "loginMethod"] as const;
  for (const field of textFields) {
    const value = user[field];
    if (value === undefined) continue;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  }

  values.lastSignedIn = new Date();
  updateSet.lastSignedIn = new Date();

  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "super_admin";
    updateSet.role = "super_admin";
  }

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0];
}

// ─── PROPERTY SCOPE HELPER ────────────────────────────────────────────────────

export function getAccessiblePropertyIds(user: { role: string; assignedPropertyIds: number[] | null }): number[] | null {
  if (user.role === "super_admin" || user.role === "admin") return null; // null = all
  return user.assignedPropertyIds ?? [];
}

export function scopeToProperties(propertyIds: number[] | null) {
  if (propertyIds === null) return undefined; // no filter = all
  return inArray(properties.id, propertyIds.length > 0 ? propertyIds : [-1]);
}

// ─── COMPANY HELPERS ──────────────────────────────────────────────────────────

export async function getAllCompanies() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(companies).orderBy(companies.name);
}

export async function createCompany(data: { name: string; code: string; email?: string; phone?: string; address?: string }) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(companies).values(data);
}

// ─── PROPERTY HELPERS ─────────────────────────────────────────────────────────

export async function getProperties(propertyIds: number[] | null) {
  const db = await getDb();
  if (!db) return [];
  if (propertyIds === null) return db.select().from(properties).orderBy(properties.name);
  if (propertyIds.length === 0) return [];
  return db.select().from(properties).where(inArray(properties.id, propertyIds)).orderBy(properties.name);
}

export async function getPropertyById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(properties).where(eq(properties.id, id)).limit(1);
  return result[0];
}

// ─── INVITATION HELPERS ───────────────────────────────────────────────────────

export async function createInvitation(data: {
  token: string;
  email: string;
  role: string;
  companyId?: number;
  assignedPropertyIds?: number[];
  invitedBy: number;
  expiresAt: Date;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(invitations).values(data as any);
}

export async function getInvitationByToken(token: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(invitations).where(eq(invitations.token, token)).limit(1);
  return result[0];
}

export async function getInvitationsByInviter(invitedBy: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(invitations).where(eq(invitations.invitedBy, invitedBy)).orderBy(desc(invitations.createdAt));
}

export async function getAllInvitations() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(invitations).orderBy(desc(invitations.createdAt));
}

export async function acceptInvitation(token: string, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(invitations).set({ status: "accepted", acceptedAt: new Date() }).where(eq(invitations.token, token));
}

export async function revokeInvitation(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(invitations).set({ status: "revoked" }).where(eq(invitations.id, id));
}

// ─── VENDOR HELPERS ───────────────────────────────────────────────────────────

export async function getVendors(companyId: number, search?: string) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [eq(vendors.companyId, companyId)];
  if (search) conditions.push(sql`${vendors.companyName} LIKE ${`%${search}%`}`);
  return db.select().from(vendors).where(and(...conditions)).orderBy(vendors.companyName);
}

export async function getAllVendors() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(vendors).orderBy(vendors.companyName);
}

// ─── OWNER HELPERS ────────────────────────────────────────────────────────────

export async function getOwners(propertyIds: number[] | null, search?: string) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (propertyIds !== null) {
    if (propertyIds.length === 0) return [];
    conditions.push(inArray(owners.propertyId, propertyIds));
  }
  if (search) conditions.push(sql`CONCAT(${owners.firstName}, ' ', ${owners.lastName}) LIKE ${`%${search}%`}`);
  const query = db.select().from(owners).orderBy(owners.lastName);
  if (conditions.length > 0) return query.where(and(...conditions));
  return query;
}

// ─── GL ACCOUNT HELPERS ───────────────────────────────────────────────────────

export async function getGlAccounts(companyId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(glAccounts).where(eq(glAccounts.companyId, companyId)).orderBy(glAccounts.code);
}

// ─── BANK ACCOUNT HELPERS ─────────────────────────────────────────────────────

export async function getBankAccounts(propertyIds: number[] | null) {
  const db = await getDb();
  if (!db) return [];
  if (propertyIds === null) return db.select().from(bankAccounts).orderBy(bankAccounts.name);
  if (propertyIds.length === 0) return [];
  return db.select().from(bankAccounts).where(inArray(bankAccounts.propertyId, propertyIds)).orderBy(bankAccounts.name);
}

// ─── TRANSACTION HELPERS ──────────────────────────────────────────────────────

export async function getTransactions(propertyIds: number[] | null, type?: string, status?: string, search?: string) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (propertyIds !== null) {
    if (propertyIds.length === 0) return [];
    conditions.push(inArray(transactions.propertyId, propertyIds));
  }
  if (type) conditions.push(eq(transactions.transactionType, type as any));
  if (status) conditions.push(eq(transactions.status, status as any));
  if (search) conditions.push(sql`${transactions.description} LIKE ${`%${search}%`}`);
  const query = db.select().from(transactions).orderBy(desc(transactions.date));
  if (conditions.length > 0) return query.where(and(...conditions));
  return query;
}

export async function getPendingBills(propertyIds: number[] | null) {
  return getTransactions(propertyIds, "bill", "pending");
}

export async function approveBill(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(transactions).set({ status: "approved" }).where(eq(transactions.id, id));
}

// ─── DIAGNOSTIC HELPERS ───────────────────────────────────────────────────────

export async function getDiagnosticFlags(propertyIds: number[] | null) {
  const db = await getDb();
  if (!db) return [];
  if (propertyIds === null) return db.select().from(diagnosticFlags).orderBy(desc(diagnosticFlags.detectedAt));
  if (propertyIds.length === 0) return [];
  return db.select().from(diagnosticFlags).where(inArray(diagnosticFlags.propertyId, propertyIds)).orderBy(desc(diagnosticFlags.detectedAt));
}

// ─── RECENT ACTIVITY HELPERS ──────────────────────────────────────────────────

export async function getRecentActivity(propertyIds: number[] | null, hours = 24, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  const conditions: any[] = [sql`${recentActivity.createdAt} >= ${since}`];
  if (propertyIds !== null) {
    if (propertyIds.length === 0) return [];
    conditions.push(inArray(recentActivity.propertyId, propertyIds.length > 0 ? propertyIds : [-1]));
  }
  return db.select().from(recentActivity).where(and(...conditions)).orderBy(desc(recentActivity.createdAt)).limit(limit);
}

export async function logActivity(data: {
  userId: number;
  propertyId?: number;
  activityType: string;
  title: string;
  description?: string;
  metadata?: Record<string, unknown>;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(recentActivity).values(data as any);
}

// ─── SCHEDULED REPORTS ────────────────────────────────────────────────────────

export async function getScheduledReports(propertyIds: number[] | null) {
  const db = await getDb();
  if (!db) return [];
  if (propertyIds === null) return db.select().from(scheduledReports).orderBy(scheduledReports.reportName);
  if (propertyIds.length === 0) return [];
  return db.select().from(scheduledReports).where(inArray(scheduledReports.propertyId, propertyIds)).orderBy(scheduledReports.reportName);
}

// ─── STATS HELPERS ────────────────────────────────────────────────────────────

export async function getDashboardStats(propertyIds: number[] | null) {
  const db = await getDb();
  if (!db) return { associations: 0, vendors: 0, owners: 0, openBills: 0 };

  const propList = await getProperties(propertyIds);
  const ownerList = await getOwners(propertyIds);
  const bills = await getPendingBills(propertyIds);
  const vendorList = propertyIds === null ? await getAllVendors() : [];

  return {
    associations: propList.length,
    vendors: vendorList.length,
    owners: ownerList.length,
    openBills: bills.length,
  };
}

export async function getAllUsers(search?: string) {
  const db = await getDb();
  if (!db) return [];
  if (search) {
    return db.select().from(users).where(
      sql`(${users.name} LIKE ${`%${search}%`} OR ${users.email} LIKE ${`%${search}%`})`
    ).orderBy(users.createdAt);
  }
  return db.select().from(users).orderBy(users.createdAt);
}
