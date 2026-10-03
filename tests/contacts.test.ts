import { describe, it, expect, beforeAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "@/db/schema";
import fs from "fs";
import path from "path";
import { eq, and } from "drizzle-orm";
import { createOrganization } from "@/lib/services/organization.service";
import { createCustomField } from "@/lib/services/custom-field.service";
import {
  createContact,
  getContacts,
  getContactById,
  updateContact,
  archiveContact,
  restoreContact,
} from "@/lib/services/contact.service";
import { INITIAL_PERMISSIONS, DEFAULT_ORG_ADMIN_ROLE } from "@/lib/permissions";
import { NotFoundError, ValidationError } from "@/lib/errors";

describe("Milestone 2.5A — Contacts Foundation Test Suite", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let testDb: any;
  let user1Id: string;
  let user2Id: string;
  let orgAId: string;
  let orgBId: string;

  beforeAll(async () => {
    // 1. Initialize in-memory PostgreSQL instance with PGlite
    const client = new PGlite();
    testDb = drizzle(client, { schema });

    // 2. Read and apply DDL migrations 0000 to 0007
    const migrationFiles = [
      "0000_moaning_vector.sql",
      "0001_flashy_king_bedlam.sql",
      "0002_lowly_shape.sql",
      "0003_furry_fixer.sql",
      "0004_glamorous_natasha_romanoff.sql",
      "0005_eminent_red_ghost.sql",
      "0006_new_kinsey_walden.sql",
      "0007_shiny_hellcat.sql",
    ];

    for (const file of migrationFiles) {
      const filePath = path.resolve(__dirname, `../drizzle/${file}`);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, "utf-8");
        for (const stmt of content
          .split("--> statement-breakpoint")
          .map((s) => s.trim())
          .filter((s) => s.length > 0)) {
          await client.exec(stmt);
        }
      }
    }

    // 3. Create test users
    user1Id = crypto.randomUUID();
    user2Id = crypto.randomUUID();

    await testDb.insert(schema.users).values([
      {
        id: user1Id,
        name: "Alice Owner",
        email: "alice@orga.com",
        emailVerified: true,
      },
      {
        id: user2Id,
        name: "Bob Outside",
        email: "bob@orgb.com",
        emailVerified: true,
      },
    ]);

    // 4. Create Organization A (Alice is Admin) and Organization B (Bob is Admin)
    const orgA = await createOrganization(
      { name: "Acme Corp", slug: "acme-corp", userId: user1Id },
      testDb
    );
    orgAId = orgA.organization.id;

    const orgB = await createOrganization(
      { name: "Beta LLC", slug: "beta-llc", userId: user2Id },
      testDb
    );
    orgBId = orgB.organization.id;
  });

  // 1. Create Contact
  it("1. should create a valid contact in organization", async () => {
    const contact = await createContact(
      orgAId,
      {
        firstName: "John",
        lastName: "Doe",
        email: "john.doe@example.com",
        phone: "+1-555-123-4567",
        ownerUserId: user1Id,
        notes: "Key decision maker at partner firm.",
      },
      testDb
    );

    expect(contact.id).toBeDefined();
    expect(contact.organizationId).toBe(orgAId);
    expect(contact.firstName).toBe("John");
    expect(contact.lastName).toBe("Doe");
    expect(contact.email).toBe("john.doe@example.com");
    expect(contact.phone).toBe("+1-555-123-4567");
    expect(contact.ownerUserId).toBe(user1Id);
    expect(contact.ownerUser).toBeDefined();
    expect(contact.ownerUser?.name).toBe("Alice Owner");
    expect(contact.notes).toBe("Key decision maker at partner firm.");
    expect(contact.archivedAt).toBeNull();
  });

  // 2. Required first name validation
  it("2. should reject contact creation when first name is missing or blank", async () => {
    await expect(
      createContact(
        orgAId,
        {
          firstName: "",
          email: "test@example.com",
        },
        testDb
      )
    ).rejects.toThrow();

    await expect(
      createContact(
        orgAId,
        {
          // @ts-expect-error Testing missing first name
          firstName: undefined,
          email: "test@example.com",
        },
        testDb
      )
    ).rejects.toThrow();
  });

  // 3. Invalid email rejection
  it("3. should reject invalid email format", async () => {
    await expect(
      createContact(
        orgAId,
        {
          firstName: "Jane",
          email: "not-an-email",
        },
        testDb
      )
    ).rejects.toThrow();
  });

  // 4. Optional fields
  it("4. should allow creating contact with only first name and all optional fields omitted or null", async () => {
    const contact = await createContact(
      orgAId,
      {
        firstName: "Minimalist",
      },
      testDb
    );

    expect(contact.id).toBeDefined();
    expect(contact.firstName).toBe("Minimalist");
    expect(contact.lastName).toBeNull();
    expect(contact.email).toBeNull();
    expect(contact.phone).toBeNull();
    expect(contact.ownerUserId).toBeNull();
    expect(contact.ownerUser).toBeNull();
    expect(contact.notes).toBeNull();
  });

  // 5. Get Contact
  it("5. should retrieve a contact by ID including owner info and custom fields", async () => {
    const created = await createContact(
      orgAId,
      {
        firstName: "Sarah",
        lastName: "Connor",
        email: "sarah@resistance.org",
        ownerUserId: user1Id,
      },
      testDb
    );

    const fetched = await getContactById(orgAId, created.id, testDb);
    expect(fetched.id).toBe(created.id);
    expect(fetched.firstName).toBe("Sarah");
    expect(fetched.lastName).toBe("Connor");
    expect(fetched.ownerUser?.id).toBe(user1Id);
    expect(fetched.customFields).toBeDefined();
  });

  // 6. Update Contact
  it("6. should update contact details and reflect changes", async () => {
    const contact = await createContact(
      orgAId,
      {
        firstName: "Bruce",
        lastName: "Wayne",
        email: "bruce@wayne.com",
      },
      testDb
    );

    const updated = await updateContact(
      orgAId,
      contact.id,
      {
        firstName: "Batman",
        notes: "Protector of Gotham",
        phone: "+1-555-999-0000",
      },
      testDb
    );

    expect(updated.firstName).toBe("Batman");
    expect(updated.lastName).toBe("Wayne");
    expect(updated.notes).toBe("Protector of Gotham");
    expect(updated.phone).toBe("+1-555-999-0000");
  });

  // 7. Archive Contact
  it("7. should archive contact and exclude from active list by default", async () => {
    const contact = await createContact(
      orgAId,
      {
        firstName: "ToArchive",
        email: "archive@test.com",
      },
      testDb
    );

    const archived = await archiveContact(orgAId, contact.id, testDb);
    expect(archived.archivedAt).not.toBeNull();

    // Default list should not contain archived contact
    const list = await getContacts(orgAId, {}, testDb);
    expect(list.data.some((c) => c.id === contact.id)).toBe(false);
  });

  // 8. Restore Contact
  it("8. should restore archived contact and return it to active list", async () => {
    const contact = await createContact(
      orgAId,
      {
        firstName: "ToRestore",
        email: "restore@test.com",
      },
      testDb
    );

    await archiveContact(orgAId, contact.id, testDb);
    const restored = await restoreContact(orgAId, contact.id, testDb);
    expect(restored.archivedAt).toBeNull();

    const list = await getContacts(orgAId, {}, testDb);
    expect(list.data.some((c) => c.id === contact.id)).toBe(true);
  });

  // 9. List Contacts
  it("9. should list active contacts scoped to organization", async () => {
    const list = await getContacts(orgAId, { pageSize: 50 }, testDb);
    expect(list.data.length).toBeGreaterThan(0);
    expect(list.data.every((c) => c.organizationId === orgAId)).toBe(true);
  });

  // 10. Search by name (first name, last name, full name)
  it("10. should search contacts by first name, last name, and full name", async () => {
    await createContact(
      orgAId,
      {
        firstName: "Alexander",
        lastName: "Hamilton",
        email: "hamilton@treasury.gov",
      },
      testDb
    );

    // Search by first name
    const searchFirst = await getContacts(orgAId, { search: "Alexander" }, testDb);
    expect(searchFirst.data.some((c) => c.firstName === "Alexander")).toBe(true);

    // Search by last name
    const searchLast = await getContacts(orgAId, { search: "Hamilton" }, testDb);
    expect(searchLast.data.some((c) => c.lastName === "Hamilton")).toBe(true);

    // Search by full name
    const searchFull = await getContacts(
      orgAId,
      { search: "Alexander Hamilton" },
      testDb
    );
    expect(searchFull.data.some((c) => c.firstName === "Alexander")).toBe(true);
  });

  // 11. Search by email
  it("11. should search contacts by email", async () => {
    await createContact(
      orgAId,
      {
        firstName: "UniqueEmailUser",
        email: "unique.special@domain.com",
      },
      testDb
    );

    const searchEmail = await getContacts(
      orgAId,
      { search: "unique.special@domain.com" },
      testDb
    );
    expect(searchEmail.data.length).toBe(1);
    expect(searchEmail.data[0].email).toBe("unique.special@domain.com");
  });

  // 12. Search by phone
  it("12. should search contacts by phone number", async () => {
    await createContact(
      orgAId,
      {
        firstName: "PhonePerson",
        phone: "+91-9876543210",
      },
      testDb
    );

    const searchPhone = await getContacts(
      orgAId,
      { search: "9876543210" },
      testDb
    );
    expect(searchPhone.data.some((c) => c.phone === "+91-9876543210")).toBe(true);
  });

  // 13. Owner filtering
  it("13. should filter contacts by owner (specific owner and unassigned)", async () => {
    const assignedContact = await createContact(
      orgAId,
      {
        firstName: "AssignedContact",
        ownerUserId: user1Id,
      },
      testDb
    );

    const unassignedContact = await createContact(
      orgAId,
      {
        firstName: "UnassignedContact",
        ownerUserId: null,
      },
      testDb
    );

    const ownerFilter = await getContacts(
      orgAId,
      { ownerId: user1Id },
      testDb
    );
    expect(ownerFilter.data.some((c) => c.id === assignedContact.id)).toBe(true);
    expect(ownerFilter.data.some((c) => c.id === unassignedContact.id)).toBe(false);

    const unassignedFilter = await getContacts(
      orgAId,
      { ownerId: "unassigned" },
      testDb
    );
    expect(unassignedFilter.data.some((c) => c.id === unassignedContact.id)).toBe(true);
    expect(unassignedFilter.data.some((c) => c.id === assignedContact.id)).toBe(false);
  });

  // 14. Pagination
  it("14. should paginate contacts properly", async () => {
    const page1 = await getContacts(orgAId, { page: 1, pageSize: 2 }, testDb);
    expect(page1.pagination.page).toBe(1);
    expect(page1.pagination.pageSize).toBe(2);
    expect(page1.pagination.total).toBeGreaterThanOrEqual(2);
    expect(page1.pagination.totalPages).toBeGreaterThanOrEqual(1);
    expect(page1.data.length).toBeLessThanOrEqual(2);
  });

  // 15. Archived filtering
  it("15. should filter by archived status (archived='true', 'false', 'all')", async () => {
    const toArchive = await createContact(
      orgAId,
      { firstName: "ArchivedFilterTest" },
      testDb
    );
    await archiveContact(orgAId, toArchive.id, testDb);

    // archived=false (default)
    const activeOnly = await getContacts(
      orgAId,
      { archived: "false", pageSize: 100 },
      testDb
    );
    expect(activeOnly.data.some((c) => c.id === toArchive.id)).toBe(false);

    // archived=true
    const archivedOnly = await getContacts(
      orgAId,
      { archived: "true", pageSize: 100 },
      testDb
    );
    expect(archivedOnly.data.some((c) => c.id === toArchive.id)).toBe(true);

    // archived=all
    const allContacts = await getContacts(
      orgAId,
      { archived: "all", pageSize: 100 },
      testDb
    );
    expect(allContacts.data.some((c) => c.id === toArchive.id)).toBe(true);
  });

  // 16. Custom field creation/value handling
  it("16. should handle generic custom fields for entity_type='contact'", async () => {
    // Create text custom field for contact in Org A
    await createCustomField(
      orgAId,
      {
        entityType: "contact",
        key: "industry_experience",
        label: "Industry Experience",
        fieldType: "text",
        required: false,
      },
      testDb
    );

    const contact = await createContact(
      orgAId,
      {
        firstName: "Techie",
        customFields: {
          industry_experience: "10 years in SaaS",
        },
      },
      testDb
    );

    expect(contact.customFields?.industry_experience).toBe("10 years in SaaS");

    const fetched = await getContactById(orgAId, contact.id, testDb);
    expect(fetched.customFields?.industry_experience).toBe("10 years in SaaS");
  });

  // 17. Required Contact custom field validation
  it("17. should validate required custom fields for contact", async () => {
    await createCustomField(
      orgAId,
      {
        entityType: "contact",
        key: "mandatory_tag",
        label: "Mandatory Tag",
        fieldType: "text",
        required: true,
      },
      testDb
    );

    // Should fail when mandatory_tag is missing
    await expect(
      createContact(
        orgAId,
        {
          firstName: "MissingReqField",
          customFields: {},
        },
        testDb
      )
    ).rejects.toThrow(ValidationError);

    // Should succeed when mandatory_tag is provided
    const valid = await createContact(
      orgAId,
      {
        firstName: "WithReqField",
        customFields: {
          mandatory_tag: "Provided Value",
        },
      },
      testDb
    );
    expect(valid.customFields?.mandatory_tag).toBe("Provided Value");
  });

  // 18. Select Contact custom field validation
  it("18. should validate select custom field options for contact", async () => {
    await createCustomField(
      orgAId,
      {
        entityType: "contact",
        key: "seniority_level",
        label: "Seniority Level",
        fieldType: "select",
        required: false,
        config: {
          options: [
            { label: "Junior", value: "junior" },
            { label: "Mid", value: "mid" },
            { label: "Senior", value: "senior" },
          ],
        },
      },
      testDb
    );

    // Invalid option
    await expect(
      createContact(
        orgAId,
        {
          firstName: "InvalidSelectUser",
          customFields: {
            mandatory_tag: "Valid",
            seniority_level: "executive_director",
          },
        },
        testDb
      )
    ).rejects.toThrow(ValidationError);

    // Valid option
    const contact = await createContact(
      orgAId,
      {
        firstName: "ValidSelectUser",
        customFields: {
          mandatory_tag: "Valid",
          seniority_level: "senior",
        },
      },
      testDb
    );
    expect(contact.customFields?.seniority_level).toBe("senior");
  });

  // 19. Organization tenant isolation
  it("19. should strictly isolate contacts between organizations", async () => {
    const contactA = await createContact(
      orgAId,
      {
        firstName: "OrgA Person",
        customFields: { mandatory_tag: "Valid" },
      },
      testDb
    );

    const contactB = await createContact(
      orgBId,
      {
        firstName: "OrgB Person",
      },
      testDb
    );

    const listA = await getContacts(orgAId, { pageSize: 100 }, testDb);
    expect(listA.data.some((c) => c.id === contactA.id)).toBe(true);
    expect(listA.data.some((c) => c.id === contactB.id)).toBe(false);

    const listB = await getContacts(orgBId, { pageSize: 100 }, testDb);
    expect(listB.data.some((c) => c.id === contactB.id)).toBe(true);
    expect(listB.data.some((c) => c.id === contactA.id)).toBe(false);
  });

  // 20. Cross-tenant Contact access rejection
  it("20. should reject cross-tenant contact access with NotFoundError", async () => {
    const contactB = await createContact(
      orgBId,
      {
        firstName: "Secret OrgB Contact",
      },
      testDb
    );

    // Org A cannot get Org B contact
    await expect(
      getContactById(orgAId, contactB.id, testDb)
    ).rejects.toThrow(NotFoundError);

    // Org A cannot update Org B contact
    await expect(
      updateContact(orgAId, contactB.id, { firstName: "Hacked" }, testDb)
    ).rejects.toThrow(NotFoundError);

    // Org A cannot archive Org B contact
    await expect(
      archiveContact(orgAId, contactB.id, testDb)
    ).rejects.toThrow(NotFoundError);

    // Org A cannot restore Org B contact
    await expect(
      restoreContact(orgAId, contactB.id, testDb)
    ).rejects.toThrow(NotFoundError);
  });

  // 21. Cross-tenant owner assignment rejection
  it("21. should reject assigning contact owner who belongs to another organization", async () => {
    // user2Id is member of Org B, not Org A
    await expect(
      createContact(
        orgAId,
        {
          firstName: "IntruderContact",
          ownerUserId: user2Id,
          customFields: { mandatory_tag: "Valid" },
        },
        testDb
      )
    ).rejects.toThrow(ValidationError);
  });

  // 22. RBAC contacts.view
  it("22. should have contacts.view defined in initial system permissions", () => {
    const perm = INITIAL_PERMISSIONS.find((p) => p.key === "contacts.view");
    expect(perm).toBeDefined();
    expect(perm?.description).toContain("contacts");
  });

  // 23. RBAC contacts.create
  it("23. should have contacts.create defined in initial system permissions", () => {
    const perm = INITIAL_PERMISSIONS.find((p) => p.key === "contacts.create");
    expect(perm).toBeDefined();
    expect(perm?.description).toContain("contacts");
  });

  // 24. RBAC contacts.update
  it("24. should have contacts.update defined in initial system permissions", () => {
    const perm = INITIAL_PERMISSIONS.find((p) => p.key === "contacts.update");
    expect(perm).toBeDefined();
    expect(perm?.description).toContain("contacts");
  });

  // 25. RBAC contacts.delete
  it("25. should have contacts.delete defined in initial system permissions", () => {
    const perm = INITIAL_PERMISSIONS.find((p) => p.key === "contacts.delete");
    expect(perm).toBeDefined();
    expect(perm?.description).toContain("contacts");
  });

  // 26. Organization Admin permissions
  it("26. Organization Admin role must have all 4 contact permissions assigned", async () => {
    const [adminRole] = await testDb
      .select()
      .from(schema.roles)
      .where(
        and(
          eq(schema.roles.organizationId, orgAId),
          eq(schema.roles.name, DEFAULT_ORG_ADMIN_ROLE)
        )
      );

    expect(adminRole).toBeDefined();

    const rolePerms = await testDb
      .select({ key: schema.permissions.key })
      .from(schema.rolePermissions)
      .innerJoin(
        schema.permissions,
        eq(schema.rolePermissions.permissionId, schema.permissions.id)
      )
      .where(eq(schema.rolePermissions.roleId, adminRole.id));

    const permKeys = rolePerms.map((rp: { key: string }) => rp.key);

    expect(permKeys).toContain("contacts.view");
    expect(permKeys).toContain("contacts.create");
    expect(permKeys).toContain("contacts.update");
    expect(permKeys).toContain("contacts.delete");
  });
});
