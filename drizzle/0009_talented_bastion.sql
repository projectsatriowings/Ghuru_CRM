ALTER TABLE "leads" ADD COLUMN "company_id" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "company_id" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "is_primary_contact" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "leads_org_company_idx" ON "leads" USING btree ("organization_id","company_id");--> statement-breakpoint
CREATE INDEX "leads_company_idx" ON "leads" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "contacts_org_company_idx" ON "contacts" USING btree ("organization_id","company_id");--> statement-breakpoint
CREATE INDEX "contacts_company_idx" ON "contacts" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "contacts_company_primary_idx" ON "contacts" USING btree ("company_id") WHERE "contacts"."is_primary_contact" = true AND "contacts"."company_id" IS NOT NULL;