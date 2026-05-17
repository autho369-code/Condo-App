import {
  boolean,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

// ─── Role Enum ────────────────────────────────────────────────────────────────
// Hierarchy: super_admin > company_admin > portfolio_manager > property_manager
// Sub-roles (added by property_manager): accountant, assistant_manager, owner, vendor, resident
export const portierRoleEnum = mysqlEnum("portier_role", [
  "super_admin",
  "company_admin",
  "portfolio_manager",
  "property_manager",
  "accountant",
  "assistant_manager",
  "owner",
  "vendor",
  "resident",
  "user", // default before role assignment
]);

// ─── Users ────────────────────────────────────────────────────────────────────
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  // Platform-level role (admin = super_admin in Portier context)
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  // Portier-specific role within the property management hierarchy
  portierRole: portierRoleEnum.default("user"),
  // Which company this user belongs to (null = super_admin or unassigned)
  companyId: int("companyId"),
  // Profile photo URL
  avatarUrl: text("avatarUrl"),
  // Whether this user is active
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Companies (Property Management Companies) ────────────────────────────────
export const companies = mysqlTable("companies", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 30 }),
  address: text("address"),
  logoUrl: text("logoUrl"),
  // White-label: custom primary color (hex)
  brandColor: varchar("brandColor", { length: 7 }).default("#2D4A3E"),
  // Subscription tier
  tier: mysqlEnum("tier", ["starter", "growth", "professional", "enterprise"]).default("starter").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Company = typeof companies.$inferSelect;
export type InsertCompany = typeof companies.$inferInsert;

// ─── Properties (Individual Condo Communities) ────────────────────────────────
export const properties = mysqlTable("properties", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  address: text("address"),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 50 }),
  zip: varchar("zip", { length: 20 }),
  unitCount: int("unitCount").default(0),
  propertyType: mysqlEnum("propertyType", ["condominium", "hoa", "coop"]).default("condominium").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Property = typeof properties.$inferSelect;
export type InsertProperty = typeof properties.$inferInsert;

// ─── Property Assignments (Manager ↔ Property) ────────────────────────────────
export const propertyAssignments = mysqlTable("property_assignments", {
  id: int("id").autoincrement().primaryKey(),
  propertyId: int("propertyId").notNull(),
  userId: int("userId").notNull(),
  role: portierRoleEnum.default("property_manager"),
  assignedAt: timestamp("assignedAt").defaultNow().notNull(),
});

export type PropertyAssignment = typeof propertyAssignments.$inferSelect;

// ─── Work Tickets ─────────────────────────────────────────────────────────────
export const tickets = mysqlTable("tickets", {
  id: int("id").autoincrement().primaryKey(),
  propertyId: int("propertyId").notNull(),
  companyId: int("companyId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  category: mysqlEnum("category", [
    "common_area",
    "unit_related",
    "emergency",
    "vendor",
    "board_matter",
    "maintenance",
    "other",
  ]).default("other").notNull(),
  priority: mysqlEnum("priority", ["low", "medium", "high", "urgent"]).default("medium").notNull(),
  status: mysqlEnum("status", ["open", "in_progress", "pending_vendor", "resolved", "closed"]).default("open").notNull(),
  // Who reported it
  reportedById: int("reportedById"),
  // Who is assigned to resolve it
  assignedToId: int("assignedToId"),
  // Unit number if unit-related
  unitNumber: varchar("unitNumber", { length: 20 }),
  // Source of the ticket
  source: mysqlEnum("source", ["portal", "email", "phone", "manager", "system"]).default("manager").notNull(),
  // If this ticket was created from an email, link back to the email thread
  sourceEmailId: int("sourceEmailId"),
  dueDate: timestamp("dueDate"),
  resolvedAt: timestamp("resolvedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Ticket = typeof tickets.$inferSelect;
export type InsertTicket = typeof tickets.$inferInsert;

// ─── Ticket Comments ──────────────────────────────────────────────────────────
export const ticketComments = mysqlTable("ticket_comments", {
  id: int("id").autoincrement().primaryKey(),
  ticketId: int("ticketId").notNull(),
  authorId: int("authorId").notNull(),
  content: text("content").notNull(),
  isInternal: boolean("isInternal").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TicketComment = typeof ticketComments.$inferSelect;

// ─── Schedule Events ──────────────────────────────────────────────────────────
export const scheduleEvents = mysqlTable("schedule_events", {
  id: int("id").autoincrement().primaryKey(),
  propertyId: int("propertyId").notNull(),
  companyId: int("companyId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  eventType: mysqlEnum("eventType", [
    "inspection",
    "vendor_visit",
    "maintenance",
    "board_meeting",
    "deadline",
    "owner_meeting",
    "other",
  ]).default("other").notNull(),
  startTime: timestamp("startTime").notNull(),
  endTime: timestamp("endTime"),
  isAllDay: boolean("isAllDay").default(false).notNull(),
  isRecurring: boolean("isRecurring").default(false).notNull(),
  recurringPattern: varchar("recurringPattern", { length: 50 }),
  assignedToId: int("assignedToId"),
  ticketId: int("ticketId"),
  createdById: int("createdById"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ScheduleEvent = typeof scheduleEvents.$inferSelect;
export type InsertScheduleEvent = typeof scheduleEvents.$inferInsert;

// ─── Meetings ─────────────────────────────────────────────────────────────────
export const meetings = mysqlTable("meetings", {
  id: int("id").autoincrement().primaryKey(),
  propertyId: int("propertyId").notNull(),
  companyId: int("companyId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  meetingType: mysqlEnum("meetingType", [
    "board_meeting",
    "annual_meeting",
    "special_meeting",
    "committee_meeting",
    "vendor_meeting",
    "internal",
  ]).default("board_meeting").notNull(),
  scheduledAt: timestamp("scheduledAt"),
  location: varchar("location", { length: 255 }),
  agenda: text("agenda"),
  minutes: text("minutes"),
  aiSummary: text("aiSummary"),
  status: mysqlEnum("status", ["scheduled", "in_progress", "completed", "cancelled"]).default("scheduled").notNull(),
  createdById: int("createdById"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Meeting = typeof meetings.$inferSelect;
export type InsertMeeting = typeof meetings.$inferInsert;

// ─── Meeting Action Items ─────────────────────────────────────────────────────
export const meetingActionItems = mysqlTable("meeting_action_items", {
  id: int("id").autoincrement().primaryKey(),
  meetingId: int("meetingId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  assignedToId: int("assignedToId"),
  dueDate: timestamp("dueDate"),
  isCompleted: boolean("isCompleted").default(false).notNull(),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type MeetingActionItem = typeof meetingActionItems.$inferSelect;

// ─── Vendors ──────────────────────────────────────────────────────────────────
export const vendors = mysqlTable("vendors", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  contactName: varchar("contactName", { length: 255 }),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 30 }),
  category: mysqlEnum("category", [
    "plumbing",
    "electrical",
    "hvac",
    "landscaping",
    "cleaning",
    "security",
    "elevator",
    "general",
    "other",
  ]).default("general").notNull(),
  insuranceExpiry: timestamp("insuranceExpiry"),
  isActive: boolean("isActive").default(true).notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Vendor = typeof vendors.$inferSelect;
export type InsertVendor = typeof vendors.$inferInsert;

// ─── Email Threads ────────────────────────────────────────────────────────────
export const emailThreads = mysqlTable("email_threads", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  propertyId: int("propertyId"),
  ticketId: int("ticketId"),
  subject: varchar("subject", { length: 500 }),
  fromAddress: varchar("fromAddress", { length: 320 }),
  toAddresses: text("toAddresses"),
  bodyPreview: text("bodyPreview"),
  fullBody: text("fullBody"),
  aiSummary: text("aiSummary"),
  aiDraftReply: text("aiDraftReply"),
  // AI categorization fields
  aiUrgency: mysqlEnum("aiUrgency", ["critical", "high", "medium", "low"]),
  aiCategory: mysqlEnum("aiCategory", [
    "maintenance_request",
    "billing_payment",
    "noise_complaint",
    "amenity_booking",
    "vendor_communication",
    "board_matter",
    "emergency",
    "general_inquiry",
    "lease_ownership",
    "other",
  ]),
  aiMatchedPropertyId: int("aiMatchedPropertyId"),
  aiConfidence: int("aiConfidence"), // 0-100
  aiReasoning: text("aiReasoning"),
  aiCategorizedAt: timestamp("aiCategorizedAt"),
  // If this email was converted to a ticket, store the ticket ID
  convertedToTicketId: int("convertedToTicketId"),
  isRead: boolean("isRead").default(false).notNull(),
  source: mysqlEnum("source", ["gmail", "outlook", "manual"]).default("manual").notNull(),
  receivedAt: timestamp("receivedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type EmailThread = typeof emailThreads.$inferSelect;
export type InsertEmailThread = typeof emailThreads.$inferInsert;

// ─── Email Connections (OAuth tokens per user per provider) ───────────────────
export const emailConnections = mysqlTable("email_connections", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  companyId: int("companyId").notNull(),
  provider: mysqlEnum("provider", ["gmail", "outlook"]).notNull(),
  // The email address of the connected account
  accountEmail: varchar("accountEmail", { length: 320 }).notNull(),
  // OAuth tokens (encrypted at rest via application logic)
  accessToken: text("accessToken").notNull(),
  refreshToken: text("refreshToken"),
  expiresAt: timestamp("expiresAt"),
  // Sync state
  lastSyncedAt: timestamp("lastSyncedAt"),
  syncCursor: text("syncCursor"), // Gmail historyId or Outlook deltaLink
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type EmailConnection = typeof emailConnections.$inferSelect;
export type InsertEmailConnection = typeof emailConnections.$inferInsert;

// ─── Ticket Attachments ──────────────────────────────────────────────────────
export const ticketAttachments = mysqlTable("ticket_attachments", {
  id: int("id").autoincrement().primaryKey(),
  ticketId: int("ticketId").notNull(),
  companyId: int("companyId").notNull(),
  uploadedById: int("uploadedById").notNull(),
  // Original file name shown to users
  fileName: varchar("fileName", { length: 255 }).notNull(),
  // S3 storage key (used to build the URL)
  fileKey: varchar("fileKey", { length: 512 }).notNull(),
  // Served URL from storage
  fileUrl: text("fileUrl").notNull(),
  // MIME type e.g. image/jpeg, application/pdf
  mimeType: varchar("mimeType", { length: 100 }).notNull(),
  // File size in bytes
  fileSize: int("fileSize").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TicketAttachment = typeof ticketAttachments.$inferSelect;
export type InsertTicketAttachment = typeof ticketAttachments.$inferInsert;

// ─── Owner Accounts (Balance Ledger) ─────────────────────────────────────────
export const ownerAccounts = mysqlTable("owner_accounts", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull(),       // references users.id
  propertyId: int("propertyId").notNull(), // references properties.id
  companyId: int("companyId").notNull(),
  // Current balance in cents (positive = owed to company, negative = credit)
  balanceCents: int("balanceCents").default(0).notNull(),
  currency: varchar("currency", { length: 3 }).default("USD").notNull(),
  notes: text("notes"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type OwnerAccount = typeof ownerAccounts.$inferSelect;
export type InsertOwnerAccount = typeof ownerAccounts.$inferInsert;

// ─── Payment Transactions ─────────────────────────────────────────────────────
export const paymentTransactions = mysqlTable("payment_transactions", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull(),
  propertyId: int("propertyId").notNull(),
  companyId: int("companyId").notNull(),
  // Amount in cents (positive = payment from owner, negative = charge/fee)
  amountCents: int("amountCents").notNull(),
  currency: varchar("currency", { length: 3 }).default("USD").notNull(),
  method: mysqlEnum("method", ["ach", "credit_card", "check", "wire", "other"]).default("other").notNull(),
  status: mysqlEnum("status", ["pending", "processing", "completed", "failed", "refunded"]).default("pending").notNull(),
  description: varchar("description", { length: 500 }),
  // Reference number (check #, transaction ID, etc.)
  referenceNumber: varchar("referenceNumber", { length: 100 }),
  // If paid via Stripe, store the payment intent ID
  stripePaymentIntentId: varchar("stripePaymentIntentId", { length: 255 }),
  processedAt: timestamp("processedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PaymentTransaction = typeof paymentTransactions.$inferSelect;
export type InsertPaymentTransaction = typeof paymentTransactions.$inferInsert;

// ─── Property Documents ───────────────────────────────────────────────────────
export const propertyDocuments = mysqlTable("property_documents", {
  id: int("id").autoincrement().primaryKey(),
  propertyId: int("propertyId").notNull(),
  companyId: int("companyId").notNull(),
  uploadedById: int("uploadedById").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  category: mysqlEnum("category", [
    "governing_document",
    "meeting_minutes",
    "financial_report",
    "insurance",
    "maintenance_record",
    "notice",
    "other",
  ]).default("other").notNull(),
  // S3 storage key
  fileKey: varchar("fileKey", { length: 512 }).notNull(),
  fileUrl: text("fileUrl").notNull(),
  mimeType: varchar("mimeType", { length: 100 }).notNull(),
  fileSize: int("fileSize").notNull(),
  // Whether this document is visible to owners/residents in their portal
  isSharedWithOwners: boolean("isSharedWithOwners").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PropertyDocument = typeof propertyDocuments.$inferSelect;
export type InsertPropertyDocument = typeof propertyDocuments.$inferInsert;

// ─── Owner Messages (Direct messaging: owner ↔ management) ───────────────────
export const ownerMessages = mysqlTable("owner_messages", {
  id: int("id").autoincrement().primaryKey(),
  propertyId: int("propertyId").notNull(),
  companyId: int("companyId").notNull(),
  // The owner or resident who is part of this conversation
  ownerId: int("ownerId").notNull(),
  // The manager who replied (null if not yet replied)
  managerId: int("managerId"),
  // Direction of this specific message
  direction: mysqlEnum("direction", ["owner_to_manager", "manager_to_owner"]).notNull(),
  // Channel preference chosen by owner
  channel: mysqlEnum("channel", ["in_app", "email", "text"]).default("in_app").notNull(),
  subject: varchar("subject", { length: 255 }),
  body: text("body").notNull(),
  isRead: boolean("isRead").default(false).notNull(),
  // Thread grouping: all messages in a conversation share the same threadKey
  threadKey: varchar("threadKey", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type OwnerMessage = typeof ownerMessages.$inferSelect;
export type InsertOwnerMessage = typeof ownerMessages.$inferInsert;

// ─── Owner Notifications ──────────────────────────────────────────────────────
// In-app notifications sent to owners/residents when documents are shared
// or other important events occur.
export const ownerNotifications = mysqlTable("owner_notifications", {
  id: int("id").autoincrement().primaryKey(),
  // Recipient
  ownerId: int("ownerId").notNull(),         // references users.id
  propertyId: int("propertyId").notNull(),   // references properties.id
  companyId: int("companyId").notNull(),
  // Notification type
  type: mysqlEnum("type", [
    "document_shared",
    "payment_due",
    "message_received",
    "ticket_update",
    "general",
  ]).default("general").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  body: text("body").notNull(),
  // Optional deep-link data
  documentId: int("documentId"),   // if type = document_shared
  ticketId: int("ticketId"),       // if type = ticket_update
  // Read state
  isRead: boolean("isRead").default(false).notNull(),
  readAt: timestamp("readAt"),
  // Email delivery tracking
  emailSent: boolean("emailSent").default(false).notNull(),
  emailSentAt: timestamp("emailSentAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type OwnerNotification = typeof ownerNotifications.$inferSelect;
export type InsertOwnerNotification = typeof ownerNotifications.$inferInsert;
