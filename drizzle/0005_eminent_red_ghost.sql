CREATE TABLE "pipeline_stages" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"pipeline_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"display_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "pipelines" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"active" boolean DEFAULT true NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "pipeline_stages" ADD CONSTRAINT "pipeline_stages_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipeline_stages" ADD CONSTRAINT "pipeline_stages_pipeline_id_pipelines_id_fk" FOREIGN KEY ("pipeline_id") REFERENCES "public"."pipelines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipelines" ADD CONSTRAINT "pipelines_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pipeline_stages_org_idx" ON "pipeline_stages" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "pipeline_stages_pipeline_idx" ON "pipeline_stages" USING btree ("pipeline_id");--> statement-breakpoint
CREATE INDEX "pipeline_stages_org_pipeline_idx" ON "pipeline_stages" USING btree ("organization_id","pipeline_id");--> statement-breakpoint
CREATE INDEX "pipeline_stages_pipeline_order_idx" ON "pipeline_stages" USING btree ("pipeline_id","display_order");--> statement-breakpoint
CREATE INDEX "pipeline_stages_pipeline_archived_idx" ON "pipeline_stages" USING btree ("pipeline_id","archived_at");--> statement-breakpoint
CREATE INDEX "pipelines_org_idx" ON "pipelines" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "pipelines_org_active_idx" ON "pipelines" USING btree ("organization_id","active");--> statement-breakpoint
CREATE INDEX "pipelines_org_is_default_idx" ON "pipelines" USING btree ("organization_id","is_default");--> statement-breakpoint
CREATE INDEX "pipelines_org_archived_idx" ON "pipelines" USING btree ("organization_id","archived_at");