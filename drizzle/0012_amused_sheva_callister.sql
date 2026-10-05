CREATE TABLE "deals" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"lead_id" text,
	"contact_id" text,
	"company_id" text,
	"owner_user_id" text,
	"pipeline_id" text NOT NULL,
	"pipeline_stage_id" text NOT NULL,
	"value" numeric(14, 2),
	"currency" text DEFAULT 'USD' NOT NULL,
	"expected_close_date" timestamp with time zone,
	"status" text DEFAULT 'open' NOT NULL,
	"probability" integer,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "follow_ups" ALTER COLUMN "lead_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "follow_ups" ADD COLUMN "deal_id" text;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_pipeline_id_pipelines_id_fk" FOREIGN KEY ("pipeline_id") REFERENCES "public"."pipelines"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_pipeline_stage_id_pipeline_stages_id_fk" FOREIGN KEY ("pipeline_stage_id") REFERENCES "public"."pipeline_stages"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "deals_org_idx" ON "deals" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "deals_org_status_idx" ON "deals" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "deals_org_pipeline_idx" ON "deals" USING btree ("organization_id","pipeline_id");--> statement-breakpoint
CREATE INDEX "deals_org_stage_idx" ON "deals" USING btree ("organization_id","pipeline_stage_id");--> statement-breakpoint
CREATE INDEX "deals_org_owner_idx" ON "deals" USING btree ("organization_id","owner_user_id");--> statement-breakpoint
CREATE INDEX "deals_org_lead_idx" ON "deals" USING btree ("organization_id","lead_id");--> statement-breakpoint
CREATE INDEX "deals_org_contact_idx" ON "deals" USING btree ("organization_id","contact_id");--> statement-breakpoint
CREATE INDEX "deals_org_company_idx" ON "deals" USING btree ("organization_id","company_id");--> statement-breakpoint
CREATE INDEX "deals_org_created_idx" ON "deals" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "deals_org_archived_idx" ON "deals" USING btree ("organization_id","archived_at");--> statement-breakpoint
CREATE INDEX "deals_org_expected_close_idx" ON "deals" USING btree ("organization_id","expected_close_date");--> statement-breakpoint
CREATE INDEX "deals_lead_idx" ON "deals" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "deals_contact_idx" ON "deals" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "deals_company_idx" ON "deals" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "deals_pipeline_idx" ON "deals" USING btree ("pipeline_id");--> statement-breakpoint
CREATE INDEX "deals_stage_idx" ON "deals" USING btree ("pipeline_stage_id");--> statement-breakpoint
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "follow_ups_deal_idx" ON "follow_ups" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "follow_ups_org_deal_idx" ON "follow_ups" USING btree ("organization_id","deal_id");