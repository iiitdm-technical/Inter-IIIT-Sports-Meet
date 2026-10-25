ALTER TABLE "registrations" ALTER COLUMN "status" SET DEFAULT 'submitted';--> statement-breakpoint
ALTER TABLE "registrations" ALTER COLUMN "submitted_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "registrations" ALTER COLUMN "submitted_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "registrations" ALTER COLUMN "submitted_by" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "registrations" ALTER COLUMN "contact_name" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "registrations" ALTER COLUMN "contact_email" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "registrations" ALTER COLUMN "contact_phone" SET NOT NULL;