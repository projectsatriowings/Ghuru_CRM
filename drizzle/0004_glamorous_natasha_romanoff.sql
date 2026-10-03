CREATE TABLE "follow_ups" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"lead_id" text NOT NULL,
	"assigned_to_user_id" text,
	"title" text NOT NULL,
	"description" text,
	"due_date" text NOT NULL,
	"due_time" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_assigned_to_user_id_users_id_fk" FOREIGN KEY ("assigned_to_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "follow_ups_org_idx" ON "follow_ups" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "follow_ups_lead_idx" ON "follow_ups" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "follow_ups_org_lead_idx" ON "follow_ups" USING btree ("organization_id","lead_id");--> statement-breakpoint
CREATE INDEX "follow_ups_status_idx" ON "follow_ups" USING btree ("status");--> statement-breakpoint
CREATE INDEX "follow_ups_due_date_idx" ON "follow_ups" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "follow_ups_org_status_due_idx" ON "follow_ups" USING btree ("organization_id","status","due_date");--> statement-breakpoint
CREATE INDEX "follow_ups_assigned_idx" ON "follow_ups" USING btree ("assigned_to_user_id");--> statement-breakpoint
CREATE INDEX "follow_ups_created_idx" ON "follow_ups" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "follow_ups_org_archived_idx" ON "follow_ups" USING btree ("organization_id","archived_at");