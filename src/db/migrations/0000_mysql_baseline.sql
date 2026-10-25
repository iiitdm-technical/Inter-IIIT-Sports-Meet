CREATE TABLE `audit_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
	`actor` varchar(254),
	`role` varchar(20),
	`action` varchar(64) NOT NULL,
	`target` varchar(128),
	`ip` varchar(64),
	`details` json,
	CONSTRAINT `audit_log_id` PRIMARY KEY(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;
--> statement-breakpoint
CREATE TABLE `payment_transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`registration_id` int NOT NULL,
	`unique_student_count` int NOT NULL,
	`amount` int NOT NULL,
	`transaction_date` datetime(6) NOT NULL,
	`transaction_id` varchar(128) NOT NULL,
	`bank_name` varchar(128),
	`payment_mode` varchar(20),
	`other_payment_mode` varchar(128),
	`proof_pathname` varchar(255) NOT NULL,
	`proof_file_name` varchar(255) NOT NULL,
	`proof_content_type` varchar(64) NOT NULL,
	`proof_size` int NOT NULL,
	`verification_status` varchar(20) NOT NULL DEFAULT 'pending',
	`verified_at` datetime(6),
	`verified_by` varchar(64),
	`created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
	CONSTRAINT `payment_transactions_id` PRIMARY KEY(`id`),
	CONSTRAINT `payment_transactions_registration_id_unique` UNIQUE(`registration_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;
--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`key` varchar(200) NOT NULL,
	`window_start` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
	`count` int NOT NULL DEFAULT 0,
	CONSTRAINT `rate_limits_key` PRIMARY KEY(`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;
--> statement-breakpoint
CREATE TABLE `registration_drafts` (
	`iiit_code` varchar(64) NOT NULL,
	`contact_details` json NOT NULL,
	`slots_map` json NOT NULL,
	`revision` int NOT NULL DEFAULT 1,
	`updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
	CONSTRAINT `registration_drafts_iiit_code` PRIMARY KEY(`iiit_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;
--> statement-breakpoint
CREATE TABLE `registrations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`iiit_code` varchar(64) NOT NULL,
	`iiit_name` varchar(128) NOT NULL,
	`status` varchar(20) NOT NULL DEFAULT 'payment_pending',
	`submitted_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
	`submitted_by` varchar(64) NOT NULL,
	`contact_name` varchar(128) NOT NULL,
	`contact_email` varchar(128) NOT NULL,
	`contact_phone` varchar(32) NOT NULL,
	`total_students_count` int NOT NULL DEFAULT 0,
	`notes` text,
	`created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
	`updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
	CONSTRAINT `registrations_id` PRIMARY KEY(`id`),
	CONSTRAINT `registrations_iiit_code_unique` UNIQUE(`iiit_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` varchar(64) NOT NULL,
	`user_id` int NOT NULL,
	`created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
	`last_seen_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
	`expires_at` datetime(6) NOT NULL,
	`user_agent` varchar(256),
	`ip` varchar(64),
	CONSTRAINT `sessions_id` PRIMARY KEY(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;
--> statement-breakpoint
CREATE TABLE `student_event_participations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`registration_id` int NOT NULL,
	`student_id` int NOT NULL,
	`sport_id` varchar(64) NOT NULL,
	`event_id` varchar(64) NOT NULL,
	`gender` varchar(10) NOT NULL,
	`is_reserve` boolean NOT NULL DEFAULT false,
	`created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
	CONSTRAINT `student_event_participations_id` PRIMARY KEY(`id`),
	CONSTRAINT `student_participation_unique` UNIQUE(`student_id`,`sport_id`,`event_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;
--> statement-breakpoint
CREATE TABLE `students` (
	`id` int AUTO_INCREMENT NOT NULL,
	`registration_id` int NOT NULL,
	`iiit_code` varchar(64) NOT NULL,
	`roll_number` varchar(64) NOT NULL,
	`name` varchar(128) NOT NULL,
	`gender` varchar(1) NOT NULL,
	`created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
	`updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
	CONSTRAINT `students_id` PRIMARY KEY(`id`),
	CONSTRAINT `students_iiit_roll_unique` UNIQUE(`iiit_code`,`roll_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`username` varchar(64) NOT NULL,
	`email` varchar(254),
	`display_name` varchar(128),
	`password_hash` text NOT NULL,
	`role` varchar(20) NOT NULL,
	`iiit_name` varchar(128),
	`iiit_code` varchar(64),
	`created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
	`updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_username_unique` UNIQUE(`username`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`),
	CONSTRAINT `users_iiit_code_unique` UNIQUE(`iiit_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;
--> statement-breakpoint
ALTER TABLE `payment_transactions` ADD CONSTRAINT `payment_transactions_registration_id_registrations_id_fk` FOREIGN KEY (`registration_id`) REFERENCES `registrations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `registration_drafts` ADD CONSTRAINT `registration_drafts_iiit_code_users_iiit_code_fk` FOREIGN KEY (`iiit_code`) REFERENCES `users`(`iiit_code`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `registrations` ADD CONSTRAINT `registrations_iiit_code_users_iiit_code_fk` FOREIGN KEY (`iiit_code`) REFERENCES `users`(`iiit_code`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `student_event_participations` ADD CONSTRAINT `student_event_participations_registration_id_registrations_id_fk` FOREIGN KEY (`registration_id`) REFERENCES `registrations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `student_event_participations` ADD CONSTRAINT `student_event_participations_student_id_students_id_fk` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `students` ADD CONSTRAINT `students_registration_id_registrations_id_fk` FOREIGN KEY (`registration_id`) REFERENCES `registrations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `audit_log_at_idx` ON `audit_log` (`at`);--> statement-breakpoint
CREATE INDEX `audit_log_action_idx` ON `audit_log` (`action`);--> statement-breakpoint
CREATE INDEX `rate_limits_window_idx` ON `rate_limits` (`window_start`);--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `sessions_expires_idx` ON `sessions` (`expires_at`);--> statement-breakpoint
CREATE INDEX `participation_registration_idx` ON `student_event_participations` (`registration_id`);--> statement-breakpoint
CREATE INDEX `participation_sport_event_idx` ON `student_event_participations` (`sport_id`,`event_id`);--> statement-breakpoint
CREATE INDEX `participation_student_idx` ON `student_event_participations` (`student_id`);--> statement-breakpoint
CREATE INDEX `students_registration_idx` ON `students` (`registration_id`);
