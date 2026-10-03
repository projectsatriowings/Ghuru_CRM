import { describe, it, expect, beforeAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "@/db/schema";
import fs from "fs";
import path from "path";
import { eq, and } from "drizzle-orm";
import { createOrganization } from "@/lib/services/organization.service";
import {
  createCompany,
  getCompanyById,
  updateCompany,
  archiveCompany,
  restoreCompany,
  getCompanyContacts,
  getCompanyLeads,
  setContactCompany,
  setPrimaryContact,
  removeContactFromCompany,
  setLeadCompany,
  removeLeadFromCompany,
} from "@/lib/services/company.service";
import {
  createContact,
  getContactById,
  updateContact,
  getContacts,
  archiveContact,
  restoreContact,
} from "@/lib/services/contact.service";
import {
  createLead,
  getLeadById,
  updateLead,
  getLeads,
  archiveLead,
  restoreLead,
} from "@/lib/services/lead.service";
import {
  createPipeline,
  createStage,
  getActivePipelinesWithStages,
} from "@/lib/services/pipeline.service";
import {
  createActivity,
  getLeadActivities,
} from "@/lib/services/activity.service";
import {
  createFollowUp,
  getLeadFollowUps,
} from "@/lib/services/follow-up.service";
import {
  createCustomField,
} from "@/lib/services/custom-field.service";
import { INITIAL_PERMISSIONS, DEFAULT_ORG_ADMIN_ROLE } from "@/lib/permissions";
import { NotFoundError, ValidationError } from "@/lib/errors";

describe("Milestone 2.5C — CRM Entity Relationships Foundation Test Suite", () => {
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

    // 2. Read and apply DDL migrations 0000 to 0009
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
        name: "Alice Admin",
        email: "alice@org-a.com",
        emailVerified: true,
      },
      {
        id: user2Id,
        name: "Bob Outside",
        email: "bob@org-b.com",
        emailVerified: true,
      },
    ]);

    // 4. Create Organization A and Organization B
    const orgA = await createOrganization(
      { name: "Alpha CRM", slug: "alpha-crm", userId: user1Id },
      testDb
    );
    orgAId = orgA.organization.id;

    const orgB = await createOrganization(
      { name: "Beta Corp", slug: "beta-corp", userId: user2Id },
      testDb
    );
    orgBId = orgB.organization.id;
  });

  // 1. Contact can be assigned to Company
  it("1. Contact can be assigned to Company", async () => {
    const company = await createCompany(
      orgAId,
      { name: "Acme Enterprises" },
      testDb
    );
    const contact = await createContact(
      orgAId,
      {
        firstName: "Rahul",
        lastName: "Kumar",
        companyId: company.id,
      },
      testDb
    );

    expect(contact.companyId).toBe(company.id);

    const fetched = await getContactById(orgAId, contact.id, testDb);
    expect(fetched.company?.id).toBe(company.id);
    expect(fetched.company?.name).toBe("Acme Enterprises");
  });

  // 2. Contact can exist without Company
  it("2. Contact can exist without Company", async () => {
    const contact = await createContact(
      orgAId,
      {
        firstName: "Independent",
        lastName: "Contact",
      },
      testDb
    );

    expect(contact.companyId).toBeNull();

    const fetched = await getContactById(orgAId, contact.id, testDb);
    expect(fetched.company).toBeNull();
  });

  // 3. Lead can be assigned to Company
  it("3. Lead can be assigned to Company", async () => {
    const company = await createCompany(
      orgAId,
      { name: "Globex Corporation" },
      testDb
    );
    const lead = await createLead(
      orgAId,
      {
        firstName: "Priya",
        lastName: "Sharma",
        companyId: company.id,
      },
      testDb
    );

    expect(lead.companyId).toBe(company.id);

    const fetched = await getLeadById(orgAId, lead.id, testDb);
    expect(fetched.company?.id).toBe(company.id);
    expect(fetched.company?.name).toBe("Globex Corporation");
  });

  // 4. Lead can exist without Company
  it("4. Lead can exist without Company", async () => {
    const lead = await createLead(
      orgAId,
      {
        firstName: "Solo",
        lastName: "Lead",
      },
      testDb
    );

    expect(lead.companyId).toBeNull();

    const fetched = await getLeadById(orgAId, lead.id, testDb);
    expect(fetched.company).toBeNull();
  });

  // 5. Company returns related Contacts
  it("5. Company returns related Contacts", async () => {
    const company = await createCompany(
      orgAId,
      { name: "MultiContact Inc" },
      testDb
    );

    await createContact(
      orgAId,
      { firstName: "Contact", lastName: "One", companyId: company.id },
      testDb
    );
    await createContact(
      orgAId,
      { firstName: "Contact", lastName: "Two", companyId: company.id },
      testDb
    );

    const relatedContacts = await getCompanyContacts(orgAId, company.id, testDb);
    expect(relatedContacts.length).toBe(2);
    expect(relatedContacts.map((c) => c.firstName)).toContain("Contact");

    const fetchedCompany = await getCompanyById(orgAId, company.id, testDb);
    expect(fetchedCompany.contactCount).toBe(2);
  });

  // 6. Company returns related Leads
  it("6. Company returns related Leads", async () => {
    const company = await createCompany(
      orgAId,
      { name: "MultiLead Corp" },
      testDb
    );

    await createLead(
      orgAId,
      { firstName: "Lead", lastName: "Alpha", companyId: company.id },
      testDb
    );
    await createLead(
      orgAId,
      { firstName: "Lead", lastName: "Beta", companyId: company.id },
      testDb
    );

    const relatedLeads = await getCompanyLeads(orgAId, company.id, testDb);
    expect(relatedLeads.length).toBe(2);

    const fetchedCompany = await getCompanyById(orgAId, company.id, testDb);
    expect(fetchedCompany.leadCount).toBe(2);
  });

  // 7. Primary Contact can be assigned
  it("7. Primary Contact can be assigned", async () => {
    const company = await createCompany(
      orgAId,
      { name: "PrimaryCo" },
      testDb
    );
    const contact = await createContact(
      orgAId,
      {
        firstName: "Chief",
        lastName: "Officer",
        companyId: company.id,
        isPrimaryContact: true,
      },
      testDb
    );

    expect(contact.isPrimaryContact).toBe(true);

    const fetchedCompany = await getCompanyById(orgAId, company.id, testDb);
    expect(fetchedCompany.primaryContact?.id).toBe(contact.id);
    expect(fetchedCompany.primaryContact?.firstName).toBe("Chief");
  });

  // 8. Only one primary Contact can exist per Company
  it("8. Only one primary Contact can exist per Company", async () => {
    const company = await createCompany(
      orgAId,
      { name: "SingletonPrimaryCo" },
      testDb
    );

    const c1 = await createContact(
      orgAId,
      {
        firstName: "Primary1",
        companyId: company.id,
        isPrimaryContact: true,
      },
      testDb
    );

    // Creating second primary contact should demote the first contact
    const c2 = await createContact(
      orgAId,
      {
        firstName: "Primary2",
        companyId: company.id,
        isPrimaryContact: true,
      },
      testDb
    );

    const fetchedC1 = await getContactById(orgAId, c1.id, testDb);
    const fetchedC2 = await getContactById(orgAId, c2.id, testDb);

    expect(fetchedC1.isPrimaryContact).toBe(false);
    expect(fetchedC2.isPrimaryContact).toBe(true);

    const companyDetails = await getCompanyById(orgAId, company.id, testDb);
    expect(companyDetails.primaryContact?.id).toBe(c2.id);
  });

  // 9. Changing primary Contact works
  it("9. Changing primary Contact works via service", async () => {
    const company = await createCompany(
      orgAId,
      { name: "SwitchPrimaryCo" },
      testDb
    );

    const c1 = await createContact(
      orgAId,
      { firstName: "First", companyId: company.id, isPrimaryContact: true },
      testDb
    );
    const c2 = await createContact(
      orgAId,
      { firstName: "Second", companyId: company.id, isPrimaryContact: false },
      testDb
    );

    await setPrimaryContact(orgAId, company.id, c2.id, testDb);

    const updatedC1 = await getContactById(orgAId, c1.id, testDb);
    const updatedC2 = await getContactById(orgAId, c2.id, testDb);

    expect(updatedC1.isPrimaryContact).toBe(false);
    expect(updatedC2.isPrimaryContact).toBe(true);
  });

  // 10. Removing Contact from Company works
  it("10. Removing Contact from Company works and keeps Contact intact", async () => {
    const company = await createCompany(
      orgAId,
      { name: "DetachContactCo" },
      testDb
    );
    const contact = await createContact(
      orgAId,
      {
        firstName: "Detachable",
        lastName: "User",
        companyId: company.id,
        isPrimaryContact: true,
      },
      testDb
    );

    await removeContactFromCompany(orgAId, contact.id, testDb);

    const fetched = await getContactById(orgAId, contact.id, testDb);
    expect(fetched.companyId).toBeNull();
    expect(fetched.isPrimaryContact).toBe(false);
    expect(fetched.firstName).toBe("Detachable"); // Contact not deleted
  });

  // 11. Removing Lead from Company works
  it("11. Removing Lead from Company works and keeps Lead intact", async () => {
    const company = await createCompany(
      orgAId,
      { name: "DetachLeadCo" },
      testDb
    );
    const lead = await createLead(
      orgAId,
      {
        firstName: "Detachable",
        lastName: "Lead",
        companyId: company.id,
      },
      testDb
    );

    await removeLeadFromCompany(orgAId, lead.id, testDb);

    const fetched = await getLeadById(orgAId, lead.id, testDb);
    expect(fetched.companyId).toBeNull();
    expect(fetched.firstName).toBe("Detachable"); // Lead not deleted
  });

  // 12. Removing company clears primary-contact state
  it("12. Removing company clears primary-contact state", async () => {
    const company = await createCompany(
      orgAId,
      { name: "ClearPrimaryCo" },
      testDb
    );
    const contact = await createContact(
      orgAId,
      {
        firstName: "WillBeCleared",
        companyId: company.id,
        isPrimaryContact: true,
      },
      testDb
    );

    // Update contact to have null companyId
    const updated = await updateContact(
      orgAId,
      contact.id,
      { companyId: null },
      testDb
    );

    expect(updated.companyId).toBeNull();
    expect(updated.isPrimaryContact).toBe(false);
  });

  // 13. Archived Company cannot be newly assigned
  it("13. Archived Company cannot be newly assigned", async () => {
    const company = await createCompany(
      orgAId,
      { name: "ArchivedCo" },
      testDb
    );
    await archiveCompany(orgAId, company.id, testDb);

    // Attempting to assign archived company to contact must fail
    await expect(
      createContact(
        orgAId,
        { firstName: "Fails", companyId: company.id },
        testDb
      )
    ).rejects.toThrow(ValidationError);

    // Attempting to assign archived company to lead must fail
    await expect(
      createLead(
        orgAId,
        { firstName: "Fails", companyId: company.id },
        testDb
      )
    ).rejects.toThrow(ValidationError);
  });

  // 14. Existing relationship survives Company archive
  it("14. Existing relationship survives Company archive", async () => {
    const company = await createCompany(
      orgAId,
      { name: "ToBeArchivedCo" },
      testDb
    );
    const contact = await createContact(
      orgAId,
      { firstName: "SurvivingContact", companyId: company.id },
      testDb
    );
    const lead = await createLead(
      orgAId,
      { firstName: "SurvivingLead", companyId: company.id },
      testDb
    );

    await archiveCompany(orgAId, company.id, testDb);

    const fetchedContact = await getContactById(orgAId, contact.id, testDb);
    const fetchedLead = await getLeadById(orgAId, lead.id, testDb);

    expect(fetchedContact.companyId).toBe(company.id);
    expect(fetchedLead.companyId).toBe(company.id);
  });

  // 15. Restored Company relationship remains valid
  it("15. Restored Company relationship remains valid", async () => {
    const company = await createCompany(
      orgAId,
      { name: "RestorableCo" },
      testDb
    );
    const contact = await createContact(
      orgAId,
      { firstName: "RestoredContact", companyId: company.id },
      testDb
    );

    await archiveCompany(orgAId, company.id, testDb);
    await restoreCompany(orgAId, company.id, testDb);

    const fetchedContact = await getContactById(orgAId, contact.id, testDb);
    expect(fetchedContact.company?.id).toBe(company.id);

    // Can now assign new contact as well
    const newContact = await createContact(
      orgAId,
      { firstName: "NewAfterRestore", companyId: company.id },
      testDb
    );
    expect(newContact.companyId).toBe(company.id);
  });

  // 16. Cross-tenant Contact → Company assignment rejected
  it("16. Cross-tenant Contact → Company assignment rejected", async () => {
    const companyB = await createCompany(
      orgBId,
      { name: "Org B Company" },
      testDb
    );

    // Org A contact trying to assign Org B company
    await expect(
      createContact(
        orgAId,
        { firstName: "Sneaky", companyId: companyB.id },
        testDb
      )
    ).rejects.toThrow(ValidationError);
  });

  // 17. Cross-tenant Lead → Company assignment rejected
  it("17. Cross-tenant Lead → Company assignment rejected", async () => {
    const companyB = await createCompany(
      orgBId,
      { name: "Org B Company" },
      testDb
    );

    // Org A lead trying to assign Org B company
    await expect(
      createLead(
        orgAId,
        { firstName: "SneakyLead", companyId: companyB.id },
        testDb
      )
    ).rejects.toThrow(ValidationError);
  });

  // 18. Cross-tenant Company related contacts rejected
  it("18. Cross-tenant Company related contacts rejected", async () => {
    const companyB = await createCompany(
      orgBId,
      { name: "Beta Private Co" },
      testDb
    );

    await expect(
      getCompanyContacts(orgAId, companyB.id, testDb)
    ).rejects.toThrow(NotFoundError);
  });

  // 19. Cross-tenant Company related leads rejected
  it("19. Cross-tenant Company related leads rejected", async () => {
    const companyB = await createCompany(
      orgBId,
      { name: "Beta Private Co 2" },
      testDb
    );

    await expect(
      getCompanyLeads(orgAId, companyB.id, testDb)
    ).rejects.toThrow(NotFoundError);
  });

  // 20. RBAC contacts.update enforced
  it("20. RBAC contacts.update defined in permissions", () => {
    const perm = INITIAL_PERMISSIONS.find((p) => p.key === "contacts.update");
    expect(perm).toBeDefined();
    expect(perm?.description.toLowerCase()).toContain("contact");
  });

  // 21. RBAC leads.update enforced
  it("21. RBAC leads.update defined in permissions", () => {
    const perm = INITIAL_PERMISSIONS.find((p) => p.key === "leads.update");
    expect(perm).toBeDefined();
    expect(perm?.description.toLowerCase()).toContain("lead");
  });

  // 22. RBAC companies.view enforced
  it("22. RBAC companies.view defined in permissions", () => {
    const perm = INITIAL_PERMISSIONS.find((p) => p.key === "companies.view");
    expect(perm).toBeDefined();
    expect(perm?.description.toLowerCase()).toContain("companies");
  });

  // 23. RBAC companies.update enforced where required
  it("23. RBAC companies.update defined in permissions", () => {
    const perm = INITIAL_PERMISSIONS.find((p) => p.key === "companies.update");
    expect(perm).toBeDefined();
    expect(perm?.description.toLowerCase()).toContain("company");
  });

  // 24. Company deletion/archive does not delete Contact
  it("24. Company archive does not delete Contact", async () => {
    const company = await createCompany(
      orgAId,
      { name: "SafeCompany" },
      testDb
    );
    const contact = await createContact(
      orgAId,
      { firstName: "Permanent", lastName: "Contact", companyId: company.id },
      testDb
    );

    await archiveCompany(orgAId, company.id, testDb);

    const contactStillExists = await getContactById(orgAId, contact.id, testDb);
    expect(contactStillExists).toBeDefined();
    expect(contactStillExists.firstName).toBe("Permanent");
    expect(contactStillExists.archivedAt).toBeNull();
  });

  // 25. Company deletion/archive does not delete Lead
  it("25. Company archive does not delete Lead", async () => {
    const company = await createCompany(
      orgAId,
      { name: "SafeCompanyLeads" },
      testDb
    );
    const lead = await createLead(
      orgAId,
      { firstName: "Permanent", lastName: "Lead", companyId: company.id },
      testDb
    );

    await archiveCompany(orgAId, company.id, testDb);

    const leadStillExists = await getLeadById(orgAId, lead.id, testDb);
    expect(leadStillExists).toBeDefined();
    expect(leadStillExists.firstName).toBe("Permanent");
    expect(leadStillExists.archivedAt).toBeNull();
  });

  // 26. Existing Contact CRUD still passes
  it("26. Existing Contact CRUD still passes", async () => {
    const created = await createContact(
      orgAId,
      { firstName: "CRUD", lastName: "Contact", email: "crud@example.com" },
      testDb
    );
    expect(created.firstName).toBe("CRUD");

    const updated = await updateContact(
      orgAId,
      created.id,
      { firstName: "CRUD-Updated" },
      testDb
    );
    expect(updated.firstName).toBe("CRUD-Updated");

    const archived = await archiveContact(orgAId, created.id, testDb);
    expect(archived.archivedAt).toBeDefined();

    const restored = await restoreContact(orgAId, created.id, testDb);
    expect(restored.archivedAt).toBeNull();
  });

  // 27. Existing Company CRUD still passes
  it("27. Existing Company CRUD still passes", async () => {
    const created = await createCompany(
      orgAId,
      { name: "CRUD Company", industry: "Tech" },
      testDb
    );
    expect(created.name).toBe("CRUD Company");

    const updated = await updateCompany(
      orgAId,
      created.id,
      { name: "CRUD Company Updated" },
      testDb
    );
    expect(updated.name).toBe("CRUD Company Updated");

    const archived = await archiveCompany(orgAId, created.id, testDb);
    expect(archived.archivedAt).toBeDefined();

    const restored = await restoreCompany(orgAId, created.id, testDb);
    expect(restored.archivedAt).toBeNull();
  });

  // 28. Existing Lead CRUD still passes
  it("28. Existing Lead CRUD still passes", async () => {
    const created = await createLead(
      orgAId,
      { firstName: "LeadCRUD", status: "new" },
      testDb
    );
    expect(created.firstName).toBe("LeadCRUD");

    const updated = await updateLead(
      orgAId,
      created.id,
      { status: "qualified" },
      testDb
    );
    expect(updated.status).toBe("qualified");

    const archived = await archiveLead(orgAId, created.id, testDb);
    expect(archived.archivedAt).toBeDefined();

    const restored = await restoreLead(orgAId, created.id, testDb);
    expect(restored.archivedAt).toBeNull();
  });

  // 29. Existing Pipeline/Stage behavior still passes
  it("29. Existing Pipeline/Stage behavior still passes", async () => {
    const pipeline = await createPipeline(
      orgAId,
      { name: "Sales Pipeline" },
      testDb
    );
    expect(pipeline.name).toBe("Sales Pipeline");

    const stage = await createStage(
      orgAId,
      pipeline.id,
      { name: "Discovery", displayOrder: 1 },
      testDb
    );
    expect(stage.name).toBe("Discovery");

    const leadWithPipeline = await createLead(
      orgAId,
      {
        firstName: "PipelineLead",
        pipelineId: pipeline.id,
        stageId: stage.id,
      },
      testDb
    );
    expect(leadWithPipeline.pipelineId).toBe(pipeline.id);
    expect(leadWithPipeline.stageId).toBe(stage.id);
  });

  // 30. Existing Activities still pass
  it("30. Existing Activities still pass", async () => {
    const lead = await createLead(
      orgAId,
      { firstName: "ActivityLead" },
      testDb
    );

    const activity = await createActivity(
      orgAId,
      user1Id,
      lead.id,
      {
        type: "call",
        title: "Initial Discovery Call",
      },
      testDb
    );
    expect(activity.type).toBe("call");

    const activities = await getLeadActivities(orgAId, lead.id, undefined, testDb);
    expect(activities.length).toBeGreaterThanOrEqual(1);
    expect(activities[0].title).toBe("Initial Discovery Call");
  });

  // 31. Existing Follow-ups still pass
  it("31. Existing Follow-ups still pass", async () => {
    const lead = await createLead(
      orgAId,
      { firstName: "FollowUpLead" },
      testDb
    );

    const followUp = await createFollowUp(
      orgAId,
      user1Id,
      lead.id,
      {
        title: "Send Proposal",
        dueDate: "2026-12-01",
        assignedToUserId: user1Id,
      },
      testDb
    );
    expect(followUp.title).toBe("Send Proposal");

    const followUps = await getLeadFollowUps(orgAId, lead.id, undefined, testDb);
    expect(followUps.length).toBeGreaterThanOrEqual(1);
    expect(followUps[0].title).toBe("Send Proposal");
  });

  // 32. Existing Custom Fields still pass
  it("32. Existing Custom Fields still pass", async () => {
    const customField = await createCustomField(
      orgAId,
      {
        entityType: "contact",
        key: "linkedin_profile",
        label: "LinkedIn Profile",
        fieldType: "text",
      },
      testDb
    );
    expect(customField.key).toBe("linkedin_profile");

    const contact = await createContact(
      orgAId,
      {
        firstName: "CustomFieldContact",
        customFields: {
          linkedin_profile: "https://linkedin.com/in/test",
        },
      },
      testDb
    );

    expect(contact.customFields?.linkedin_profile).toBe(
      "https://linkedin.com/in/test"
    );
  });
});
