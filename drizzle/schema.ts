import {
  boolean,
  decimal,
  integer,
  json,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

// ─── ENUMS ────────────────────────────────────────────────────────────────────
export const propertyTypeEnum = pgEnum("property_type", ["hoa", "condo", "commercial", "residential"]);
export const propertyStatusEnum = pgEnum("property_status", ["active", "inactive"]);
export const userRoleEnum = pgEnum("user_role", [
  "super_admin", "company_admin", "portfolio_manager", "manager",
  "accountant", "assistant", "board_member", "user", "admin",
]);
export const invitationRoleEnum = pgEnum("invitation_role", [
  "super_admin", "company_admin", "portfolio_manager", "manager",
  "accountant", "assistant", "board_member",
]);
export const invitationStatusEnum = pgEnum("invitation_status", ["pending", "accepted", "expired", "revoked"]);
export const paymentTypeEnum = pgEnum("payment_type", ["check", "ach", "online", "credit_card"]);
export const transactionTypeEnum = pgEnum("transaction_type", [
  "receipt", "charge", "bill", "payment", "journal_entry", "bank_deposit", "bank_transfer",
]);
export const transactionStatusEnum = pgEnum("transaction_status", ["pending", "approved", "paid", "void", "posted"]);
export const glAccountTypeEnum = pgEnum("gl_account_type", [
  "asset", "liability", "equity", "income", "expense", "bank",
]);
export const frequencyEnum = pgEnum("frequency", ["daily", "weekly", "monthly", "quarterly"]);
export const severityEnum = pgEnum("severity", ["low", "medium", "high", "critical"]);
export const activityTypeEnum = pgEnum("activity_type", [
  "transaction_created", "report_run", "invoice_processed", "user_invited",
  "property_updated", "bill_approved", "diagnostic_resolved", "file_updated",
]);

// ─── COMPANIES ────────────────────────────────────────────────────────────────
export const companies = pgTable("companies", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  code: varchar("code", { length: 64 }).notNull().unique(),
  address: text("address"),
  phone: varchar("phone", { length: 32 }),
  email: varchar("email", { length: 320 }),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

// ─── PROPERTIES / ASSOCIATIONS ────────────────────────────────────────────────
export const properties = pgTable("properties", {
  id: serial("id").primaryKey(),
  companyId: integer("companyId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  address: text("address"),
  city: varchar("city", { length: 128 }),
  state: varchar("state", { length: 64 }),
  zip: varchar("zip", { length: 16 }),
  type: propertyTypeEnum("type").default("hoa").notNull(),
  status: propertyStatusEnum("status").default("active").notNull(),
  unitCount: integer("unitCount").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

// ─── USERS ────────────────────────────────────────────────────────────────────
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: userRoleEnum("role").default("user").notNull(),
  companyId: integer("companyId"),
  assignedPropertyIds: json("assignedPropertyIds").$type<number[]>(),
  invitedBy: integer("invitedBy"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── INVITATIONS ──────────────────────────────────────────────────────────────
export const invitations = pgTable("invitations", {
  id: serial("id").primaryKey(),
  token: varchar("token", { length: 128 }).notNull().unique(),
  email: varchar("email", { length: 320 }).notNull(),
  role: invitationRoleEnum("role").notNull(),
  companyId: integer("companyId"),
  assignedPropertyIds: json("assignedPropertyIds").$type<number[]>(),
  invitedBy: integer("invitedBy").notNull(),
  status: invitationStatusEnum("status").default("pending").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  acceptedAt: timestamp("acceptedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── VENDORS ──────────────────────────────────────────────────────────────────
export const vendors = pgTable("vendors", {
  id: serial("id").primaryKey(),
  companyId: integer("companyId").notNull(),
  companyName: varchar("companyName", { length: 255 }).notNull(),
  contactName: varchar("contactName", { length: 255 }),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 32 }),
  address: text("address"),
  trades: json("trades").$type<string[]>(),
  paymentType: paymentTypeEnum("paymentType").default("check"),
  w9OnFile: boolean("w9OnFile").default(false),
  is1099Vendor: boolean("is1099Vendor").default(false),
  licenseExpiry: timestamp("licenseExpiry"),
  insuranceExpiry: timestamp("insuranceExpiry"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

// ─── OWNERS ───────────────────────────────────────────────────────────────────
export const owners = pgTable("owners", {
  id: serial("id").primaryKey(),
  propertyId: integer("propertyId").notNull(),
  firstName: varchar("firstName", { length: 128 }).notNull(),
  lastName: varchar("lastName", { length: 128 }).notNull(),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 32 }),
  unit: varchar("unit", { length: 32 }),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

// ─── GL ACCOUNTS ──────────────────────────────────────────────────────────────
export const glAccounts = pgTable("gl_accounts", {
  id: serial("id").primaryKey(),
  propertyId: integer("propertyId"),
  accountNumber: varchar("accountNumber", { length: 32 }).notNull(),
  accountName: varchar("accountName", { length: 255 }).notNull(),
  accountType: glAccountTypeEnum("accountType").notNull(),
  parentAccountId: integer("parentAccountId"),
  description: text("description"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── BANK ACCOUNTS ────────────────────────────────────────────────────────────
export const bankAccounts = pgTable("bank_accounts", {
  id: serial("id").primaryKey(),
  propertyId: integer("propertyId").notNull(),
  glAccountId: integer("glAccountId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  bankName: varchar("bankName", { length: 255 }),
  accountNumberLast4: varchar("accountNumberLast4", { length: 4 }),
  lastReconciliation: timestamp("lastReconciliation"),
  paymentsEnabled: boolean("paymentsEnabled").default(false),
  autoReconciliation: boolean("autoReconciliation").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── TRANSACTIONS (unified ledger) ────────────────────────────────────────────
export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  propertyId: integer("propertyId").notNull(),
  transactionType: transactionTypeEnum("transactionType").notNull(),
  date: timestamp("date").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  glAccountId: integer("glAccountId"),
  cashAccountId: integer("cashAccountId"),
  vendorId: integer("vendorId"),
  ownerId: integer("ownerId"),
  referenceNumber: varchar("referenceNumber", { length: 128 }),
  description: text("description"),
  status: transactionStatusEnum("status").default("pending").notNull(),
  manusAutoCreated: boolean("manusAutoCreated").default(false),
  createdBy: integer("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

// ─── JOURNAL ENTRY LINES ──────────────────────────────────────────────────────
export const journalEntryLines = pgTable("journal_entry_lines", {
  id: serial("id").primaryKey(),
  transactionId: integer("transactionId").notNull(),
  glAccountId: integer("glAccountId").notNull(),
  debit: decimal("debit", { precision: 12, scale: 2 }).default("0"),
  credit: decimal("credit", { precision: 12, scale: 2 }).default("0"),
  memo: text("memo"),
});

// ─── SCHEDULED REPORTS ────────────────────────────────────────────────────────
export const scheduledReports = pgTable("scheduled_reports", {
  id: serial("id").primaryKey(),
  propertyId: integer("propertyId"),
  reportType: varchar("reportType", { length: 128 }).notNull(),
  reportName: varchar("reportName", { length: 255 }).notNull(),
  frequency: frequencyEnum("frequency").notNull(),
  parameters: json("parameters"),
  recipients: json("recipients").$type<string[]>(),
  lastRun: timestamp("lastRun"),
  isActive: boolean("isActive").default(true).notNull(),
  createdBy: integer("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── DIAGNOSTIC FLAGS ─────────────────────────────────────────────────────────
export const diagnosticFlags = pgTable("diagnostic_flags", {
  id: serial("id").primaryKey(),
  propertyId: integer("propertyId").notNull(),
  flagType: varchar("flagType", { length: 128 }).notNull(),
  description: text("description"),
  severity: severityEnum("severity").default("medium").notNull(),
  detectedAt: timestamp("detectedAt").defaultNow().notNull(),
  resolvedAt: timestamp("resolvedAt"),
  manusResolutionDraft: text("manusResolutionDraft"),
});

// ─── RECENT ACTIVITY ──────────────────────────────────────────────────────────
export const recentActivity = pgTable("recent_activity", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  propertyId: integer("propertyId"),
  activityType: activityTypeEnum("activityType").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
