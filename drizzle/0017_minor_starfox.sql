CREATE TABLE "integration_inbound_events" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"integration_id" text NOT NULL,
	"provider_key" text NOT NULL,
	"external_event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'received' NOT NULL,
	"attempt_count" integer DEFAULT 1 NOT NULL,
	"error" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration_oauth_states" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"integration_id" text NOT NULL,
	"provider_key" text NOT NULL,
	"state" text NOT NULL,
	"redirect_uri" text,
	"code_verifier" text,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "integration_oauth_states_state_unique" UNIQUE("state")
);
--> statement-breakpoint
ALTER TABLE "integration_inbound_events" ADD CONSTRAINT "integration_inbound_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_inbound_events" ADD CONSTRAINT "integration_inbound_events_integration_id_organization_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."organization_integrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_oauth_states" ADD CONSTRAINT "integration_oauth_states_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_oauth_states" ADD CONSTRAINT "integration_oauth_states_integration_id_organization_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."organization_integrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "inbound_events_org_idx" ON "integration_inbound_events" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "inbound_events_integration_idx" ON "integration_inbound_events" USING btree ("organization_id","integration_id");--> statement-breakpoint
CREATE INDEX "inbound_events_status_idx" ON "integration_inbound_events" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "inbound_events_idempotency_idx" ON "integration_inbound_events" USING btree ("organization_id","provider_key","external_event_id");--> statement-breakpoint
CREATE INDEX "inbound_events_created_idx" ON "integration_inbound_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "oauth_states_state_idx" ON "integration_oauth_states" USING btree ("state");--> statement-breakpoint
CREATE INDEX "oauth_states_org_idx" ON "integration_oauth_states" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "oauth_states_integration_idx" ON "integration_oauth_states" USING btree ("organization_id","integration_id");--> statement-breakpoint
CREATE INDEX "oauth_states_expires_idx" ON "integration_oauth_states" USING btree ("expires_at");