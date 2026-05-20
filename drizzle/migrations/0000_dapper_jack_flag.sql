CREATE TYPE "public"."activity_type" AS ENUM('transaction_created', 'report_run', 'invoice_processed', 'user_invited', 'property_updated', 'bill_approved', 'diagnostic_resolved', 'file_updated');--> statement-breakpoint
CREATE TYPE "public"."frequency" AS ENUM('daily', 'weekly', 'monthly', 'quarterly');--> statement-breakpoint
CREATE TYPE "public"."gl_account_type" AS ENUM('asset', 'liability', 'equity', 'income', 'expense', 'bank');--> statement-breakpoint
CREATE TYPE "public"."invitation_role" AS ENUM('super_admin', 'company_admin', 'portfolio_manager', 'manager', 'accountant', 'assistant', 'board_member');--> statement-breakpoint
CREATE TYPE "public"."invitation_status" AS ENUM('pending', 'accepted', 'expired', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."payment_type" AS ENUM('check', 'ach', 'online', 'credit_card');--> statement-breakpoint
CREATE TYPE "public"."property_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."property_type" AS ENUM('hoa', 'condo', 'commercial', 'residential');--> statement-breakpoint
CREATE TYPE "public"."severity" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."transaction_status" AS ENUM('pending', 'approved', 'paid', 'void', 'posted');--> statement-breakpoint
CREATE TYPE "public"."transaction_type" AS ENUM('receipt', 'charge', 'bill', 'payment', 'journal_entry', 'bank_deposit', 'bank_transfer');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('super_admin', 'company_admin', 'portfolio_manager', 'manager', 'accountant', 'assistant', 'board_member', 'user', 'admin');--> statement-breakpoint
CREATE TABLE "bank_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"propertyId" integer NOT NULL,
	"glAccountId" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"bankName" varchar(255),
	"accountNumberLast4" varchar(4),
	"lastReconciliation" timestamp,
	"paymentsEnabled" boolean DEFAULT false,
	"autoReconciliation" boolean DEFAULT false,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"code" varchar(64) NOT NULL,
	"address" text,
	"phone" varchar(32),
	"email" varchar(320),
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "companies_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "diagnostic_flags" (
	"id" serial PRIMARY KEY NOT NULL,
	"propertyId" integer NOT NULL,
	"flagType" varchar(128) NOT NULL,
	"description" text,
	"severity" "severity" DEFAULT 'medium' NOT NULL,
	"detectedAt" timestamp DEFAULT now() NOT NULL,
	"resolvedAt" timestamp,
	"manusResolutionDraft" text
);
--> statement-breakpoint
CREATE TABLE "gl_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"propertyId" integer,
	"accountNumber" varchar(32) NOT NULL,
	"accountName" varchar(255) NOT NULL,
	"accountType" "gl_account_type" NOT NULL,
	"parentAccountId" integer,
	"description" text,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" serial PRIMARY KEY NOT NULL,
	"token" varchar(128) NOT NULL,
	"email" varchar(320) NOT NULL,
	"role" "invitation_role" NOT NULL,
	"companyId" integer,
	"assignedPropertyIds" json,
	"invitedBy" integer NOT NULL,
	"status" "invitation_status" DEFAULT 'pending' NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"acceptedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invitations_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "journal_entry_lines" (
	"id" serial PRIMARY KEY NOT NULL,
	"transactionId" integer NOT NULL,
	"glAccountId" integer NOT NULL,
	"debit" numeric(12, 2) DEFAULT '0',
	"credit" numeric(12, 2) DEFAULT '0',
	"memo" text
);
--> statement-breakpoint
CREATE TABLE "owners" (
	"id" serial PRIMARY KEY NOT NULL,
	"propertyId" integer NOT NULL,
	"firstName" varchar(128) NOT NULL,
	"lastName" varchar(128) NOT NULL,
	"email" varchar(320),
	"phone" varchar(32),
	"unit" varchar(32),
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "properties" (
	"id" serial PRIMARY KEY NOT NULL,
	"companyId" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"address" text,
	"city" varchar(128),
	"state" varchar(64),
	"zip" varchar(16),
	"type" "property_type" DEFAULT 'hoa' NOT NULL,
	"status" "property_status" DEFAULT 'active' NOT NULL,
	"unitCount" integer DEFAULT 0,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recent_activity" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"propertyId" integer,
	"activityType" "activity_type" NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"metadata" json,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scheduled_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"propertyId" integer,
	"reportType" varchar(128) NOT NULL,
	"reportName" varchar(255) NOT NULL,
	"frequency" "frequency" NOT NULL,
	"parameters" json,
	"recipients" json,
	"lastRun" timestamp,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdBy" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"propertyId" integer NOT NULL,
	"transactionType" "transaction_type" NOT NULL,
	"date" timestamp NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"glAccountId" integer,
	"cashAccountId" integer,
	"vendorId" integer,
	"ownerId" integer,
	"referenceNumber" varchar(128),
	"description" text,
	"status" "transaction_status" DEFAULT 'pending' NOT NULL,
	"manusAutoCreated" boolean DEFAULT false,
	"createdBy" integer,
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
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"companyId" integer,
	"assignedPropertyIds" json,
	"invitedBy" integer,
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
	"companyName" varchar(255) NOT NULL,
	"contactName" varchar(255),
	"email" varchar(320),
	"phone" varchar(32),
	"address" text,
	"trades" json,
	"paymentType" "payment_type" DEFAULT 'check',
	"w9OnFile" boolean DEFAULT false,
	"is1099Vendor" boolean DEFAULT false,
	"licenseExpiry" timestamp,
	"insuranceExpiry" timestamp,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
