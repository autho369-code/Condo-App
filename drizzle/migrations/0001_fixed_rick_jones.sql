CREATE TABLE `email_connections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`companyId` int NOT NULL,
	`provider` enum('gmail','outlook') NOT NULL,
	`accountEmail` varchar(320) NOT NULL,
	`accessToken` text NOT NULL,
	`refreshToken` text,
	`expiresAt` timestamp,
	`lastSyncedAt` timestamp,
	`syncCursor` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `email_connections_id` PRIMARY KEY(`id`)
);
