CREATE TABLE `earlier_payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`iiit_code` varchar(64) NOT NULL,
	`amount` int NOT NULL,
	`unique_student_count` int NOT NULL,
	`transaction_date` datetime(6) NOT NULL,
	`transaction_id` varchar(128) NOT NULL,
	`payment_mode` varchar(20),
	`proof_pathname` varchar(255),
	`proof_file_name` varchar(255),
	`proof_content_type` varchar(64),
	`verification_status` varchar(20) NOT NULL DEFAULT 'pending',
	`verified_at` datetime(6),
	`verified_by` varchar(64),
	`note` varchar(255),
	`paid_at` datetime(6),
	`carried_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
	`carried_by` varchar(64),
	CONSTRAINT `earlier_payments_id` PRIMARY KEY(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;
--> statement-breakpoint
ALTER TABLE `payment_transactions` ADD `total_fee` int;--> statement-breakpoint
ALTER TABLE `payment_transactions` ADD `credit_amount` int DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `earlier_payments_iiit_idx` ON `earlier_payments` (`iiit_code`);