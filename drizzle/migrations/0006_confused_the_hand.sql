CREATE TABLE `owner_notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`propertyId` int NOT NULL,
	`companyId` int NOT NULL,
	`type` enum('document_shared','payment_due','message_received','ticket_update','general') NOT NULL DEFAULT 'general',
	`title` varchar(255) NOT NULL,
	`body` text NOT NULL,
	`documentId` int,
	`ticketId` int,
	`isRead` boolean NOT NULL DEFAULT false,
	`readAt` timestamp,
	`emailSent` boolean NOT NULL DEFAULT false,
	`emailSentAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `owner_notifications_id` PRIMARY KEY(`id`)
);
