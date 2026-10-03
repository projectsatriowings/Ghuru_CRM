CREATE TABLE "companies" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"website" text,
	"email" text,
	"phone" text,
	"industry" text,
	"company_size" text,
	"owner_user_id" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "companies_org_idx" ON "companies" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "companies_org_archived_idx" ON "companies" USING btree ("organization_id","archived_at");--> statement-breakpoint
CREATE INDEX "companies_org_owner_idx" ON "companies" USING btree ("organization_id","owner_user_id");--> statement-breakpoint
CREATE INDEX "companies_org_created_idx" ON "companies" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "companies_created_at_idx" ON "companies" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "companies_updated_at_idx" ON "companies" USING btree ("updated_at");