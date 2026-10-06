CREATE TABLE "ai_audit_events" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"endpoint" text NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"correlation_id" text NOT NULL,
	"duration_ms" integer NOT NULL,
	"status" text NOT NULL,
	"error_category" text,
	"prompt_tokens" integer,
	"completion_tokens" integer,
	"total_tokens" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_ai_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"ai_enabled" boolean DEFAULT true NOT NULL,
	"daily_request_limit" integer DEFAULT 100 NOT NULL,
	"monthly_request_limit" integer DEFAULT 2000 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_ai_settings_organization_id_unique" UNIQUE("organization_id")
);
--> statement-breakpoint
ALTER TABLE "ai_audit_events" ADD CONSTRAINT "ai_audit_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_audit_events" ADD CONSTRAINT "ai_audit_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_ai_settings" ADD CONSTRAINT "organization_ai_settings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_audit_org_idx" ON "ai_audit_events" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "ai_audit_user_idx" ON "ai_audit_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ai_audit_org_created_idx" ON "ai_audit_events" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "ai_audit_org_endpoint_idx" ON "ai_audit_events" USING btree ("organization_id","endpoint");--> statement-breakpoint
CREATE INDEX "ai_audit_org_status_idx" ON "ai_audit_events" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "ai_audit_correlation_idx" ON "ai_audit_events" USING btree ("correlation_id");--> statement-breakpoint
CREATE INDEX "org_ai_settings_org_idx" ON "organization_ai_settings" USING btree ("organization_id");