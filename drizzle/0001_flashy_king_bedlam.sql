CREATE TABLE "custom_field_definitions" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"entity_type" text NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"field_type" text NOT NULL,
	"required" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "custom_field_values" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"field_definition_id" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"value" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "custom_field_definitions" ADD CONSTRAINT "custom_field_definitions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_field_values" ADD CONSTRAINT "custom_field_values_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_field_values" ADD CONSTRAINT "custom_field_values_field_definition_id_custom_field_definitions_id_fk" FOREIGN KEY ("field_definition_id") REFERENCES "public"."custom_field_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "custom_fields_org_entity_key_idx" ON "custom_field_definitions" USING btree ("organization_id","entity_type","key");--> statement-breakpoint
CREATE INDEX "custom_fields_org_id_idx" ON "custom_field_definitions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "custom_fields_org_entity_idx" ON "custom_field_definitions" USING btree ("organization_id","entity_type");--> statement-breakpoint
CREATE INDEX "custom_fields_org_entity_active_idx" ON "custom_field_definitions" USING btree ("organization_id","entity_type","active");--> statement-breakpoint
CREATE UNIQUE INDEX "custom_field_values_org_entity_record_field_idx" ON "custom_field_values" USING btree ("organization_id","entity_type","entity_id","field_definition_id");--> statement-breakpoint
CREATE INDEX "custom_field_values_org_entity_record_idx" ON "custom_field_values" USING btree ("organization_id","entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "custom_field_values_field_def_idx" ON "custom_field_values" USING btree ("field_definition_id");