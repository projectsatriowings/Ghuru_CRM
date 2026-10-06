import { describe, it, expect, beforeAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "@/db/schema";
import fs from "fs";
import path from "path";
import { createOrganization } from "@/lib/services/organization.service";
import {
  createLead,
  getLeadById,
  getLeads,
  archiveLead,
  convertLead,
  findDuplicateContacts,
} from "@/lib/services/lead.service";
import {
  createContact,
  getContactById,
  archiveContact,
} from "@/lib/services/contact.service";
import { createCompany } from "@/lib/services/company.service";
import { getLeadActivities } from "@/lib/services/activity.service";
import { NotFoundError, ValidationError } from "@/lib/errors";

describe("Milestone 2.5D — Lead → Contact Conversion Foundation Test Suite", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let testDb: any;
  let userAId: string;
  let userBId: string;
  let orgAId: string;
  let orgBId: string;

  beforeAll(async () => {
    // 1. Initialize in-memory PostgreSQL instance with PGlite
    const client = new PGlite();
    testDb = drizzle(client, { schema });

    // 2. Read and apply DDL migrations 0000 to 0010
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
      "0012_amused_sheva_callister.sql",
      "0013_regular_silk_fever.sql",
      "0014_flimsy_gorilla_man.sql",
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
    userAId = crypto.randomUUID();
    userBId = crypto.randomUUID();

    await testDb.insert(schema.users).values([
      {
        id: userAId,
        name: "Alice Admin",
        email: "alice@org-a.com",
        emailVerified: true,
      },
      {
        id: userBId,
        name: "Bob Outside",
        email: "bob@org-b.com",
        emailVerified: true,
      },
    ]);

    // 4. Create Organization A and Organization B
    const orgA = await createOrganization(
      { name: "Alpha CRM", slug: "alpha-crm", userId: userAId },
      testDb
    );
    orgAId = orgA.organization.id;

    const orgB = await createOrganization(
      { name: "Beta Corp", slug: "beta-corp", userId: userBId },
      testDb
    );
    orgBId = orgB.organization.id;
  });

  // =========================================================================
  // 1. CREATE_NEW MODE CONVERSIONS
  // =========================================================================

  it("1. Successfully converts a lead into a new contact in create_new mode", async () => {
    const lead = await createLead(
      orgAId,
      {
        firstName: "Vikram",
        lastName: "Patel",
        email: "vikram@example.com",
        phone: "+919876543210",
        source: "website",
      },
      testDb
    );

    const result = await convertLead(
      orgAId,
      lead.id,
      userAId,
      {
        mode: "create_new",
      },
      testDb
    );

    expect(result.contactId).toBeDefined();
    expect(result.lead.status).toBe("converted");
    expect(result.lead.contactId).toBe(result.contactId);

    // Verify contact in DB
    const contact = await getContactById(orgAId, result.contactId, testDb);
    expect(contact.id).toBe(result.contactId);
    expect(contact.firstName).toBe("Vikram");
    expect(contact.lastName).toBe("Patel");
    expect(contact.email).toBe("vikram@example.com");
    expect(contact.phone).toBe("+919876543210");
    expect(contact.organizationId).toBe(orgAId);
  });

  it("2. Inherits companyId from lead when present", async () => {
    const company = await createCompany(
      orgAId,
      { name: "Tech Mahindra" },
      testDb
    );

    const lead = await createLead(
      orgAId,
      {
        firstName: "Sneha",
        lastName: "Rao",
        companyId: company.id,
        source: "referral",
      },
      testDb
    );

    const result = await convertLead(
      orgAId,
      lead.id,
      userAId,
      { mode: "create_new" },
      testDb
    );

    const contact = await getContactById(orgAId, result.contactId, testDb);
    expect(contact.companyId).toBe(company.id);
  });

  it("3. Inherits assignedToUserId as ownerUserId when present", async () => {
    const lead = await createLead(
      orgAId,
      {
        firstName: "Arun",
        assignedToUserId: userAId,
        source: "events",
      },
      testDb
    );

    const result = await convertLead(
      orgAId,
      lead.id,
      userAId,
      { mode: "create_new" },
      testDb
    );

    const contact = await getContactById(orgAId, result.contactId, testDb);
    expect(contact.ownerUserId).toBe(userAId);
  });

  it("4. Creates an activity audit trail record on the lead upon conversion", async () => {
    const lead = await createLead(
      orgAId,
      {
        firstName: "Deepa",
        lastName: "Menon",
        source: "whatsapp",
      },
      testDb
    );

    await convertLead(
      orgAId,
      lead.id,
      userAId,
      { mode: "create_new" },
      testDb
    );

    const leadActivities = await getLeadActivities(orgAId, lead.id, undefined, testDb);
    const convActivity = leadActivities.find(
      (a) => a.title === "Lead converted to contact"
    );
    expect(convActivity).toBeDefined();
    expect(convActivity?.type).toBe("note");
    expect(convActivity?.createdByUserId).toBe(userAId);
    expect(convActivity?.description).toContain("Deepa Menon");
  });

  it("5. Custom conversionNotes are included in activity description", async () => {
    const lead = await createLead(
      orgAId,
      {
        firstName: "Pooja",
        lastName: "Sharma",
        source: "google_ads",
      },
      testDb
    );

    await convertLead(
      orgAId,
      lead.id,
      userAId,
      {
        mode: "create_new",
        conversionNotes: "Customer requested onboarding call on Friday",
      },
      testDb
    );

    const leadActivities = await getLeadActivities(orgAId, lead.id, undefined, testDb);
    const convActivity = leadActivities.find(
      (a) => a.title === "Lead converted to contact"
    );
    expect(convActivity?.description).toContain(
      "Customer requested onboarding call on Friday"
    );
  });

  // =========================================================================
  // 2. FIELD OVERRIDES IN CREATE_NEW MODE
  // =========================================================================

  it("6. overrideFirstName is used instead of lead's firstName", async () => {
    const lead = await createLead(
      orgAId,
      { firstName: "TypoName", lastName: "Verma", source: "other" },
      testDb
    );

    const result = await convertLead(
      orgAId,
      lead.id,
      userAId,
      {
        mode: "create_new",
        overrideFirstName: "CorrectedName",
      },
      testDb
    );

    const contact = await getContactById(orgAId, result.contactId, testDb);
    expect(contact.firstName).toBe("CorrectedName");
  });

  it("7. overrideLastName is used instead of lead's lastName", async () => {
    const lead = await createLead(
      orgAId,
      { firstName: "Rohit", lastName: null, source: "walk_in" },
      testDb
    );

    const result = await convertLead(
      orgAId,
      lead.id,
      userAId,
      {
        mode: "create_new",
        overrideLastName: "Gupta",
      },
      testDb
    );

    const contact = await getContactById(orgAId, result.contactId, testDb);
    expect(contact.lastName).toBe("Gupta");
  });

  it("8. overrideEmail is normalized to lowercase and used", async () => {
    const lead = await createLead(
      orgAId,
      { firstName: "Manish", email: "old@example.com", source: "phone_enquiry" },
      testDb
    );

    const result = await convertLead(
      orgAId,
      lead.id,
      userAId,
      {
        mode: "create_new",
        overrideEmail: "NEW_EMAIL@EXAMPLE.COM",
      },
      testDb
    );

    const contact = await getContactById(orgAId, result.contactId, testDb);
    expect(contact.email).toBe("new_email@example.com");
  });

  it("9. overridePhone is used instead of lead's phone", async () => {
    const lead = await createLead(
      orgAId,
      { firstName: "Kavita", phone: "1111111111", source: "meta_ads" },
      testDb
    );

    const result = await convertLead(
      orgAId,
      lead.id,
      userAId,
      {
        mode: "create_new",
        overridePhone: "9999999999",
      },
      testDb
    );

    const contact = await getContactById(orgAId, result.contactId, testDb);
    expect(contact.phone).toBe("9999999999");
  });

  it("10. Empty overrideFirstName throws ValidationError", async () => {
    const lead = await createLead(
      orgAId,
      { firstName: "ValidName", source: "other" },
      testDb
    );

    await expect(
      convertLead(
        orgAId,
        lead.id,
        userAId,
        {
          mode: "create_new",
          overrideFirstName: "   ",
        },
        testDb
      )
    ).rejects.toThrow(ValidationError);
  });

  // =========================================================================
  // 3. DUPLICATE CONTACT DETECTION
  // =========================================================================

  it("11. findDuplicateContacts detects matching email", async () => {
    await createContact(
      orgAId,
      {
        firstName: "Duplicate",
        lastName: "One",
        email: "duplicate-email@example.com",
      },
      testDb
    );

    const dups = await findDuplicateContacts(
      orgAId,
      "duplicate-email@example.com",
      null,
      testDb
    );

    expect(dups.length).toBeGreaterThanOrEqual(1);
    expect(dups[0].email).toBe("duplicate-email@example.com");
  });

  it("12. findDuplicateContacts detects matching phone", async () => {
    await createContact(
      orgAId,
      {
        firstName: "Duplicate",
        lastName: "Two",
        phone: "+911234567890",
      },
      testDb
    );

    const dups = await findDuplicateContacts(
      orgAId,
      null,
      "+911234567890",
      testDb
    );

    expect(dups.length).toBeGreaterThanOrEqual(1);
    expect(dups[0].phone).toBe("+911234567890");
  });

  it("13. findDuplicateContacts ignores archived contacts", async () => {
    const contact = await createContact(
      orgAId,
      {
        firstName: "Archived",
        email: "archived-contact@example.com",
      },
      testDb
    );

    await archiveContact(orgAId, contact.id, testDb);

    const dups = await findDuplicateContacts(
      orgAId,
      "archived-contact@example.com",
      null,
      testDb
    );

    expect(dups.length).toBe(0);
  });

  it("14. findDuplicateContacts returns empty array if email and phone are null", async () => {
    const dups = await findDuplicateContacts(orgAId, null, null, testDb);
    expect(dups).toEqual([]);
  });

  it("15. findDuplicateContacts respects tenant isolation", async () => {
    await createContact(
      orgBId,
      {
        firstName: "OrgBContact",
        email: "shared-domain@example.com",
      },
      testDb
    );

    const dupsInOrgA = await findDuplicateContacts(
      orgAId,
      "shared-domain@example.com",
      null,
      testDb
    );

    expect(dupsInOrgA.length).toBe(0);
  });

  it("16. convertLead returns duplicates without creating contact when duplicates exist", async () => {
    await createContact(
      orgAId,
      {
        firstName: "Existing",
        email: "dup-guard@example.com",
      },
      testDb
    );

    const lead = await createLead(
      orgAId,
      {
        firstName: "NewLead",
        email: "dup-guard@example.com",
        source: "website",
      },
      testDb
    );

    const result = await convertLead(
      orgAId,
      lead.id,
      userAId,
      { mode: "create_new" },
      testDb
    );

    // Must return duplicates list and empty contactId
    expect(result.duplicates).toBeDefined();
    expect(result.duplicates?.length).toBeGreaterThanOrEqual(1);
    expect(result.contactId).toBe("");

    // Lead must NOT have been converted
    const freshLead = await getLeadById(orgAId, lead.id, testDb);
    expect(freshLead.status).toBe("new");
    expect(freshLead.contactId).toBeNull();
  });

  it("17. skipDuplicateCheck: true bypasses duplicate guard and completes conversion", async () => {
    await createContact(
      orgAId,
      {
        firstName: "ExistingTwin",
        email: "twin@example.com",
      },
      testDb
    );

    const lead = await createLead(
      orgAId,
      {
        firstName: "LeadTwin",
        email: "twin@example.com",
        source: "meta_ads",
      },
      testDb
    );

    const result = await convertLead(
      orgAId,
      lead.id,
      userAId,
      {
        mode: "create_new",
        skipDuplicateCheck: true,
      },
      testDb
    );

    expect(result.contactId).toBeDefined();
    expect(result.contactId).not.toBe("");
    expect(result.lead.status).toBe("converted");
    expect(result.lead.contactId).toBe(result.contactId);
  });

  // =========================================================================
  // 4. LINK_EXISTING MODE CONVERSIONS
  // =========================================================================

  it("18. Successfully links lead to an existing active contact in the same org", async () => {
    const existingContact = await createContact(
      orgAId,
      {
        firstName: "PreExisting",
        lastName: "Customer",
        email: "preexisting@example.com",
      },
      testDb
    );

    const lead = await createLead(
      orgAId,
      {
        firstName: "LeadToLink",
        source: "events",
      },
      testDb
    );

    const result = await convertLead(
      orgAId,
      lead.id,
      userAId,
      {
        mode: "link_existing",
        existingContactId: existingContact.id,
      },
      testDb
    );

    expect(result.contactId).toBe(existingContact.id);
    expect(result.lead.status).toBe("converted");
    expect(result.lead.contactId).toBe(existingContact.id);

    // Fresh lead check
    const updatedLead = await getLeadById(orgAId, lead.id, testDb);
    expect(updatedLead.status).toBe("converted");
    expect(updatedLead.contactId).toBe(existingContact.id);
  });

  it("19. Creates activity audit trail on lead for link_existing mode", async () => {
    const contact = await createContact(
      orgAId,
      {
        firstName: "AuditLink",
        lastName: "Person",
      },
      testDb
    );

    const lead = await createLead(
      orgAId,
      {
        firstName: "AuditLead",
        source: "referral",
      },
      testDb
    );

    await convertLead(
      orgAId,
      lead.id,
      userAId,
      {
        mode: "link_existing",
        existingContactId: contact.id,
        conversionNotes: "Existing client returning for secondary service",
      },
      testDb
    );

    const activities = await getLeadActivities(orgAId, lead.id, undefined, testDb);
    const linkActivity = activities.find(
      (a) => a.title === "Lead linked to existing contact"
    );
    expect(linkActivity).toBeDefined();
    expect(linkActivity?.description).toContain("AuditLink Person");
    expect(linkActivity?.description).toContain(
      "Existing client returning for secondary service"
    );
  });

  it("20. Throws ValidationError if existingContactId is missing or empty in link_existing mode", async () => {
    const lead = await createLead(
      orgAId,
      { firstName: "MissingTarget", source: "other" },
      testDb
    );

    await expect(
      convertLead(
        orgAId,
        lead.id,
        userAId,
        {
          mode: "link_existing",
          existingContactId: "",
        },
        testDb
      )
    ).rejects.toThrow(ValidationError);
  });

  it("21. Throws ValidationError if existingContactId belongs to another organization", async () => {
    // Contact in Org B
    const orgBContact = await createContact(
      orgBId,
      { firstName: "OrgBContact" },
      testDb
    );

    // Lead in Org A
    const orgALead = await createLead(
      orgAId,
      { firstName: "OrgALead", source: "website" },
      testDb
    );

    await expect(
      convertLead(
        orgAId,
        orgALead.id,
        userAId,
        {
          mode: "link_existing",
          existingContactId: orgBContact.id,
        },
        testDb
      )
    ).rejects.toThrow(ValidationError);
  });

  it("22. Throws ValidationError if target contact is archived", async () => {
    const contact = await createContact(
      orgAId,
      { firstName: "ToArchive" },
      testDb
    );
    await archiveContact(orgAId, contact.id, testDb);

    const lead = await createLead(
      orgAId,
      { firstName: "LeadVsArchived", source: "website" },
      testDb
    );

    await expect(
      convertLead(
        orgAId,
        lead.id,
        userAId,
        {
          mode: "link_existing",
          existingContactId: contact.id,
        },
        testDb
      )
    ).rejects.toThrow(ValidationError);
  });

  // =========================================================================
  // 5. GUARDRAILS & VALIDATION
  // =========================================================================

  it("23. Cannot convert an archived lead", async () => {
    const lead = await createLead(
      orgAId,
      { firstName: "ArchivedLead", source: "other" },
      testDb
    );
    await archiveLead(orgAId, lead.id, testDb);

    await expect(
      convertLead(
        orgAId,
        lead.id,
        userAId,
        { mode: "create_new" },
        testDb
      )
    ).rejects.toThrow(ValidationError);
  });

  it("24. Cannot convert an already-converted lead", async () => {
    const lead = await createLead(
      orgAId,
      { firstName: "DoubleConvert", source: "other" },
      testDb
    );

    // First conversion
    await convertLead(
      orgAId,
      lead.id,
      userAId,
      { mode: "create_new" },
      testDb
    );

    // Attempt second conversion
    await expect(
      convertLead(
        orgAId,
        lead.id,
        userAId,
        { mode: "create_new" },
        testDb
      )
    ).rejects.toThrow(ValidationError);
  });

  it("25. Converting non-existent lead throws NotFoundError", async () => {
    await expect(
      convertLead(
        orgAId,
        crypto.randomUUID(),
        userAId,
        { mode: "create_new" },
        testDb
      )
    ).rejects.toThrow(NotFoundError);
  });

  it("26. Tenant isolation: Org A user cannot convert Org B lead", async () => {
    const leadInOrgB = await createLead(
      orgBId,
      { firstName: "LeadInB", source: "website" },
      testDb
    );

    await expect(
      convertLead(
        orgAId,
        leadInOrgB.id,
        userAId,
        { mode: "create_new" },
        testDb
      )
    ).rejects.toThrow(NotFoundError);
  });

  // =========================================================================
  // 6. LEAD QUERYING & RELATIONAL VIEWS
  // =========================================================================

  it("27. getLeadById returns contact summary object after conversion", async () => {
    const lead = await createLead(
      orgAId,
      {
        firstName: "SummaryCheck",
        lastName: "Tester",
        email: "summary-test@example.com",
        source: "referral",
      },
      testDb
    );

    const { contactId } = await convertLead(
      orgAId,
      lead.id,
      userAId,
      { mode: "create_new" },
      testDb
    );

    const fetchedLead = await getLeadById(orgAId, lead.id, testDb);
    expect(fetchedLead.contact).toBeDefined();
    expect(fetchedLead.contact?.id).toBe(contactId);
    expect(fetchedLead.contact?.firstName).toBe("SummaryCheck");
    expect(fetchedLead.contact?.lastName).toBe("Tester");
    expect(fetchedLead.contact?.email).toBe("summary-test@example.com");
  });

  it("28. getLeads includes contact summary in paginated list", async () => {
    const lead = await createLead(
      orgAId,
      {
        firstName: "PaginatedLead",
        email: "paginated-lead@example.com",
        source: "website",
      },
      testDb
    );

    await convertLead(
      orgAId,
      lead.id,
      userAId,
      { mode: "create_new" },
      testDb
    );

    const result = await getLeads(
      orgAId,
      { search: "PaginatedLead" },
      testDb
    );

    expect(result.data.length).toBeGreaterThanOrEqual(1);
    const found = result.data.find((l) => l.id === lead.id);
    expect(found?.contact).toBeDefined();
    expect(found?.contact?.firstName).toBe("PaginatedLead");
  });

  it("29. Unconverted lead has null contact and contactId", async () => {
    const lead = await createLead(
      orgAId,
      { firstName: "UnconvertedLead", source: "website" },
      testDb
    );

    const fetched = await getLeadById(orgAId, lead.id, testDb);
    expect(fetched.contactId).toBeNull();
    expect(fetched.contact).toBeNull();
  });
});
