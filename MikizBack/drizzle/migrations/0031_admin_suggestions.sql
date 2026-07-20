-- Add isAdmin to users, create yearbox event suggestions table

ALTER TABLE "users" ADD COLUMN "is_admin" boolean NOT NULL DEFAULT false;

CREATE TYPE "public"."yearbox_suggestion_status" AS ENUM('pending', 'approved', 'rejected');
CREATE TYPE "public"."yearbox_domain" AS ENUM('cinema', 'musique', 'sport', 'politique', 'tech');

CREATE TABLE "yearbox_event_suggestions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "year" integer NOT NULL,
  "domain" "yearbox_domain" NOT NULL,
  "text" varchar(500) NOT NULL,
  "status" "yearbox_suggestion_status" DEFAULT 'pending' NOT NULL,
  "admin_note" varchar(300),
  "created_at" timestamp DEFAULT now() NOT NULL,
  "reviewed_at" timestamp
);

ALTER TABLE "yearbox_event_suggestions" ADD CONSTRAINT "yearbox_event_suggestions_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
