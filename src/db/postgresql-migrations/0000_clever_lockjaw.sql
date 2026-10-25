CREATE TABLE "registrations" (
	"id" serial PRIMARY KEY NOT NULL,
	"iiit_code" varchar(64) NOT NULL,
	"iiit_name" varchar(128) NOT NULL,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"submitted_at" timestamp with time zone,
	"submitted_by" varchar(64),
	"contact_name" varchar(128),
	"contact_email" varchar(128),
	"contact_phone" varchar(32),
	"total_students_count" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "registrations_iiit_code_unique" UNIQUE("iiit_code")
);
--> statement-breakpoint
CREATE TABLE "student_event_participations" (
	"id" serial PRIMARY KEY NOT NULL,
	"registration_id" integer NOT NULL,
	"student_id" integer NOT NULL,
	"sport_id" varchar(64) NOT NULL,
	"event_id" varchar(64) NOT NULL,
	"gender" varchar(10) NOT NULL,
	"is_reserve" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "students" (
	"id" serial PRIMARY KEY NOT NULL,
	"registration_id" integer NOT NULL,
	"iiit_code" varchar(64) NOT NULL,
	"roll_number" varchar(64) NOT NULL,
	"name" varchar(128) NOT NULL,
	"gender" varchar(1) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" varchar(64) NOT NULL,
	"password_hash" text NOT NULL,
	"role" varchar(20) NOT NULL,
	"iiit_name" varchar(128),
	"iiit_code" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_iiit_code_unique" UNIQUE("iiit_code")
);
--> statement-breakpoint
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_iiit_code_users_iiit_code_fk" FOREIGN KEY ("iiit_code") REFERENCES "public"."users"("iiit_code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_event_participations" ADD CONSTRAINT "student_event_participations_registration_id_registrations_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."registrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_event_participations" ADD CONSTRAINT "student_event_participations_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_registration_id_registrations_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."registrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "student_participation_unique" ON "student_event_participations" USING btree ("student_id","sport_id","event_id");--> statement-breakpoint
CREATE INDEX "participation_registration_idx" ON "student_event_participations" USING btree ("registration_id");--> statement-breakpoint
CREATE INDEX "participation_sport_event_idx" ON "student_event_participations" USING btree ("sport_id","event_id");--> statement-breakpoint
CREATE INDEX "participation_student_idx" ON "student_event_participations" USING btree ("student_id");--> statement-breakpoint
CREATE UNIQUE INDEX "students_iiit_roll_unique" ON "students" USING btree ("iiit_code","roll_number");--> statement-breakpoint
CREATE INDEX "students_registration_idx" ON "students" USING btree ("registration_id");