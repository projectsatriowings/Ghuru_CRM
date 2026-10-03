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
  createCompany,
  getCompanies,
  getCompanyById,
  updateCompany,
  archiveCompany,
  restoreCompany,
} from "@/lib/services/company.service";
import { INITIAL_PERMISSIONS, DEFAULT_ORG_ADMIN_ROLE } from "@/lib/permissions";
import { NotFoundError, ValidationError } from "@/lib/errors";

describe("Milestone 2.5B — Companies Foundation Test Suite", () => {
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

    // 2. Read and apply DDL migrations 0000 to 0008
    const migrationFiles = [
      "0000_moaning_vector.sql",
      "0001_flashy_king_bedlam.sql",
      "0002_lowly_shape.sql",
      "0003_furry_fixer.sql",
      "0004_glamorous_natasha_romanoff.sql",
      "0005_eminent_red_ghost.sql",
      "0006_new_kinsey_walden.sql",
      "0007_shiny_hellcat.sql",
      "0008_neat_terrax.sql",
      "0009_talented_bastion.sql",
      "0010_amused_gambit.sql",
      "0011_chubby_pete_wisdom.sql",
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
        name: "Carol Admin",
        email: "carol@orga.com",
        emailVerified: true,
      },
      {
        id: user2Id,
        name: "David Outside",
        email: "david@orgb.com",
        emailVerified: true,
      },
    ]);

    // 4. Create Organization A (Carol is Admin) and Organization B (David is Admin)
    const orgA = await createOrganization(
      { name: "Alpha Technologies", slug: "alpha-tech", userId: user1Id },
      testDb
    );
    orgAId = orgA.organization.id;

    const orgB = await createOrganization(
      { name: "Beta Ventures", slug: "beta-ventures", userId: user2Id },
      testDb
    );
    orgBId = orgB.organization.id;
  });

  // 1. Create Company
  it("1. should create a valid company in organization", async () => {
    const company = await createCompany(
      orgAId,
      {
        name: "Acme Corp",
        website: "https://acme.com",
        email: "contact@acme.com",
        phone: "+1-555-123-4567",
        industry: "Enterprise Software",
        companySize: "100-500",
        ownerUserId: user1Id,
        notes: "Strategic enterprise partner in Q4.",
      },
      testDb
    );

    expect(company.id).toBeDefined();
    expect(company.organizationId).toBe(orgAId);
    expect(company.name).toBe("Acme Corp");
    expect(company.website).toBe("https://acme.com");
    expect(company.email).toBe("contact@acme.com");
    expect(company.phone).toBe("+1-555-123-4567");
    expect(company.industry).toBe("Enterprise Software");
    expect(company.companySize).toBe("100-500");
    expect(company.ownerUserId).toBe(user1Id);
    expect(company.ownerUser).toBeDefined();
    expect(company.ownerUser?.name).toBe("Carol Admin");
    expect(company.notes).toBe("Strategic enterprise partner in Q4.");
    expect(company.archivedAt).toBeNull();
  });

  // 2. Required name validation
  it("2. should reject company creation when name is missing or blank", async () => {
    await expect(
      createCompany(
        orgAId,
        {
          name: "",
          email: "test@company.com",
        },
        testDb
      )
    ).rejects.toThrow();

    await expect(
      createCompany(
        orgAId,
        {
          // @ts-expect-error Testing missing name
          name: undefined,
          email: "test@company.com",
        },
        testDb
      )
    ).rejects.toThrow();
  });

  // 3. Invalid email rejected
  it("3. should reject invalid email format", async () => {
    await expect(
      createCompany(
        orgAId,
        {
          name: "Invalid Email Corp",
          email: "not-an-email",
        },
        testDb
      )
    ).rejects.toThrow();
  });

  // 4. Invalid website rejected
  it("4. should reject invalid website URL format", async () => {
    await expect(
      createCompany(
        orgAId,
        {
          name: "Invalid URL Corp",
          website: "not-a-valid-url",
        },
        testDb
      )
    ).rejects.toThrow();
  });

  // 5. Optional fields
  it("5. should allow creating company with only name and all optional fields omitted or null", async () => {
    const company = await createCompany(
      orgAId,
      {
        name: "Minimalist Company",
      },
      testDb
    );

    expect(company.id).toBeDefined();
    expect(company.name).toBe("Minimalist Company");
    expect(company.website).toBeNull();
    expect(company.email).toBeNull();
    expect(company.phone).toBeNull();
    expect(company.industry).toBeNull();
    expect(company.companySize).toBeNull();
    expect(company.ownerUserId).toBeNull();
    expect(company.ownerUser).toBeNull();
    expect(company.notes).toBeNull();
  });

  // 6. Get Company by ID
  it("6. should retrieve a company by ID including owner info and custom fields", async () => {
    const created = await createCompany(
      orgAId,
      {
        name: "Initech",
        website: "https://initech.com",
        ownerUserId: user1Id,
      },
      testDb
    );

    const fetched = await getCompanyById(orgAId, created.id, testDb);
    expect(fetched.id).toBe(created.id);
    expect(fetched.name).toBe("Initech");
    expect(fetched.website).toBe("https://initech.com");
    expect(fetched.ownerUser?.id).toBe(user1Id);
    expect(fetched.customFields).toBeDefined();
  });

  // 7. Update Company
  it("7. should update company details and reflect changes", async () => {
    const company = await createCompany(
      orgAId,
      {
        name: "Wayne Enterprises",
        industry: "Defense",
      },
      testDb
    );

    const updated = await updateCompany(
      orgAId,
      company.id,
      {
        industry: "Applied Sciences & Tech",
        companySize: "10000+",
        notes: "Global conglomerate with high tech division.",
      },
      testDb
    );

    expect(updated.name).toBe("Wayne Enterprises");
    expect(updated.industry).toBe("Applied Sciences & Tech");
    expect(updated.companySize).toBe("10000+");
    expect(updated.notes).toBe("Global conglomerate with high tech division.");
  });

  // 8. Archive Company
  it("8. should archive company and exclude from active list by default", async () => {
    const company = await createCompany(
      orgAId,
      {
        name: "ToArchive Corp",
      },
      testDb
    );

    const archived = await archiveCompany(orgAId, company.id, testDb);
    expect(archived.archivedAt).not.toBeNull();

    // Default list should not contain archived company
    const list = await getCompanies(orgAId, {}, testDb);
    expect(list.data.some((c) => c.id === company.id)).toBe(false);
  });

  // 9. Restore Company
  it("9. should restore archived company and return it to active list", async () => {
    const company = await createCompany(
      orgAId,
      {
        name: "ToRestore Corp",
      },
      testDb
    );

    await archiveCompany(orgAId, company.id, testDb);
    const restored = await restoreCompany(orgAId, company.id, testDb);
    expect(restored.archivedAt).toBeNull();

    const list = await getCompanies(orgAId, {}, testDb);
    expect(list.data.some((c) => c.id === company.id)).toBe(true);
  });

  // 10. List Companies
  it("10. should list active companies scoped to organization", async () => {
    const list = await getCompanies(orgAId, { pageSize: 50 }, testDb);
    expect(list.data.length).toBeGreaterThan(0);
    expect(list.data.every((c) => c.organizationId === orgAId)).toBe(true);
  });

  // 11. Search by company name
  it("11. should search companies by company name", async () => {
    await createCompany(
      orgAId,
      {
        name: "Stark Industries",
        industry: "Robotics",
      },
      testDb
    );

    const searchRes = await getCompanies(
      orgAId,
      { search: "Stark" },
      testDb
    );
    expect(searchRes.data.some((c) => c.name === "Stark Industries")).toBe(true);
  });

  // 12. Search by email
  it("12. should search companies by corporate email", async () => {
    await createCompany(
      orgAId,
      {
        name: "Cyberdyne Systems",
        email: "info@cyberdyne.ai",
      },
      testDb
    );

    const searchRes = await getCompanies(
      orgAId,
      { search: "info@cyberdyne.ai" },
      testDb
    );
    expect(searchRes.data.length).toBe(1);
    expect(searchRes.data[0].name).toBe("Cyberdyne Systems");
  });

  // 13. Search by phone
  it("13. should search companies by phone number", async () => {
    await createCompany(
      orgAId,
      {
        name: "Massive Dynamic",
        phone: "+1-800-555-4321",
      },
      testDb
    );

    const searchRes = await getCompanies(
      orgAId,
      { search: "8005554321" },
      testDb
    );
    expect(searchRes.data.some((c) => c.name === "Massive Dynamic")).toBe(true);
  });

  // 14. Search by website
  it("14. should search companies by website URL", async () => {
    await createCompany(
      orgAId,
      {
        name: "Hooli",
        website: "https://hooli.xyz",
      },
      testDb
    );

    const searchRes = await getCompanies(
      orgAId,
      { search: "hooli.xyz" },
      testDb
    );
    expect(searchRes.data.some((c) => c.name === "Hooli")).toBe(true);
  });

  // 15. Search by industry
  it("15. should search companies by industry", async () => {
    await createCompany(
      orgAId,
      {
        name: "Pied Piper",
        industry: "Data Compression",
      },
      testDb
    );

    const searchRes = await getCompanies(
      orgAId,
      { search: "Compression" },
      testDb
    );
    expect(searchRes.data.some((c) => c.name === "Pied Piper")).toBe(true);
  });

  // 16. Owner filtering
  it("16. should filter companies by assigned owner", async () => {
    const assignedCompany = await createCompany(
      orgAId,
      {
        name: "Assigned Company",
        ownerUserId: user1Id,
      },
      testDb
    );

    const unassignedCompany = await createCompany(
      orgAId,
      {
        name: "Unassigned Company",
        ownerUserId: null,
      },
      testDb
    );

    const filterRes = await getCompanies(
      orgAId,
      { ownerId: user1Id },
      testDb
    );
    expect(filterRes.data.some((c) => c.id === assignedCompany.id)).toBe(true);
    expect(filterRes.data.some((c) => c.id === unassignedCompany.id)).toBe(false);
  });

  // 17. Unassigned owner filtering
  it("17. should filter companies by unassigned owner", async () => {
    const unassignedFilter = await getCompanies(
      orgAId,
      { ownerId: "unassigned" },
      testDb
    );
    expect(unassignedFilter.data.every((c) => c.ownerUserId === null)).toBe(true);
  });

  // 18. Pagination
  it("18. should paginate companies properly", async () => {
    const page1 = await getCompanies(orgAId, { page: 1, pageSize: 2 }, testDb);
    expect(page1.pagination.page).toBe(1);
    expect(page1.pagination.pageSize).toBe(2);
    expect(page1.pagination.total).toBeGreaterThanOrEqual(2);
    expect(page1.pagination.totalPages).toBeGreaterThanOrEqual(1);
    expect(page1.data.length).toBeLessThanOrEqual(2);
  });

  // 19. Archived filtering
  it("19. should filter by archived status (archived='true', 'false', 'all')", async () => {
    const toArchive = await createCompany(
      orgAId,
      { name: "ArchivedFilterCo" },
      testDb
    );
    await archiveCompany(orgAId, toArchive.id, testDb);

    // archived=false (default)
    const activeOnly = await getCompanies(
      orgAId,
      { archived: "false", pageSize: 100 },
      testDb
    );
    expect(activeOnly.data.some((c) => c.id === toArchive.id)).toBe(false);

    // archived=true
    const archivedOnly = await getCompanies(
      orgAId,
      { archived: "true", pageSize: 100 },
      testDb
    );
    expect(archivedOnly.data.some((c) => c.id === toArchive.id)).toBe(true);

    // archived=all
    const allCompanies = await getCompanies(
      orgAId,
      { archived: "all", pageSize: 100 },
      testDb
    );
    expect(allCompanies.data.some((c) => c.id === toArchive.id)).toBe(true);
  });

  // 20. Custom field creation/value handling
  it("20. should handle generic custom fields for entity_type='company'", async () => {
    await createCustomField(
      orgAId,
      {
        entityType: "company",
        key: "annual_revenue",
        label: "Annual Revenue",
        fieldType: "currency",
        required: false,
      },
      testDb
    );

    const company = await createCompany(
      orgAId,
      {
        name: "Revenue Co",
        customFields: {
          annual_revenue: 5000000,
        },
      },
      testDb
    );

    expect(company.customFields?.annual_revenue).toBe(5000000);

    const fetched = await getCompanyById(orgAId, company.id, testDb);
    expect(fetched.customFields?.annual_revenue).toBe(5000000);
  });

  // 21. Required Company custom field validation
  it("21. should validate required custom fields for company", async () => {
    await createCustomField(
      orgAId,
      {
        entityType: "company",
        key: "tax_id",
        label: "Tax ID",
        fieldType: "text",
        required: true,
      },
      testDb
    );

    // Missing required custom field
    await expect(
      createCompany(
        orgAId,
        {
          name: "MissingTaxCo",
          customFields: {},
        },
        testDb
      )
    ).rejects.toThrow(ValidationError);

    // Provided required custom field
    const valid = await createCompany(
      orgAId,
      {
        name: "ValidTaxCo",
        customFields: {
          tax_id: "US-123456789",
        },
      },
      testDb
    );
    expect(valid.customFields?.tax_id).toBe("US-123456789");
  });

  // 22. Select Company custom field validation
  it("22. should validate select custom field options for company", async () => {
    await createCustomField(
      orgAId,
      {
        entityType: "company",
        key: "account_tier",
        label: "Account Tier",
        fieldType: "select",
        required: false,
        config: {
          options: [
            { label: "Tier 1", value: "tier_1" },
            { label: "Tier 2", value: "tier_2" },
            { label: "Tier 3", value: "tier_3" },
          ],
        },
      },
      testDb
    );

    // Invalid option
    await expect(
      createCompany(
        orgAId,
        {
          name: "InvalidTierCo",
          customFields: {
            tax_id: "US-999",
            account_tier: "tier_platinum",
          },
        },
        testDb
      )
    ).rejects.toThrow(ValidationError);

    // Valid option
    const validTier = await createCompany(
      orgAId,
      {
        name: "ValidTierCo",
        customFields: {
          tax_id: "US-999",
          account_tier: "tier_1",
        },
      },
      testDb
    );
    expect(validTier.customFields?.account_tier).toBe("tier_1");
  });

  // 23. Organization tenant isolation
  it("23. should strictly isolate companies between organizations", async () => {
    const companyA = await createCompany(
      orgAId,
      {
        name: "OrgA Exclusive Company",
        customFields: { tax_id: "US-A" },
      },
      testDb
    );

    const companyB = await createCompany(
      orgBId,
      {
        name: "OrgB Exclusive Company",
      },
      testDb
    );

    const listA = await getCompanies(orgAId, { pageSize: 100 }, testDb);
    expect(listA.data.some((c) => c.id === companyA.id)).toBe(true);
    expect(listA.data.some((c) => c.id === companyB.id)).toBe(false);

    const listB = await getCompanies(orgBId, { pageSize: 100 }, testDb);
    expect(listB.data.some((c) => c.id === companyB.id)).toBe(true);
    expect(listB.data.some((c) => c.id === companyA.id)).toBe(false);
  });

  // 24. Cross-tenant Company access rejection
  it("24. should reject cross-tenant company access with NotFoundError", async () => {
    const companyB = await createCompany(
      orgBId,
      {
        name: "Confidential OrgB Co",
      },
      testDb
    );

    // Org A cannot get Org B company
    await expect(
      getCompanyById(orgAId, companyB.id, testDb)
    ).rejects.toThrow(NotFoundError);

    // Org A cannot update Org B company
    await expect(
      updateCompany(orgAId, companyB.id, { name: "Hacked Co" }, testDb)
    ).rejects.toThrow(NotFoundError);

    // Org A cannot archive Org B company
    await expect(
      archiveCompany(orgAId, companyB.id, testDb)
    ).rejects.toThrow(NotFoundError);

    // Org A cannot restore Org B company
    await expect(
      restoreCompany(orgAId, companyB.id, testDb)
    ).rejects.toThrow(NotFoundError);
  });

  // 25. Cross-tenant owner assignment rejection
  it("25. should reject assigning company owner who belongs to another organization", async () => {
    // user2Id is member of Org B, not Org A
    await expect(
      createCompany(
        orgAId,
        {
          name: "IllegalOwnerCo",
          ownerUserId: user2Id,
          customFields: { tax_id: "US-LEGAL" },
        },
        testDb
      )
    ).rejects.toThrow(ValidationError);
  });

  // 26. RBAC companies.view
  it("26. should have companies.view defined in initial system permissions", () => {
    const perm = INITIAL_PERMISSIONS.find((p) => p.key === "companies.view");
    expect(perm).toBeDefined();
    expect(perm?.description.toLowerCase()).toContain("companies");
  });

  // 27. RBAC companies.create
  it("27. should have companies.create defined in initial system permissions", () => {
    const perm = INITIAL_PERMISSIONS.find((p) => p.key === "companies.create");
    expect(perm).toBeDefined();
    expect(perm?.description.toLowerCase()).toContain("companies");
  });

  // 28. RBAC companies.update
  it("28. should have companies.update defined in initial system permissions", () => {
    const perm = INITIAL_PERMISSIONS.find((p) => p.key === "companies.update");
    expect(perm).toBeDefined();
    expect(perm?.description.toLowerCase()).toContain("company");
  });

  // 29. RBAC companies.delete
  it("29. should have companies.delete defined in initial system permissions", () => {
    const perm = INITIAL_PERMISSIONS.find((p) => p.key === "companies.delete");
    expect(perm).toBeDefined();
    expect(perm?.description.toLowerCase()).toContain("companies");
  });

  // 30. Organization Admin receives Company permissions
  it("30. Organization Admin role must have all 4 company permissions assigned", async () => {
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

    expect(permKeys).toContain("companies.view");
    expect(permKeys).toContain("companies.create");
    expect(permKeys).toContain("companies.update");
    expect(permKeys).toContain("companies.delete");
  });
});
