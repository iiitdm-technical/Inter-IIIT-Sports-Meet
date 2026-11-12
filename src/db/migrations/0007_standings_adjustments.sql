ALTER TABLE `tournament_teams` ADD `adj_won` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `tournament_teams` ADD `adj_drawn` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `tournament_teams` ADD `adj_lost` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `tournament_teams` ADD `adj_note` varchar(255) DEFAULT '' NOT NULL;