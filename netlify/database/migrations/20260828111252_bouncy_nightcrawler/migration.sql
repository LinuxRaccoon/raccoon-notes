CREATE TABLE "attachments" (
	"id" serial PRIMARY KEY,
	"note_id" integer NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"blob_key" varchar(500) NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "folders" (
	"id" serial PRIMARY KEY,
	"user_id" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "notes" (
	"id" serial PRIMARY KEY,
	"user_id" varchar(255) NOT NULL,
	"folder_id" integer,
	"title" varchar(255) DEFAULT '' NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"is_markdown" boolean DEFAULT true NOT NULL,
	"lat" double precision,
	"lng" double precision,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_note_id_notes_id_fkey" FOREIGN KEY ("note_id") REFERENCES "notes"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_folder_id_folders_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "folders"("id") ON DELETE SET NULL;