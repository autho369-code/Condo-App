ALTER TABLE `email_threads` ADD `aiUrgency` enum('critical','high','medium','low');--> statement-breakpoint
ALTER TABLE `email_threads` ADD `aiCategory` enum('maintenance_request','billing_payment','noise_complaint','amenity_booking','vendor_communication','board_matter','emergency','general_inquiry','lease_ownership','other');--> statement-breakpoint
ALTER TABLE `email_threads` ADD `aiMatchedPropertyId` int;--> statement-breakpoint
ALTER TABLE `email_threads` ADD `aiConfidence` int;--> statement-breakpoint
ALTER TABLE `email_threads` ADD `aiReasoning` text;--> statement-breakpoint
ALTER TABLE `email_threads` ADD `aiCategorizedAt` timestamp;