ALTER TABLE `email_threads` ADD `convertedToTicketId` int;--> statement-breakpoint
ALTER TABLE `tickets` ADD `sourceEmailId` int;