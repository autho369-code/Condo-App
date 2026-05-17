CREATE TYPE "public"."ai_category" AS ENUM('maintenance_request', 'billing_payment', 'noise_complaint', 'amenity_booking', 'vendor_communication', 'board_matter', 'emergency', 'general_inquiry', 'lease_ownership', 'other');--> statement-breakpoint
CREATE TYPE "public"."ai_urgency" AS ENUM('critical', 'high', 'medium', 'low');--> statement-breakpoint
CREATE TYPE "public"."document_category" AS ENUM('governing_documents', 'meeting_minutes', 'financial_reports', 'insurance', 'contracts', 'notices', 'forms', 'other');--> statement-breakpoint
CREATE TYPE "public"."email_provider" AS ENUM('gmail', 'outlook');--> statement-breakpoint
CREATE TYPE "public"."email_source" AS ENUM('gmail', 'outlook', 'manual');--> statement-breakpoint
CREATE TYPE "public"."event_type" AS ENUM('inspection', 'vendor_visit', 'maintenance', 'board_meeting', 'deadline', 'owner_meeting', 'other');--> statement-breakpoint
CREATE TYPE "public"."meeting_status" AS ENUM('scheduled', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."meeting_type" AS ENUM('board_meeting', 'annual_meeting', 'special_meeting', 'committee_meeting', 'vendor_meeting', 'internal');--> statement-breakpoint
CREATE TYPE "public"."message_channel" AS ENUM('in_app', 'email', 'text');--> statement-breakpoint
CREATE TYPE "public"."message_direction" AS ENUM('owner_to_manager', 'manager_to_owner');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('document_shared', 'payment_due', 'message_received', 'ticket_update', 'general');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('ach', 'check', 'credit_card', 'cash', 'other');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'confirmed', 'failed', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."payment_type" AS ENUM('payment', 'charge', 'credit', 'refund');--> statement-breakpoint
CREATE TYPE "public"."portier_role" AS ENUM('super_admin', 'company_admin', 'portfolio_manager', 'property_manager', 'accountant', 'assistant_manager', 'owner', 'vendor', 'resident', 'user');--> statement-breakpoint
CREATE TYPE "public"."ticket_category" AS ENUM('common_area', 'unit_related', 'emergency', 'vendor', 'board_matter', 'maintenance', 'other');--> statement-breakpoint
CREATE TYPE "public"."ticket_priority" AS ENUM('low', 'medium', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."ticket_source" AS ENUM('portal', 'email', 'phone', 'manager', 'system');--> statement-breakpoint
CREATE TYPE "public"."ticket_status" AS ENUM('open', 'in_progress', 'pending_vendor', 'resolved', 'closed');--> statement-breakpoint
CREATE TYPE "public"."tier" AS ENUM('starter', 'growth', 'professional', 'enterprise');--> statement-breakpoint
CREATE TYPE "public"."vendor_category" AS ENUM('plumbing', 'electrical', 'hvac', 'landscaping', 'cleaning', 'security', 'elevator', 'general', 'other');--> statement-breakpoint
CREATE TABLE "companies" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"email" varchar(320),
	"phone" varchar(30),
	"address" text,
	"logoUrl" text,
	"brandColor" varchar(7) DEFAULT '#2D4A3E',
	"tier" "tier" DEFAULT 'starter' NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "companies_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "email_connections" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"companyId" integer NOT NULL,
	"provider" "email_provider" NOT NULL,
	"accountEmail" varchar(320) NOT NULL,
	"accessToken" text NOT NULL,
	"refreshToken" text,
	"expiresAt" timestamp,
	"lastSyncedAt" timestamp,
	"syncCursor" text,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_threads" (
	"id" serial PRIMARY KEY NOT NULL,
	"companyId" integer NOT NULL,
	"propertyId" integer,
	"ticketId" integer,
	"subject" varchar(500),
	"fromAddress" varchar(320),
	"toAddresses" text,
	"bodyPreview" text,
	"fullBody" text,
	"aiSummary" text,
	"aiDraftReply" text,
	"aiUrgency" "ai_urgency",
	"aiCategory" "ai_category",
	"aiMatchedPropertyId" integer,
	"aiConfidence" integer,
	"aiReasoning" text,
	"aiCategorizedAt" timestamp,
	"convertedToTicketId" integer,
	"isRead" boolean DEFAULT false NOT NULL,
	"source" "email_source" DEFAULT 'manual' NOT NULL,
	"receivedAt" timestamp DEFAULT now() NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meeting_action_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"meetingId" integer NOT NULL,
	"title" varchar(255) NOT NULL,
	"assignedToId" integer,
	"dueDate" timestamp,
	"isCompleted" boolean DEFAULT false NOT NULL,
	"completedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meetings" (
	"id" serial PRIMARY KEY NOT NULL,
	"propertyId" integer NOT NULL,
	"companyId" integer NOT NULL,
	"title" varchar(255) NOT NULL,
	"meetingType" "meeting_type" DEFAULT 'board_meeting' NOT NULL,
	"scheduledAt" timestamp,
	"location" varchar(255),
	"agenda" text,
	"minutes" text,
	"aiSummary" text,
	"status" "meeting_status" DEFAULT 'scheduled' NOT NULL,
	"attendees" text,
	"createdById" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "owner_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"ownerId" integer NOT NULL,
	"propertyId" integer NOT NULL,
	"companyId" integer NOT NULL,
	"balanceCents" integer DEFAULT 0 NOT NULL,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"notes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "owner_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"propertyId" integer NOT NULL,
	"companyId" integer NOT NULL,
	"ownerId" integer NOT NULL,
	"managerId" integer,
	"direction" "message_direction" NOT NULL,
	"channel" "message_channel" DEFAULT 'in_app' NOT NULL,
	"subject" varchar(255),
	"body" text NOT NULL,
	"isRead" boolean DEFAULT false NOT NULL,
	"isReadByManager" boolean DEFAULT false NOT NULL,
	"threadKey" varchar(64),
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "owner_notification_prefs" (
	"id" serial PRIMARY KEY NOT NULL,
	"ownerId" integer NOT NULL,
	"docSharedInApp" boolean DEFAULT true NOT NULL,
	"docSharedEmail" boolean DEFAULT true NOT NULL,
	"paymentDueInApp" boolean DEFAULT true NOT NULL,
	"paymentDueEmail" boolean DEFAULT true NOT NULL,
	"msgReceivedInApp" boolean DEFAULT true NOT NULL,
	"msgReceivedEmail" boolean DEFAULT true NOT NULL,
	"ticketUpdateInApp" boolean DEFAULT true NOT NULL,
	"ticketUpdateEmail" boolean DEFAULT true NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "owner_notification_prefs_ownerId_unique" UNIQUE("ownerId")
);
--> statement-breakpoint
CREATE TABLE "owner_notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"ownerId" integer NOT NULL,
	"propertyId" integer NOT NULL,
	"companyId" integer NOT NULL,
	"type" "notification_type" DEFAULT 'general' NOT NULL,
	"title" varchar(255) NOT NULL,
	"body" text NOT NULL,
	"documentId" integer,
	"ticketId" integer,
	"isRead" boolean DEFAULT false NOT NULL,
	"readAt" timestamp,
	"emailSent" boolean DEFAULT false NOT NULL,
	"emailSentAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"ownerAccountId" integer NOT NULL,
	"ownerId" integer NOT NULL,
	"propertyId" integer NOT NULL,
	"companyId" integer NOT NULL,
	"amountCents" integer NOT NULL,
	"type" "payment_type" DEFAULT 'payment' NOT NULL,
	"method" "payment_method" DEFAULT 'other' NOT NULL,
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"description" text,
	"referenceNumber" varchar(100),
	"memo" text,
	"confirmedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "properties" (
	"id" serial PRIMARY KEY NOT NULL,
	"companyId" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"address" text,
	"city" varchar(100),
	"state" varchar(50),
	"zip" varchar(20),
	"country" varchar(50) DEFAULT 'US',
	"totalUnits" integer DEFAULT 0,
	"yearBuilt" integer,
	"propertyType" text DEFAULT 'condominium',
	"amenities" text,
	"notes" text,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "property_assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"propertyId" integer NOT NULL,
	"userId" integer NOT NULL,
	"role" "portier_role" DEFAULT 'property_manager',
	"assignedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "property_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"propertyId" integer NOT NULL,
	"companyId" integer NOT NULL,
	"uploadedById" integer NOT NULL,
	"title" varchar(255) NOT NULL,
	"category" "document_category" DEFAULT 'other' NOT NULL,
	"description" text,
	"fileName" varchar(255) NOT NULL,
	"fileKey" varchar(512) NOT NULL,
	"fileUrl" text NOT NULL,
	"mimeType" varchar(100) NOT NULL,
	"fileSize" integer NOT NULL,
	"isSharedWithOwners" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schedule_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"propertyId" integer NOT NULL,
	"companyId" integer NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"eventType" "event_type" DEFAULT 'other' NOT NULL,
	"startTime" timestamp NOT NULL,
	"endTime" timestamp,
	"isAllDay" boolean DEFAULT false NOT NULL,
	"isRecurring" boolean DEFAULT false NOT NULL,
	"recurringPattern" varchar(50),
	"assignedToId" integer,
	"ticketId" integer,
	"createdById" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_attachments" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticketId" integer NOT NULL,
	"companyId" integer NOT NULL,
	"uploadedById" integer NOT NULL,
	"fileName" varchar(255) NOT NULL,
	"fileKey" varchar(512) NOT NULL,
	"fileUrl" text NOT NULL,
	"mimeType" varchar(100) NOT NULL,
	"fileSize" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticketId" integer NOT NULL,
	"authorId" integer NOT NULL,
	"content" text NOT NULL,
	"isInternal" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tickets" (
	"id" serial PRIMARY KEY NOT NULL,
	"propertyId" integer NOT NULL,
	"companyId" integer NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"category" "ticket_category" DEFAULT 'other' NOT NULL,
	"priority" "ticket_priority" DEFAULT 'medium' NOT NULL,
	"status" "ticket_status" DEFAULT 'open' NOT NULL,
	"reportedById" integer,
	"assignedToId" integer,
	"unitNumber" varchar(20),
	"source" "ticket_source" DEFAULT 'manager' NOT NULL,
	"sourceEmailId" integer,
	"dueDate" timestamp,
	"resolvedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"openId" varchar(64) NOT NULL,
	"name" text,
	"email" varchar(320),
	"loginMethod" varchar(64),
	"role" text DEFAULT 'user' NOT NULL,
	"portierRole" "portier_role" DEFAULT 'user',
	"companyId" integer,
	"avatarUrl" text,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"lastSignedIn" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_openId_unique" UNIQUE("openId")
);
--> statement-breakpoint
CREATE TABLE "vendors" (
	"id" serial PRIMARY KEY NOT NULL,
	"companyId" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"contactName" varchar(255),
	"email" varchar(320),
	"phone" varchar(30),
	"address" text,
	"specialty" varchar(255),
	"category" "vendor_category" DEFAULT 'general' NOT NULL,
	"licenseNumber" varchar(100),
	"insuranceExpiry" timestamp,
	"rating" integer,
	"isActive" boolean DEFAULT true NOT NULL,
	"notes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
