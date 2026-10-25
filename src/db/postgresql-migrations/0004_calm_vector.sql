CREATE TABLE "registration_drafts" (
	"iiit_code" varchar(64) PRIMARY KEY NOT NULL,
	"contact_details" jsonb NOT NULL,
	"slots_map" jsonb NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "registration_drafts" ADD CONSTRAINT "registration_drafts_iiit_code_users_iiit_code_fk" FOREIGN KEY ("iiit_code") REFERENCES "public"."users"("iiit_code") ON DELETE cascade ON UPDATE no action;