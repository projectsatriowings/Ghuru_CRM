import { describe, it, expect, beforeAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "@/db/schema";
import fs from "fs";
import path from "path";
import { createOrganization } from "@/lib/services/organization.service";
import {
  createCustomField,
  getCustomFields,
  getCustomFieldById,
  updateCustomField,
  archiveCustomField,
  reorderCustomFields,
  setCustomFieldValue,
  getCustomFieldValuesForEntity,
} from "@/lib/services/custom-field.service";
import {
  validateCustomFieldValue,
  createCustomFieldSchema,
} from "@/lib/validations/custom-field";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import type { CustomFieldDefinition } from "@/lib/types/custom-fields";

describe("Milestone 2.1 — Custom Fields Foundation Test Suite", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let testDb: any;
  let user1Id: string;
  let user2Id: string;
  let orgAId: string;
  let orgBId: string;

  beforeAll(async () => {
    // 1. Create in-memory PostgreSQL instance
    const client = new PGlite();
    testDb = drizzle(client, { schema });

    // 2. Read and apply DDL migrations 0000 and 0001
    const migration0000 = fs.readFileSync(
      path.resolve(__dirname, "../drizzle/0000_moaning_vector.sql"),
      "utf-8"
    );
    for (const stmt of migration0000.split("--> statement-breakpoint").map((s) => s.trim()).filter((s) => s.length > 0)) {
      await client.exec(stmt);
    }

    const migration0001 = fs.readFileSync(
      path.resolve(__dirname, "../drizzle/0001_flashy_king_bedlam.sql"),
      "utf-8"
    );
    for (const stmt of migration0001.split("--> statement-breakpoint").map((s) => s.trim()).filter((s) => s.length > 0)) {
      await client.exec(stmt);
    }

    // 3. Pre-create test users
    user1Id = crypto.randomUUID();
    user2Id = crypto.randomUUID();

    await testDb.insert(schema.users).values([
      {
        id: user1Id,
        name: "User Alpha",
        email: "alpha@orga.com",
        emailVerified: true,
      },
      {
        id: user2Id,
        name: "User Beta",
        email: "beta@orgb.com",
        emailVerified: true,
      },
    ]);

    // 4. Create Org A and Org B
    const orgA = await createOrganization(
      { name: "Alpha Corp", slug: "alpha-corp", userId: user1Id },
      testDb
    );
    orgAId = orgA.organization.id;

    const orgB = await createOrganization(
      { name: "Beta Corp", slug: "beta-corp", userId: user2Id },
      testDb
    );
    orgBId = orgB.organization.id;
  });

  describe("1. Custom Field Creation & Validations", () => {
    it("should allow creating a custom field for an entity", async () => {
      const field = await createCustomField(
        orgAId,
        {
          entityType: "lead",
          key: "lead_source_detail",
          label: "Lead Source Detail",
          description: "Detailed origin of lead",
          fieldType: "text",
          required: true,
          config: { maxLength: 100 },
        },
        testDb
      );

      expect(field).toBeDefined();
      expect(field.id).toBeDefined();
      expect(field.organizationId).toBe(orgAId);
      expect(field.entityType).toBe("lead");
      expect(field.key).toBe("lead_source_detail");
      expect(field.label).toBe("Lead Source Detail");
      expect(field.fieldType).toBe("text");
      expect(field.required).toBe(true);
      expect(field.active).toBe(true);
      expect(field.displayOrder).toBe(0);
      expect(field.config).toEqual({ maxLength: 100 });
    });

    it("should auto-increment displayOrder when not specified", async () => {
      const field2 = await createCustomField(
        orgAId,
        {
          entityType: "lead",
          key: "budget_range",
          label: "Budget Range",
          fieldType: "currency",
          config: { currency: "USD", min: 0 },
        },
        testDb
      );

      expect(field2.displayOrder).toBe(1);
    });

    it("should reject duplicate field keys for the same (organization, entityType)", async () => {
      await expect(
        createCustomField(
          orgAId,
          {
            entityType: "lead",
            key: "lead_source_detail", // duplicate in Org A for 'lead'
            label: "Duplicate Source",
            fieldType: "text",
          },
          testDb
        )
      ).rejects.toThrow(ConflictError);
    });

    it("should allow the same key for a different entityType in the same organization", async () => {
      const contactField = await createCustomField(
        orgAId,
        {
          entityType: "contact",
          key: "lead_source_detail", // same key as lead, but entityType is 'contact'
          label: "Contact Source Detail",
          fieldType: "text",
        },
        testDb
      );

      expect(contactField).toBeDefined();
      expect(contactField.entityType).toBe("contact");
      expect(contactField.key).toBe("lead_source_detail");
    });

    it("should allow the exact same (entityType, key) in a different organization", async () => {
      const orgBField = await createCustomField(
        orgBId,
        {
          entityType: "lead",
          key: "lead_source_detail", // same key as Org A
          label: "Beta Lead Source",
          fieldType: "text",
        },
        testDb
      );

      expect(orgBField).toBeDefined();
      expect(orgBField.organizationId).toBe(orgBId);
      expect(orgBField.key).toBe("lead_source_detail");
    });

    it("should reject invalid field keys not matching snake_case naming conventions", () => {
      const invalidKeys = [
        "123startWithNum",
        "has-hyphens",
        "has spaces",
        "CamelCaseKey",
        "_startWithUnderscore",
        "special@char",
      ];

      for (const invalidKey of invalidKeys) {
        const result = createCustomFieldSchema.safeParse({
          entityType: "lead",
          key: invalidKey,
          label: "Test Field",
          fieldType: "text",
        });
        expect(result.success).toBe(false);
      }
    });

    it("should require options for select and multiselect field types", () => {
      const missingOptions = createCustomFieldSchema.safeParse({
        entityType: "lead",
        key: "industry_type",
        label: "Industry",
        fieldType: "select",
        config: {},
      });
      expect(missingOptions.success).toBe(false);

      const emptyOptions = createCustomFieldSchema.safeParse({
        entityType: "lead",
        key: "industry_type",
        label: "Industry",
        fieldType: "multiselect",
        config: { options: [] },
      });
      expect(emptyOptions.success).toBe(false);

      const validOptions = createCustomFieldSchema.safeParse({
        entityType: "lead",
        key: "industry_type",
        label: "Industry",
        fieldType: "select",
        config: {
          options: [
            { label: "Technology", value: "tech" },
            { label: "Healthcare", value: "healthcare" },
          ],
        },
      });
      expect(validOptions.success).toBe(true);
    });
  });

  describe("2. Custom Field Retrieval & Filtering", () => {
    it("should retrieve fields filtered by entityType", async () => {
      const leadFields = await getCustomFields(
        orgAId,
        { entityType: "lead" },
        testDb
      );
      expect(leadFields.length).toBeGreaterThanOrEqual(2);
      expect(leadFields.every((f) => f.entityType === "lead")).toBe(true);

      const contactFields = await getCustomFields(
        orgAId,
        { entityType: "contact" },
        testDb
      );
      expect(contactFields.every((f) => f.entityType === "contact")).toBe(true);
    });

    it("should return fields ordered by displayOrder asc", async () => {
      const leadFields = await getCustomFields(
        orgAId,
        { entityType: "lead" },
        testDb
      );
      for (let i = 1; i < leadFields.length; i++) {
        expect(leadFields[i].displayOrder).toBeGreaterThanOrEqual(
          leadFields[i - 1].displayOrder
        );
      }
    });
  });

  describe("3. Custom Field Update", () => {
    it("should successfully update field label, description, required, and config", async () => {
      const allLeadFields = await getCustomFields(
        orgAId,
        { entityType: "lead" },
        testDb
      );
      const targetField = allLeadFields[0];

      const updated = await updateCustomField(
        orgAId,
        targetField.id,
        {
          label: "Updated Source Label",
          description: "Updated description notes",
          required: false,
          config: { maxLength: 250 },
        },
        testDb
      );

      expect(updated.label).toBe("Updated Source Label");
      expect(updated.description).toBe("Updated description notes");
      expect(updated.required).toBe(false);
      expect(updated.config).toEqual({ maxLength: 250 });
      // Key and entityType remain unmodified
      expect(updated.key).toBe(targetField.key);
      expect(updated.entityType).toBe(targetField.entityType);
    });
  });

  describe("4. Custom Field Archiving (Soft Delete)", () => {
    it("should archive a custom field by setting active to false without deleting the record", async () => {
      const newField = await createCustomField(
        orgAId,
        {
          entityType: "company",
          key: "company_tier",
          label: "Company Tier",
          fieldType: "select",
          config: {
            options: [
              { label: "Tier 1", value: "t1" },
              { label: "Tier 2", value: "t2" },
            ],
          },
        },
        testDb
      );

      const archived = await archiveCustomField(orgAId, newField.id, testDb);
      expect(archived.active).toBe(false);

      // Verify still exists in DB
      const fetched = await getCustomFieldById(orgAId, newField.id, testDb);
      expect(fetched.id).toBe(newField.id);
      expect(fetched.active).toBe(false);

      // Verify filtered out when filtering active=true
      const activeCompanyFields = await getCustomFields(
        orgAId,
        { entityType: "company", active: true },
        testDb
      );
      expect(activeCompanyFields.some((f) => f.id === newField.id)).toBe(false);

      // Verify present when filtering active=false
      const inactiveCompanyFields = await getCustomFields(
        orgAId,
        { entityType: "company", active: false },
        testDb
      );
      expect(inactiveCompanyFields.some((f) => f.id === newField.id)).toBe(true);
    });
  });

  describe("5. Reordering Custom Fields", () => {
    it("should update displayOrder for an ordered list of field IDs", async () => {
      const f1 = await createCustomField(
        orgAId,
        {
          entityType: "company",
          key: "order_test_a",
          label: "Order Test A",
          fieldType: "text",
        },
        testDb
      );
      const f2 = await createCustomField(
        orgAId,
        {
          entityType: "company",
          key: "order_test_b",
          label: "Order Test B",
          fieldType: "text",
        },
        testDb
      );

      const reordered = await reorderCustomFields(
        orgAId,
        "company",
        [f2.id, f1.id],
        testDb
      );

      const f2Updated = reordered.find((f) => f.id === f2.id);
      const f1Updated = reordered.find((f) => f.id === f1.id);
      expect(f2Updated?.displayOrder).toBe(0);
      expect(f1Updated?.displayOrder).toBe(1);
    });
  });

  describe("6. Tenant Isolation", () => {
    it("should prevent Org A from accessing Org B custom field by ID", async () => {
      const orgBFields = await getCustomFields(orgBId, undefined, testDb);
      const bField = orgBFields[0];

      await expect(
        getCustomFieldById(orgAId, bField.id, testDb)
      ).rejects.toThrow(NotFoundError);
    });

    it("should prevent Org A from updating Org B custom field", async () => {
      const orgBFields = await getCustomFields(orgBId, undefined, testDb);
      const bField = orgBFields[0];

      await expect(
        updateCustomField(orgAId, bField.id, { label: "Hacked" }, testDb)
      ).rejects.toThrow(NotFoundError);
    });

    it("should prevent Org A from archiving Org B custom field", async () => {
      const orgBFields = await getCustomFields(orgBId, undefined, testDb);
      const bField = orgBFields[0];

      await expect(
        archiveCustomField(orgAId, bField.id, testDb)
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("7. Value Validation for All 12 Field Types", () => {
    const baseDef = (
      fieldType: CustomFieldDefinition["fieldType"],
      config: Record<string, unknown> = {},
      required = false
    ): CustomFieldDefinition => ({
      id: "def-123",
      organizationId: orgAId,
      entityType: "lead",
      key: "test_field",
      label: "Test Field",
      description: null,
      fieldType,
      required,
      active: true,
      displayOrder: 0,
      config,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // 1. Text
    it("validates text fields", () => {
      const def = baseDef("text", { minLength: 3, maxLength: 10 });
      expect(validateCustomFieldValue(def, "Hello").isValid).toBe(true);
      expect(validateCustomFieldValue(def, "Hi").isValid).toBe(false);
      expect(validateCustomFieldValue(def, "This is way too long").isValid).toBe(false);
      expect(validateCustomFieldValue(def, 123).isValid).toBe(false);
    });

    // 2. Textarea
    it("validates textarea fields", () => {
      const def = baseDef("textarea", { maxLength: 50 });
      expect(validateCustomFieldValue(def, "A short multi-line\nnote.").isValid).toBe(true);
      expect(validateCustomFieldValue(def, "a".repeat(60)).isValid).toBe(false);
      expect(validateCustomFieldValue(def, { obj: true }).isValid).toBe(false);
    });

    // 3. Number
    it("validates number fields", () => {
      const def = baseDef("number", { min: 10, max: 100 });
      expect(validateCustomFieldValue(def, 50).isValid).toBe(true);
      expect(validateCustomFieldValue(def, "50").isValid).toBe(true);
      expect(validateCustomFieldValue(def, 5).isValid).toBe(false);
      expect(validateCustomFieldValue(def, 150).isValid).toBe(false);
      expect(validateCustomFieldValue(def, "not-a-number").isValid).toBe(false);
    });

    // 4. Currency
    it("validates currency fields", () => {
      const def = baseDef("currency", { min: 0 });
      expect(validateCustomFieldValue(def, 1500.5).isValid).toBe(true);
      expect(
        validateCustomFieldValue(def, { amount: 2500, currency: "USD" }).isValid
      ).toBe(true);
      expect(validateCustomFieldValue(def, -50).isValid).toBe(false);
      expect(validateCustomFieldValue(def, "invalid").isValid).toBe(false);
    });

    // 5. Date
    it("validates date fields (YYYY-MM-DD)", () => {
      const def = baseDef("date");
      expect(validateCustomFieldValue(def, "2026-09-30").isValid).toBe(true);
      expect(validateCustomFieldValue(def, "30-09-2026").isValid).toBe(false);
      expect(validateCustomFieldValue(def, "not-a-date").isValid).toBe(false);
    });

    // 6. DateTime
    it("validates datetime fields (ISO 8601)", () => {
      const def = baseDef("datetime");
      expect(
        validateCustomFieldValue(def, "2026-09-30T10:30:00.000Z").isValid
      ).toBe(true);
      expect(validateCustomFieldValue(def, "invalid-iso").isValid).toBe(false);
    });

    // 7. Boolean
    it("validates boolean fields", () => {
      const def = baseDef("boolean");
      expect(validateCustomFieldValue(def, true).isValid).toBe(true);
      expect(validateCustomFieldValue(def, false).isValid).toBe(true);
      expect(validateCustomFieldValue(def, "true").isValid).toBe(false);
      expect(validateCustomFieldValue(def, 1).isValid).toBe(false);
    });

    // 8. Select
    it("validates select fields against configured options", () => {
      const def = baseDef("select", {
        options: [
          { label: "High", value: "high" },
          { label: "Medium", value: "medium" },
          { label: "Low", value: "low" },
        ],
      });
      expect(validateCustomFieldValue(def, "high").isValid).toBe(true);
      expect(validateCustomFieldValue(def, "urgent").isValid).toBe(false);
      expect(validateCustomFieldValue(def, 123).isValid).toBe(false);
    });

    // 9. Multiselect
    it("validates multiselect fields against configured options", () => {
      const def = baseDef("multiselect", {
        options: [
          { label: "Email", value: "email" },
          { label: "SMS", value: "sms" },
          { label: "Phone", value: "phone" },
        ],
      });
      expect(validateCustomFieldValue(def, ["email", "sms"]).isValid).toBe(true);
      expect(validateCustomFieldValue(def, ["email", "carrier_pigeon"]).isValid).toBe(false);
      expect(validateCustomFieldValue(def, "email").isValid).toBe(false); // must be array
    });

    // 10. Email
    it("validates email fields", () => {
      const def = baseDef("email");
      expect(validateCustomFieldValue(def, "customer@example.com").isValid).toBe(true);
      expect(validateCustomFieldValue(def, "invalid-email").isValid).toBe(false);
    });

    // 11. Phone
    it("validates phone fields", () => {
      const def = baseDef("phone");
      expect(validateCustomFieldValue(def, "+1 (555) 234-5678").isValid).toBe(true);
      expect(validateCustomFieldValue(def, "12345").isValid).toBe(false); // too short
      expect(validateCustomFieldValue(def, "abc-defg-hijk").isValid).toBe(false);
    });

    // 12. URL
    it("validates url fields", () => {
      const def = baseDef("url");
      expect(validateCustomFieldValue(def, "https://ghurucrm.com").isValid).toBe(true);
      expect(validateCustomFieldValue(def, "http://localhost:3000").isValid).toBe(true);
      expect(validateCustomFieldValue(def, "ftp://invalid-scheme.com").isValid).toBe(false);
      expect(validateCustomFieldValue(def, "not-a-url").isValid).toBe(false);
    });

    // Required Field Enforcement
    it("enforces required fields when value is null, undefined, or empty", () => {
      const requiredDef = baseDef("text", {}, true);
      expect(validateCustomFieldValue(requiredDef, null).isValid).toBe(false);
      expect(validateCustomFieldValue(requiredDef, undefined).isValid).toBe(false);
      expect(validateCustomFieldValue(requiredDef, "").isValid).toBe(false);
      expect(validateCustomFieldValue(requiredDef, "   ").isValid).toBe(false);

      const optionalDef = baseDef("text", {}, false);
      expect(validateCustomFieldValue(optionalDef, null).isValid).toBe(true);
      expect(validateCustomFieldValue(optionalDef, undefined).isValid).toBe(true);
      expect(validateCustomFieldValue(optionalDef, "").isValid).toBe(true);
    });
  });

  describe("8. Polymorphic Custom Field Values Storage", () => {
    it("should set and retrieve custom field values on an entity", async () => {
      const leadField = await createCustomField(
        orgAId,
        {
          entityType: "lead",
          key: "lead_score_calc",
          label: "Lead Score",
          fieldType: "number",
          config: { min: 0, max: 100 },
        },
        testDb
      );

      const dummyLeadId = crypto.randomUUID();

      // Set value
      const savedVal = await setCustomFieldValue(
        orgAId,
        "lead",
        dummyLeadId,
        leadField.id,
        85,
        testDb
      );

      expect(savedVal).toBeDefined();
      expect(savedVal.value).toBe(85);
      expect(savedVal.entityId).toBe(dummyLeadId);

      // Update value
      const updatedVal = await setCustomFieldValue(
        orgAId,
        "lead",
        dummyLeadId,
        leadField.id,
        92,
        testDb
      );
      expect(updatedVal.value).toBe(92);
      expect(updatedVal.id).toBe(savedVal.id); // Same row updated

      // Retrieve values for entity
      const values = await getCustomFieldValuesForEntity(
        orgAId,
        "lead",
        dummyLeadId,
        testDb
      );
      const scoreEntry = values.find((v) => v.field.id === leadField.id);
      expect(scoreEntry).toBeDefined();
      expect(scoreEntry?.value).toBe(92);
    });

    it("should prevent setting a custom field value on mismatched entityType", async () => {
      const contactField = await createCustomField(
        orgAId,
        {
          entityType: "contact",
          key: "contact_linkedin",
          label: "LinkedIn Profile",
          fieldType: "url",
        },
        testDb
      );

      const dummyLeadId = crypto.randomUUID();

      // Try setting contact field on lead entity
      await expect(
        setCustomFieldValue(
          orgAId,
          "lead",
          dummyLeadId,
          contactField.id,
          "https://linkedin.com/in/test",
          testDb
        )
      ).rejects.toThrow(ValidationError);
    });

    it("should enforce tenant isolation when setting custom field values", async () => {
      const orgBFields = await getCustomFields(orgBId, undefined, testDb);
      const bField = orgBFields[0];
      const dummyId = crypto.randomUUID();

      // Org A cannot set value for Org B's field definition
      await expect(
        setCustomFieldValue(
          orgAId,
          "lead",
          dummyId,
          bField.id,
          "Attempted cross-tenant write",
          testDb
        )
      ).rejects.toThrow(NotFoundError);
    });
  });
});
