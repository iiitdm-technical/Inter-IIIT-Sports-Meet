CREATE TABLE `tournament_teams` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tournament_id` int NOT NULL,
	`iiit_code` varchar(64) NOT NULL,
	`pool` varchar(16) NOT NULL DEFAULT '',
	`position` int NOT NULL DEFAULT 0,
	`manual_rank` int,
	CONSTRAINT `tournament_teams_id` PRIMARY KEY(`id`),
	CONSTRAINT `tournament_team_unique` UNIQUE(`tournament_id`,`iiit_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;
--> statement-breakpoint
CREATE TABLE `tournaments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sport_id` varchar(64) NOT NULL,
	`gender` varchar(10) NOT NULL,
	`name` varchar(128) NOT NULL DEFAULT '',
	`points_win` int NOT NULL DEFAULT 3,
	`points_draw` int NOT NULL DEFAULT 1,
	`points_loss` int NOT NULL DEFAULT 0,
	`allow_draws` boolean NOT NULL DEFAULT true,
	`qualify_per_pool` int NOT NULL DEFAULT 2,
	`third_place` boolean NOT NULL DEFAULT true,
	`is_sample` boolean NOT NULL DEFAULT false,
	`version` int NOT NULL DEFAULT 1,
	`created_by` varchar(254),
	`updated_by` varchar(254),
	`created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
	`updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
	CONSTRAINT `tournaments_id` PRIMARY KEY(`id`),
	CONSTRAINT `tournament_unique` UNIQUE(`sport_id`,`gender`,`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;
--> statement-breakpoint
ALTER TABLE `matches` MODIFY COLUMN `scheduled_at` datetime(6);--> statement-breakpoint
ALTER TABLE `matches` ADD `tournament_id` int;--> statement-breakpoint
ALTER TABLE `matches` ADD `bracket_slot` varchar(16) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `matches` ADD `next_match_id` int;--> statement-breakpoint
ALTER TABLE `matches` ADD `next_side` varchar(1);--> statement-breakpoint
ALTER TABLE `matches` ADD `loser_next_match_id` int;--> statement-breakpoint
ALTER TABLE `matches` ADD `loser_next_side` varchar(1);--> statement-breakpoint
ALTER TABLE `tournament_teams` ADD CONSTRAINT `tournament_teams_tournament_id_tournaments_id_fk` FOREIGN KEY (`tournament_id`) REFERENCES `tournaments`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `matches` ADD CONSTRAINT `matches_tournament_id_tournaments_id_fk` FOREIGN KEY (`tournament_id`) REFERENCES `tournaments`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `matches_tournament_idx` ON `matches` (`tournament_id`);