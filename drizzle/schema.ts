import {
  boolean,
  decimal,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

// ─── COMPANIES ────────────────────────────────────────────────────────────────
export const companies = mysqlTable("companies", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  code: varchar("code", { length: 64 }).notNull().unique(),
  address: text("address"),
  phone: varchar("phone", { length: 32 }),
  email: varchar("email", { length: 320 }),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ─── PROPERTIES / ASSOCIATIONS ────────────────────────────────────────────────
export const properties = mysqlTable("properties", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  address: text("address"),
  city: varchar("city", { length: 128 }),
  state: varchar("state", { length: 64 }),
  zip: varchar("zip", { length: 16 }),
  type: mysqlEnum("type", ["hoa", "condo", "commercial", "residential"]).default("hoa").notNull(),
  status: mysqlEnum("status", ["active", "inactive"]).default("active").notNull(),
  unitCount: int("unitCount").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ─── USERS ────────────────────────────────────────────────────────────────────
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", [
    "super_admin",
    "company_admin",
    "portfolio_manager",
    "manager",
    "accountant",
    "assistant",
    "board_member",
    "user",
    "admin",
  ])
    .default("user")
    .notNull(),
  companyId: int("companyId"),
  assignedPropertyIds: json("assignedPropertyIds").$type<number[]>(),
  invitedBy: int("invitedBy"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── INVITATIONS ──────────────────────────────────────────────────────────────
export const invitations = mysqlTable("invitations", {
  id: int("id").autoincrement().primaryKey(),
  token: varchar("token", { length: 128 }).notNull().unique(),
  email: varchar("email", { length: 320 }).notNull(),
  role: mysqlEnum("role", [
    "super_admin",
    "company_admin",
    "portfolio_manager",
    "manager",
    "accountant",
    "assistant",
    "board_member",
  ]).notNull(),
  companyId: int("companyId"),
  assignedPropertyIds: json("assignedPropertyIds").$type<number[]>(),
  invitedBy: int("invitedBy").notNull(),
  status: mysqlEnum("status", ["pending", "accepted", "expired", "revoked"])
    .default("pending")
    .notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  acceptedAt: timestamp("acceptedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── VENDORS ──────────────────────────────────────────────────────────────────
export const vendors = mysqlTable("vendors", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  companyName: varchar("companyName", { length: 255 }).notNull(),
  contactName: varchar("contactName", { length: 255 }),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 32 }),
  address: text("address"),
  paymentType: mysqlEnum("paymentType", ["check", "ach", "online", "credit_card"]).default("check"),
  w9OnFile: boolean("w9OnFile").default(false),
  is1099Vendor: boolean("is1099Vendor").default(false),
  licenseExpiry: timestamp("licenseExpiry"),
  insuranceExpiry: timestamp("insuranceExpiry"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ─── OWNERS ───────────────────────────────────────────────────────────────────
export const owners = mysqlTable("owners", {
  id: int("id").autoincrement().primaryKey(),
  propertyId: int("propertyId").notNull(),
  firstName: varchar("firstName", { length: 128 }).notNull(),
  lastName: varchar("lastName", { length: 128 }).notNull(),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 32 }),
  unit: varchar("unit", { length: 64 }),
  portalAccess: boolean("portalAccess").default(false),
  isDelinquent: boolean("isDelinquent").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ─── GL ACCOUNTS ──────────────────────────────────────────────────────────────
export const glAccounts = mysqlTable("gl_accounts", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  code: int("code").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  type: mysqlEnum("type", [
    "cash",
    "asset",
    "liability",
    "capital",
    "income",
    "expense",
    "other_income",
    "other_expense",
  ]).notNull(),
  parentCode: int("parentCode"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── BANK ACCOUNTS ────────────────────────────────────────────────────────────
export const bankAccounts = mysqlTable("bank_accounts", {
  id: int("id").autoincrement().primaryKey(),
  propertyId: int("propertyId").notNull(),
  glAccountId: int("glAccountId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  bankName: varchar("bankName", { length: 255 }),
  accountNumberLast4: varchar("accountNumberLast4", { length: 4 }),
  lastReconciliation: timestamp("lastReconciliation"),
  paymentsEnabled: boolean("paymentsEnabled").default(false),
  autoReconciliation: boolean("autoReconciliation").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── TRANSACTIONS (unified ledger) ────────────────────────────────────────────
export const transactions = mysqlTable("transactions", {
  id: int("id").autoincrement().primaryKey(),
  propertyId: int("propertyId").notNull(),
  transactionType: mysqlEnum("transactionType", [
    "receipt",
    "charge",
    "bill",
    "payment",
    "journal_entry",
    "bank_deposit",
    "bank_transfer",
  ]).notNull(),
  date: timestamp("date").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  glAccountId: int("glAccountId"),
  cashAccountId: int("cashAccountId"),
  vendorId: int("vendorId"),
  ownerId: int("ownerId"),
  referenceNumber: varchar("referenceNumber", { length: 128 }),
  description: text("description"),
  status: mysqlEnum("status", ["pending", "approved", "paid", "void", "posted"])
    .default("pending")
    .notNull(),
  manusAutoCreated: boolean("manusAutoCreated").default(false),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ─── JOURNAL ENTRY LINES ──────────────────────────────────────────────────────
export const journalEntryLines = mysqlTable("journal_entry_lines", {
  id: int("id").autoincrement().primaryKey(),
  transactionId: int("transactionId").notNull(),
  glAccountId: int("glAccountId").notNull(),
  debit: decimal("debit", { precision: 12, scale: 2 }).default("0"),
  credit: decimal("credit", { precision: 12, scale: 2 }).default("0"),
  memo: text("memo"),
});

// ─── SCHEDULED REPORTS ────────────────────────────────────────────────────────
export const scheduledReports = mysqlTable("scheduled_reports", {
  id: int("id").autoincrement().primaryKey(),
  propertyId: int("propertyId"),
  reportType: varchar("reportType", { length: 128 }).notNull(),
  reportName: varchar("reportName", { length: 255 }).notNull(),
  frequency: mysqlEnum("frequency", ["daily", "weekly", "monthly", "quarterly"]).notNull(),
  parameters: json("parameters"),
  recipients: json("recipients").$type<string[]>(),
  lastRun: timestamp("lastRun"),
  isActive: boolean("isActive").default(true).notNull(),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── DIAGNOSTIC FLAGS ─────────────────────────────────────────────────────────
export const diagnosticFlags = mysqlTable("diagnostic_flags", {
  id: int("id").autoincrement().primaryKey(),
  propertyId: int("propertyId").notNull(),
  flagType: varchar("flagType", { length: 128 }).notNull(),
  description: text("description"),
  severity: mysqlEnum("severity", ["low", "medium", "high", "critical"]).default("medium").notNull(),
  detectedAt: timestamp("detectedAt").defaultNow().notNull(),
  resolvedAt: timestamp("resolvedAt"),
  manusResolutionDraft: text("manusResolutionDraft"),
});

// ─── RECENT ACTIVITY (last 24h projects/actions for right pane) ───────────────
export const recentActivity = mysqlTable("recent_activity", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  propertyId: int("propertyId"),
  activityType: mysqlEnum("activityType", [
    "transaction_created",
    "report_run",
    "invoice_processed",
    "user_invited",
    "property_updated",
    "bill_approved",
    "diagnostic_resolved",
    "file_updated",
  ]).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
