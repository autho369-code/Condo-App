import {
  boolean,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

// ─── Role Enum ────────────────────────────────────────────────────────────────
export const portierRoleEnum = pgEnum("portier_role", [
  "super_admin",
  "company_admin",
  "portfolio_manager",
  "property_manager",
  "accountant",
  "assistant_manager",
  "owner",
  "vendor",
  "resident",
  "user",
]);

// ─── Users ────────────────────────────────────────────────────────────────────
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: text("role").default("user").notNull(),
  portierRole: portierRoleEnum("portierRole").default("user"),
  companyId: integer("companyId"),
  avatarUrl: text("avatarUrl"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Companies ────────────────────────────────────────────────────────────────
export const tierEnum = pgEnum("tier", ["starter", "growth", "professional", "enterprise"]);

export const companies = pgTable("companies", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 30 }),
  address: text("address"),
  logoUrl: text("logoUrl"),
  brandColor: varchar("brandColor", { length: 7 }).default("#2D4A3E"),
  tier: tierEnum("tier").default("starter").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type Company = typeof companies.$inferSelect;
export type InsertCompany = typeof companies.$inferInsert;

// ─── Properties ───────────────────────────────────────────────────────────────
export const properties = pgTable("properties", {
  id: serial("id").primaryKey(),
  companyId: integer("companyId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  address: text("address"),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 50 }),
  zip: varchar("zip", { length: 20 }),
  country: varchar("country", { length: 50 }).default("US"),
  totalUnits: integer("totalUnits").default(0),
  yearBuilt: integer("yearBuilt"),
  propertyType: text("propertyType").default("condominium"),
  amenities: text("amenities"),
  notes: text("notes"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type Property = typeof properties.$inferSelect;
export type InsertProperty = typeof properties.$inferInsert;

// ─── Property Assignments ─────────────────────────────────────────────────────
export const propertyAssignments = pgTable("property_assignments", {
  id: serial("id").primaryKey(),
  propertyId: integer("propertyId").notNull(),
  userId: integer("userId").notNull(),
  role: portierRoleEnum("role").default("property_manager"),
  assignedAt: timestamp("assignedAt").defaultNow().notNull(),
});
export type PropertyAssignment = typeof propertyAssignments.$inferSelect;

// ─── Work Tickets ─────────────────────────────────────────────────────────────
export const ticketCategoryEnum = pgEnum("ticket_category", [
  "common_area", "unit_related", "emergency", "vendor", "board_matter", "maintenance", "other",
]);
export const ticketPriorityEnum = pgEnum("ticket_priority", ["low", "medium", "high", "urgent"]);
export const ticketStatusEnum = pgEnum("ticket_status", ["open", "in_progress", "pending_vendor", "resolved", "closed"]);
export const ticketSourceEnum = pgEnum("ticket_source", ["portal", "email", "phone", "manager", "system"]);

export const tickets = pgTable("tickets", {
  id: serial("id").primaryKey(),
  propertyId: integer("propertyId").notNull(),
  companyId: integer("companyId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  category: ticketCategoryEnum("category").default("other").notNull(),
  priority: ticketPriorityEnum("priority").default("medium").notNull(),
  status: ticketStatusEnum("status").default("open").notNull(),
  reportedById: integer("reportedById"),
  assignedToId: integer("assignedToId"),
  unitNumber: varchar("unitNumber", { length: 20 }),
  source: ticketSourceEnum("source").default("manager").notNull(),
  sourceEmailId: integer("sourceEmailId"),
  dueDate: timestamp("dueDate"),
  resolvedAt: timestamp("resolvedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type Ticket = typeof tickets.$inferSelect;
export type InsertTicket = typeof tickets.$inferInsert;

// ─── Ticket Comments ──────────────────────────────────────────────────────────
export const ticketComments = pgTable("ticket_comments", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticketId").notNull(),
  authorId: integer("authorId").notNull(),
  content: text("content").notNull(),
  isInternal: boolean("isInternal").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type TicketComment = typeof ticketComments.$inferSelect;

// ─── Schedule Events ──────────────────────────────────────────────────────────
export const eventTypeEnum = pgEnum("event_type", [
  "inspection", "vendor_visit", "maintenance", "board_meeting", "deadline", "owner_meeting", "other",
]);

export const scheduleEvents = pgTable("schedule_events", {
  id: serial("id").primaryKey(),
  propertyId: integer("propertyId").notNull(),
  companyId: integer("companyId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  eventType: eventTypeEnum("eventType").default("other").notNull(),
  startTime: timestamp("startTime").notNull(),
  endTime: timestamp("endTime"),
  isAllDay: boolean("isAllDay").default(false).notNull(),
  isRecurring: boolean("isRecurring").default(false).notNull(),
  recurringPattern: varchar("recurringPattern", { length: 50 }),
  assignedToId: integer("assignedToId"),
  ticketId: integer("ticketId"),
  createdById: integer("createdById"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type ScheduleEvent = typeof scheduleEvents.$inferSelect;
export type InsertScheduleEvent = typeof scheduleEvents.$inferInsert;

// ─── Meetings ─────────────────────────────────────────────────────────────────
export const meetingTypeEnum = pgEnum("meeting_type", [
  "board_meeting", "annual_meeting", "special_meeting", "committee_meeting", "vendor_meeting", "internal",
]);
export const meetingStatusEnum = pgEnum("meeting_status", ["scheduled", "in_progress", "completed", "cancelled"]);

export const meetings = pgTable("meetings", {
  id: serial("id").primaryKey(),
  propertyId: integer("propertyId").notNull(),
  companyId: integer("companyId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  meetingType: meetingTypeEnum("meetingType").default("board_meeting").notNull(),
  scheduledAt: timestamp("scheduledAt"),
  location: varchar("location", { length: 255 }),
  agenda: text("agenda"),
  minutes: text("minutes"),
  aiSummary: text("aiSummary"),
  status: meetingStatusEnum("status").default("scheduled").notNull(),
  attendees: text("attendees"),
  createdById: integer("createdById"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type Meeting = typeof meetings.$inferSelect;
export type InsertMeeting = typeof meetings.$inferInsert;

// ─── Meeting Action Items ─────────────────────────────────────────────────────
export const meetingActionItems = pgTable("meeting_action_items", {
  id: serial("id").primaryKey(),
  meetingId: integer("meetingId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  assignedToId: integer("assignedToId"),
  dueDate: timestamp("dueDate"),
  isCompleted: boolean("isCompleted").default(false).notNull(),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type MeetingActionItem = typeof meetingActionItems.$inferSelect;

// ─── Vendors ──────────────────────────────────────────────────────────────────
export const vendorCategoryEnum = pgEnum("vendor_category", [
  "plumbing", "electrical", "hvac", "landscaping", "cleaning",
  "security", "elevator", "general", "other",
]);

export const vendors = pgTable("vendors", {
  id: serial("id").primaryKey(),
  companyId: integer("companyId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  contactName: varchar("contactName", { length: 255 }),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 30 }),
  address: text("address"),
  specialty: varchar("specialty", { length: 255 }),
  category: vendorCategoryEnum("category").default("general").notNull(),
  licenseNumber: varchar("licenseNumber", { length: 100 }),
  insuranceExpiry: timestamp("insuranceExpiry"),
  rating: integer("rating"),
  isActive: boolean("isActive").default(true).notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type Vendor = typeof vendors.$inferSelect;
export type InsertVendor = typeof vendors.$inferInsert;

// ─── Email Threads ────────────────────────────────────────────────────────────
export const aiUrgencyEnum = pgEnum("ai_urgency", ["critical", "high", "medium", "low"]);
export const aiCategoryEnum = pgEnum("ai_category", [
  "maintenance_request", "billing_payment", "noise_complaint", "amenity_booking",
  "vendor_communication", "board_matter", "emergency", "general_inquiry", "lease_ownership", "other",
]);
export const emailSourceEnum = pgEnum("email_source", ["gmail", "outlook", "manual"]);

export const emailThreads = pgTable("email_threads", {
  id: serial("id").primaryKey(),
  companyId: integer("companyId").notNull(),
  propertyId: integer("propertyId"),
  ticketId: integer("ticketId"),
  subject: varchar("subject", { length: 500 }),
  fromAddress: varchar("fromAddress", { length: 320 }),
  toAddresses: text("toAddresses"),
  bodyPreview: text("bodyPreview"),
  fullBody: text("fullBody"),
  aiSummary: text("aiSummary"),
  aiDraftReply: text("aiDraftReply"),
  aiUrgency: aiUrgencyEnum("aiUrgency"),
  aiCategory: aiCategoryEnum("aiCategory"),
  aiMatchedPropertyId: integer("aiMatchedPropertyId"),
  aiConfidence: integer("aiConfidence"),
  aiReasoning: text("aiReasoning"),
  aiCategorizedAt: timestamp("aiCategorizedAt"),
  convertedToTicketId: integer("convertedToTicketId"),
  isRead: boolean("isRead").default(false).notNull(),
  source: emailSourceEnum("source").default("manual").notNull(),
  receivedAt: timestamp("receivedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type EmailThread = typeof emailThreads.$inferSelect;
export type InsertEmailThread = typeof emailThreads.$inferInsert;

// ─── Email Connections ────────────────────────────────────────────────────────
export const emailProviderEnum = pgEnum("email_provider", ["gmail", "outlook"]);

export const emailConnections = pgTable("email_connections", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  companyId: integer("companyId").notNull(),
  provider: emailProviderEnum("provider").notNull(),
  accountEmail: varchar("accountEmail", { length: 320 }).notNull(),
  accessToken: text("accessToken").notNull(),
  refreshToken: text("refreshToken"),
  expiresAt: timestamp("expiresAt"),
  lastSyncedAt: timestamp("lastSyncedAt"),
  syncCursor: text("syncCursor"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type EmailConnection = typeof emailConnections.$inferSelect;
export type InsertEmailConnection = typeof emailConnections.$inferInsert;

// ─── Ticket Attachments ───────────────────────────────────────────────────────
export const ticketAttachments = pgTable("ticket_attachments", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticketId").notNull(),
  companyId: integer("companyId").notNull(),
  uploadedById: integer("uploadedById").notNull(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  fileKey: varchar("fileKey", { length: 512 }).notNull(),
  fileUrl: text("fileUrl").notNull(),
  mimeType: varchar("mimeType", { length: 100 }).notNull(),
  fileSize: integer("fileSize").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type TicketAttachment = typeof ticketAttachments.$inferSelect;
export type InsertTicketAttachment = typeof ticketAttachments.$inferInsert;

// ─── Owner Accounts ───────────────────────────────────────────────────────────
export const ownerAccounts = pgTable("owner_accounts", {
  id: serial("id").primaryKey(),
  ownerId: integer("ownerId").notNull(),
  propertyId: integer("propertyId").notNull(),
  companyId: integer("companyId").notNull(),
  balanceCents: integer("balanceCents").default(0).notNull(),
  currency: varchar("currency", { length: 3 }).default("USD").notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type OwnerAccount = typeof ownerAccounts.$inferSelect;
export type InsertOwnerAccount = typeof ownerAccounts.$inferInsert;

// ─── Payment Transactions ─────────────────────────────────────────────────────
export const paymentMethodEnum = pgEnum("payment_method", ["ach", "check", "credit_card", "cash", "other"]);
export const paymentStatusEnum = pgEnum("payment_status", ["pending", "confirmed", "failed", "refunded"]);
export const paymentTypeEnum = pgEnum("payment_type", ["payment", "charge", "credit", "refund"]);

export const paymentTransactions = pgTable("payment_transactions", {
  id: serial("id").primaryKey(),
  ownerAccountId: integer("ownerAccountId").notNull(),
  ownerId: integer("ownerId").notNull(),
  propertyId: integer("propertyId").notNull(),
  companyId: integer("companyId").notNull(),
  amountCents: integer("amountCents").notNull(),
  type: paymentTypeEnum("type").default("payment").notNull(),
  method: paymentMethodEnum("method").default("other").notNull(),
  status: paymentStatusEnum("status").default("pending").notNull(),
  description: text("description"),
  referenceNumber: varchar("referenceNumber", { length: 100 }),
  memo: text("memo"),
  confirmedAt: timestamp("confirmedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type PaymentTransaction = typeof paymentTransactions.$inferSelect;
export type InsertPaymentTransaction = typeof paymentTransactions.$inferInsert;

// ─── Property Documents ───────────────────────────────────────────────────────
export const documentCategoryEnum = pgEnum("document_category", [
  "governing_documents", "meeting_minutes", "financial_reports",
  "insurance", "contracts", "notices", "forms", "other",
]);

export const propertyDocuments = pgTable("property_documents", {
  id: serial("id").primaryKey(),
  propertyId: integer("propertyId").notNull(),
  companyId: integer("companyId").notNull(),
  uploadedById: integer("uploadedById").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  category: documentCategoryEnum("category").default("other").notNull(),
  description: text("description"),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  fileKey: varchar("fileKey", { length: 512 }).notNull(),
  fileUrl: text("fileUrl").notNull(),
  mimeType: varchar("mimeType", { length: 100 }).notNull(),
  fileSize: integer("fileSize").notNull(),
  isSharedWithOwners: boolean("isSharedWithOwners").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type PropertyDocument = typeof propertyDocuments.$inferSelect;
export type InsertPropertyDocument = typeof propertyDocuments.$inferInsert;

// ─── Owner Messages ───────────────────────────────────────────────────────────
export const messageDirectionEnum = pgEnum("message_direction", ["owner_to_manager", "manager_to_owner"]);
export const messageChannelEnum = pgEnum("message_channel", ["in_app", "email", "text"]);

export const ownerMessages = pgTable("owner_messages", {
  id: serial("id").primaryKey(),
  propertyId: integer("propertyId").notNull(),
  companyId: integer("companyId").notNull(),
  ownerId: integer("ownerId").notNull(),
  managerId: integer("managerId"),
  direction: messageDirectionEnum("direction").notNull(),
  channel: messageChannelEnum("channel").default("in_app").notNull(),
  subject: varchar("subject", { length: 255 }),
  body: text("body").notNull(),
  isRead: boolean("isRead").default(false).notNull(),
  isReadByManager: boolean("isReadByManager").default(false).notNull(),
  threadKey: varchar("threadKey", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type OwnerMessage = typeof ownerMessages.$inferSelect;
export type InsertOwnerMessage = typeof ownerMessages.$inferInsert;

// ─── Owner Notifications ──────────────────────────────────────────────────────
export const notificationTypeEnum = pgEnum("notification_type", [
  "document_shared", "payment_due", "message_received", "ticket_update", "general",
]);

export const ownerNotifications = pgTable("owner_notifications", {
  id: serial("id").primaryKey(),
  ownerId: integer("ownerId").notNull(),
  propertyId: integer("propertyId").notNull(),
  companyId: integer("companyId").notNull(),
  type: notificationTypeEnum("type").default("general").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  body: text("body").notNull(),
  documentId: integer("documentId"),
  ticketId: integer("ticketId"),
  isRead: boolean("isRead").default(false).notNull(),
  readAt: timestamp("readAt"),
  emailSent: boolean("emailSent").default(false).notNull(),
  emailSentAt: timestamp("emailSentAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type OwnerNotification = typeof ownerNotifications.$inferSelect;
export type InsertOwnerNotification = typeof ownerNotifications.$inferInsert;

// ─── Owner Notification Preferences ──────────────────────────────────────────
export const ownerNotificationPrefs = pgTable("owner_notification_prefs", {
  id: serial("id").primaryKey(),
  ownerId: integer("ownerId").notNull().unique(),
  docSharedInApp:    boolean("docSharedInApp").default(true).notNull(),
  docSharedEmail:    boolean("docSharedEmail").default(true).notNull(),
  paymentDueInApp:   boolean("paymentDueInApp").default(true).notNull(),
  paymentDueEmail:   boolean("paymentDueEmail").default(true).notNull(),
  msgReceivedInApp:  boolean("msgReceivedInApp").default(true).notNull(),
  msgReceivedEmail:  boolean("msgReceivedEmail").default(true).notNull(),
  ticketUpdateInApp: boolean("ticketUpdateInApp").default(true).notNull(),
  ticketUpdateEmail: boolean("ticketUpdateEmail").default(true).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type OwnerNotificationPrefs = typeof ownerNotificationPrefs.$inferSelect;
export type InsertOwnerNotificationPrefs = typeof ownerNotificationPrefs.$inferInsert;
