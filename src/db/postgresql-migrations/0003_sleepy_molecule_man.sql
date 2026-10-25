ALTER TABLE "registrations" ALTER COLUMN "status" SET DEFAULT 'payment_pending';--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD COLUMN "payment_mode" varchar(20);--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD COLUMN "other_payment_mode" varchar(128);