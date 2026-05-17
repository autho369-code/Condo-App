CREATE TABLE `companies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`slug` varchar(100) NOT NULL,
	`email` varchar(320),
	`phone` varchar(30),
	`address` text,
	`logoUrl` text,
	`brandColor` varchar(7) DEFAULT '#2D4A3E',
	`tier` enum('starter','growth','professional','enterprise') NOT NULL DEFAULT 'starter',
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `companies_id` PRIMARY KEY(`id`),
	CONSTRAINT `companies_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `email_threads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`propertyId` int,
	`ticketId` int,
	`subject` varchar(500),
	`fromAddress` varchar(320),
	`toAddresses` text,
	`bodyPreview` text,
	`fullBody` text,
	`aiSummary` text,
	`aiDraftReply` text,
	`isRead` boolean NOT NULL DEFAULT false,
	`source` enum('gmail','outlook','manual') NOT NULL DEFAULT 'manual',
	`receivedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `email_threads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `meeting_action_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`meetingId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`assignedToId` int,
	`dueDate` timestamp,
	`isCompleted` boolean NOT NULL DEFAULT false,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `meeting_action_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `meetings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`propertyId` int NOT NULL,
	`companyId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`meetingType` enum('board_meeting','annual_meeting','special_meeting','committee_meeting','vendor_meeting','internal') NOT NULL DEFAULT 'board_meeting',
	`scheduledAt` timestamp,
	`location` varchar(255),
	`agenda` text,
	`minutes` text,
	`aiSummary` text,
	`status` enum('scheduled','in_progress','completed','cancelled') NOT NULL DEFAULT 'scheduled',
	`createdById` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `meetings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `properties` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`address` text,
	`city` varchar(100),
	`state` varchar(50),
	`zip` varchar(20),
	`unitCount` int DEFAULT 0,
	`propertyType` enum('condominium','hoa','coop') NOT NULL DEFAULT 'condominium',
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `properties_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `property_assignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`propertyId` int NOT NULL,
	`userId` int NOT NULL,
	`portier_role` enum('super_admin','company_admin','portfolio_manager','property_manager','accountant','assistant_manager','owner','vendor','resident','user') DEFAULT 'property_manager',
	`assignedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `property_assignments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `schedule_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`propertyId` int NOT NULL,
	`companyId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`eventType` enum('inspection','vendor_visit','maintenance','board_meeting','deadline','owner_meeting','other') NOT NULL DEFAULT 'other',
	`startTime` timestamp NOT NULL,
	`endTime` timestamp,
	`isAllDay` boolean NOT NULL DEFAULT false,
	`isRecurring` boolean NOT NULL DEFAULT false,
	`recurringPattern` varchar(50),
	`assignedToId` int,
	`ticketId` int,
	`createdById` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `schedule_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ticket_comments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ticketId` int NOT NULL,
	`authorId` int NOT NULL,
	`content` text NOT NULL,
	`isInternal` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ticket_comments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tickets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`propertyId` int NOT NULL,
	`companyId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`category` enum('common_area','unit_related','emergency','vendor','board_matter','maintenance','other') NOT NULL DEFAULT 'other',
	`priority` enum('low','medium','high','urgent') NOT NULL DEFAULT 'medium',
	`status` enum('open','in_progress','pending_vendor','resolved','closed') NOT NULL DEFAULT 'open',
	`reportedById` int,
	`assignedToId` int,
	`unitNumber` varchar(20),
	`source` enum('portal','email','phone','manager','system') NOT NULL DEFAULT 'manager',
	`dueDate` timestamp,
	`resolvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tickets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`portier_role` enum('super_admin','company_admin','portfolio_manager','property_manager','accountant','assistant_manager','owner','vendor','resident','user') DEFAULT 'user',
	`companyId` int,
	`avatarUrl` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);
--> statement-breakpoint
CREATE TABLE `vendors` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`contactName` varchar(255),
	`email` varchar(320),
	`phone` varchar(30),
	`category` enum('plumbing','electrical','hvac','landscaping','cleaning','security','elevator','general','other') NOT NULL DEFAULT 'general',
	`insuranceExpiry` timestamp,
	`isActive` boolean NOT NULL DEFAULT true,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `vendors_id` PRIMARY KEY(`id`)
);
