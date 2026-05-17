CREATE TABLE `owner_notification_prefs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`docSharedInApp` boolean NOT NULL DEFAULT true,
	`docSharedEmail` boolean NOT NULL DEFAULT true,
	`paymentDueInApp` boolean NOT NULL DEFAULT true,
	`paymentDueEmail` boolean NOT NULL DEFAULT true,
	`msgReceivedInApp` boolean NOT NULL DEFAULT true,
	`msgReceivedEmail` boolean NOT NULL DEFAULT true,
	`ticketUpdateInApp` boolean NOT NULL DEFAULT true,
	`ticketUpdateEmail` boolean NOT NULL DEFAULT true,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `owner_notification_prefs_id` PRIMARY KEY(`id`),
	CONSTRAINT `owner_notification_prefs_ownerId_unique` UNIQUE(`ownerId`)
);
