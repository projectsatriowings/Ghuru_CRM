CREATE TABLE "automation_executions" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"automation_id" text NOT NULL,
	"event_type" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"error_message" text,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "automations" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"active" boolean DEFAULT true NOT NULL,
	"entity_type" text NOT NULL,
	"trigger_type" text NOT NULL,
	"conditions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"actions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "automation_executions" ADD CONSTRAINT "automation_executions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_executions" ADD CONSTRAINT "automation_executions_automation_id_automations_id_fk" FOREIGN KEY ("automation_id") REFERENCES "public"."automations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automations" ADD CONSTRAINT "automations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automations" ADD CONSTRAINT "automations_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "auto_exec_org_idx" ON "automation_executions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "auto_exec_auto_idx" ON "automation_executions" USING btree ("automation_id");--> statement-breakpoint
CREATE INDEX "auto_exec_org_auto_idx" ON "automation_executions" USING btree ("organization_id","automation_id");--> statement-breakpoint
CREATE INDEX "auto_exec_org_started_idx" ON "automation_executions" USING btree ("organization_id","started_at");--> statement-breakpoint
CREATE INDEX "auto_exec_entity_idx" ON "automation_executions" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "auto_exec_status_idx" ON "automation_executions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "automations_org_idx" ON "automations" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "automations_org_active_idx" ON "automations" USING btree ("organization_id","active");--> statement-breakpoint
CREATE INDEX "automations_org_entity_idx" ON "automations" USING btree ("organization_id","entity_type");--> statement-breakpoint
CREATE INDEX "automations_org_trigger_idx" ON "automations" USING btree ("organization_id","trigger_type");--> statement-breakpoint
CREATE INDEX "automations_org_archived_idx" ON "automations" USING btree ("organization_id","archived_at");