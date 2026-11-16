CREATE TABLE `match_photos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`match_id` int,
	`storage_key` varchar(128) NOT NULL,
	`thumb_key` varchar(128) NOT NULL,
	`content_type` varchar(32) NOT NULL,
	`size_bytes` int NOT NULL,
	`uploaded_by` varchar(254),
	`created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
	CONSTRAINT `match_photos_id` PRIMARY KEY(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;
--> statement-breakpoint
ALTER TABLE `match_photos` ADD CONSTRAINT `match_photos_match_id_matches_id_fk` FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `match_photos_match_idx` ON `match_photos` (`match_id`);