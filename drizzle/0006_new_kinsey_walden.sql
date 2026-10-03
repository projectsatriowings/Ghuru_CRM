ALTER TABLE "leads" ADD COLUMN "pipeline_id" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "stage_id" text;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_pipeline_id_pipelines_id_fk" FOREIGN KEY ("pipeline_id") REFERENCES "public"."pipelines"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_stage_id_pipeline_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."pipeline_stages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "leads_org_pipeline_idx" ON "leads" USING btree ("organization_id","pipeline_id");--> statement-breakpoint
CREATE INDEX "leads_org_stage_idx" ON "leads" USING btree ("organization_id","stage_id");--> statement-breakpoint
CREATE INDEX "leads_pipeline_idx" ON "leads" USING btree ("pipeline_id");--> statement-breakpoint
CREATE INDEX "leads_stage_idx" ON "leads" USING btree ("stage_id");