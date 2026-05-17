CREATE TABLE `owner_accounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`propertyId` int NOT NULL,
	`companyId` int NOT NULL,
	`balanceCents` int NOT NULL DEFAULT 0,
	`currency` varchar(3) NOT NULL DEFAULT 'USD',
	`notes` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `owner_accounts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `owner_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`propertyId` int NOT NULL,
	`companyId` int NOT NULL,
	`ownerId` int NOT NULL,
	`managerId` int,
	`direction` enum('owner_to_manager','manager_to_owner') NOT NULL,
	`channel` enum('in_app','email','text') NOT NULL DEFAULT 'in_app',
	`subject` varchar(255),
	`body` text NOT NULL,
	`isRead` boolean NOT NULL DEFAULT false,
	`threadKey` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `owner_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `payment_transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`propertyId` int NOT NULL,
	`companyId` int NOT NULL,
	`amountCents` int NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'USD',
	`method` enum('ach','credit_card','check','wire','other') NOT NULL DEFAULT 'other',
	`status` enum('pending','processing','completed','failed','refunded') NOT NULL DEFAULT 'pending',
	`description` varchar(500),
	`referenceNumber` varchar(100),
	`stripePaymentIntentId` varchar(255),
	`processedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `payment_transactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `property_documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`propertyId` int NOT NULL,
	`companyId` int NOT NULL,
	`uploadedById` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`category` enum('governing_document','meeting_minutes','financial_report','insurance','maintenance_record','notice','other') NOT NULL DEFAULT 'other',
	`fileKey` varchar(512) NOT NULL,
	`fileUrl` text NOT NULL,
	`mimeType` varchar(100) NOT NULL,
	`fileSize` int NOT NULL,
	`isSharedWithOwners` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `property_documents_id` PRIMARY KEY(`id`)
);
