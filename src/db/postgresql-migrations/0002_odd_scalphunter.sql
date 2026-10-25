CREATE TABLE "payment_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"registration_id" integer NOT NULL,
	"unique_student_count" integer NOT NULL,
	"amount" integer NOT NULL,
	"transaction_date" timestamp with time zone NOT NULL,
	"transaction_id" varchar(128) NOT NULL,
	"bank_name" varchar(128),
	"proof_pathname" varchar(255) NOT NULL,
	"proof_file_name" varchar(255) NOT NULL,
	"proof_content_type" varchar(64) NOT NULL,
	"proof_size" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_transactions_registration_id_unique" UNIQUE("registration_id")
);
--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_registration_id_registrations_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."registrations"("id") ON DELETE cascade ON UPDATE no action;