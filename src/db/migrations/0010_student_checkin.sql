ALTER TABLE `students` ADD `checked_in` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `students` ADD `checked_in_at` datetime(6);--> statement-breakpoint
ALTER TABLE `students` ADD `checked_in_by` varchar(64);