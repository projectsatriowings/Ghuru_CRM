DROP INDEX "activities_org_lead_created_idx";--> statement-breakpoint
ALTER TABLE "activities" ALTER COLUMN "lead_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "activities" ADD COLUMN "entity_type" text DEFAULT 'lead' NOT NULL;--> statement-breakpoint
ALTER TABLE "activities" ADD COLUMN "entity_id" text;--> statement-breakpoint
UPDATE "activities" SET "entity_id" = "lead_id" WHERE "entity_id" IS NULL;--> statement-breakpoint
ALTER TABLE "activities" ALTER COLUMN "entity_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "activities" ADD COLUMN "status" text DEFAULT 'completed' NOT NULL;--> statement-breakpoint
ALTER TABLE "activities" ADD COLUMN "assigned_to_user_id" text;--> statement-breakpoint
ALTER TABLE "activities" ADD COLUMN "due_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "activities" ADD COLUMN "completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_assigned_to_user_id_users_id_fk" FOREIGN KEY ("assigned_to_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activities_org_entity_idx" ON "activities" USING btree ("organization_id","entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "activities_org_entity_created_idx" ON "activities" USING btree ("organization_id","entity_type","entity_id","created_at");--> statement-breakpoint
CREATE INDEX "activities_status_idx" ON "activities" USING btree ("status");--> statement-breakpoint
CREATE INDEX "activities_assigned_idx" ON "activities" USING btree ("assigned_to_user_id");