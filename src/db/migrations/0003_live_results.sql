CREATE TABLE `coordinator_sports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`sport_id` varchar(64) NOT NULL,
	`gender` varchar(10) NOT NULL DEFAULT 'all',
	`created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
	CONSTRAINT `coordinator_sports_id` PRIMARY KEY(`id`),
	CONSTRAINT `coordinator_sport_unique` UNIQUE(`user_id`,`sport_id`,`gender`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;
--> statement-breakpoint
CREATE TABLE `event_placings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`match_id` int NOT NULL,
	`position` int NOT NULL,
	`iiit_code` varchar(64) NOT NULL,
	`athlete` varchar(128) NOT NULL DEFAULT '',
	`mark` varchar(64) NOT NULL DEFAULT '',
	CONSTRAINT `event_placings_id` PRIMARY KEY(`id`),
	CONSTRAINT `event_placing_unique` UNIQUE(`match_id`,`position`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;
--> statement-breakpoint
CREATE TABLE `match_changes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`match_id` int NOT NULL,
	`at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
	`actor` varchar(254),
	`action` varchar(32) NOT NULL,
	`before` json,
	`after` json,
	CONSTRAINT `match_changes_id` PRIMARY KEY(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;
--> statement-breakpoint
CREATE TABLE `matches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sport_id` varchar(64) NOT NULL,
	`gender` varchar(10) NOT NULL,
	`kind` varchar(16) NOT NULL,
	`event_id` varchar(64),
	`round` varchar(64) NOT NULL DEFAULT '',
	`venue` varchar(128) NOT NULL DEFAULT '',
	`scheduled_at` datetime(6) NOT NULL,
	`status` varchar(16) NOT NULL DEFAULT 'scheduled',
	`side_a` varchar(64),
	`side_b` varchar(64),
	`score_a` int,
	`score_b` int,
	`score_detail` varchar(255) NOT NULL DEFAULT '',
	`winner` varchar(64),
	`result_note` varchar(255) NOT NULL DEFAULT '',
	`is_sample` boolean NOT NULL DEFAULT false,
	`version` int NOT NULL DEFAULT 1,
	`started_at` datetime(6),
	`finished_at` datetime(6),
	`created_by` varchar(254),
	`updated_by` varchar(254),
	`created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
	`updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
	CONSTRAINT `matches_id` PRIMARY KEY(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;
--> statement-breakpoint
ALTER TABLE `coordinator_sports` ADD CONSTRAINT `coordinator_sports_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `event_placings` ADD CONSTRAINT `event_placings_match_id_matches_id_fk` FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `match_changes` ADD CONSTRAINT `match_changes_match_id_matches_id_fk` FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `match_changes_match_idx` ON `match_changes` (`match_id`);--> statement-breakpoint
CREATE INDEX `matches_sport_idx` ON `matches` (`sport_id`,`gender`);--> statement-breakpoint
CREATE INDEX `matches_schedule_idx` ON `matches` (`scheduled_at`);--> statement-breakpoint
CREATE INDEX `matches_status_idx` ON `matches` (`status`);