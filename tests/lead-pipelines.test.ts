import { describe, it, expect, beforeAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "@/db/schema";
import fs from "fs";
import path from "path";
import { createOrganization } from "@/lib/services/organization.service";
import {
  createLead,
  getLeads,
  getLeadById,
  updateLead,
  archiveLead,
} from "@/lib/services/lead.service";
import {
  createPipeline,
  createStage,
  archivePipeline,
  archiveStage,
} from "@/lib/services/pipeline.service";
import {
  createActivity,
  getLeadActivities,
} from "@/lib/services/activity.service";
import {
  createFollowUp,
  getLeadFollowUps,
} from "@/lib/services/follow-up.service";
import { createCustomField } from "@/lib/services/custom-field.service";
import { ValidationError } from "@/lib/errors";

describe("Milestone 2.4B — Lead Pipeline & Stage Assignment Test Suite", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let testDb: any;
  let userAId: string;
  let userBId: string;
  let orgAId: string;
  let orgBId: string;

  // Org A pipeline & stages
  let pipelineA1Id: string;
  let stageA1_1Id: string;
  let stageA1_2Id: string;
  let pipelineA2Id: string;
  let stageA2_1Id: string;

  // Org B pipeline & stage (for multi-tenant isolation tests)
  let pipelineBId: string;
  let stageB_1Id: string;

  beforeAll(async () => {
    // 1. Initialize PGlite database
    const client = new PGlite();
    testDb = drizzle(client, { schema });

    // 2. Read and apply all DDL migrations in order (0000 to 0006)
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
        name: "Alice Owner",
        email: "alice@orga.com",
      },
      {
        id: userBId,
        name: "Bob Foreign",
        email: "bob@orgb.com",
      },
    ]);

    // 4. Create Organization A
    const orgA = await createOrganization(
      { name: "Acme Corporation", slug: "acme-corp", userId: userAId },
      testDb
    );
    orgAId = orgA.organization.id;

    // 5. Create Organization B (Tenant Isolation)
    const orgB = await createOrganization(
      { name: "Beta Industries", slug: "beta-ind", userId: userBId },
      testDb
    );
    orgBId = orgB.organization.id;

    // 6. Setup Pipelines and Stages in Org A
    const pipeA1 = await createPipeline(
      orgAId,
      { name: "Admissions Pipeline", isDefault: true },
      testDb
    );
    pipelineA1Id = pipeA1.id;

    const sA1_1 = await createStage(
      orgAId,
      pipelineA1Id,
      { name: "New Lead" },
      testDb
    );
    stageA1_1Id = sA1_1.id;

    const sA1_2 = await createStage(
      orgAId,
      pipelineA1Id,
      { name: "Counselling Scheduled" },
      testDb
    );
    stageA1_2Id = sA1_2.id;

    const pipeA2 = await createPipeline(
      orgAId,
      { name: "Sales Pipeline" },
      testDb
    );
    pipelineA2Id = pipeA2.id;

    const sA2_1 = await createStage(
      orgAId,
      pipelineA2Id,
      { name: "Demo" },
      testDb
    );
    stageA2_1Id = sA2_1.id;

    // 7. Setup Pipeline and Stage in Org B
    const pipeB = await createPipeline(
      orgBId,
      { name: "Org B Pipeline" },
      testDb
    );
    pipelineBId = pipeB.id;

    const sB1 = await createStage(
      orgBId,
      pipelineBId,
      { name: "Org B Stage 1" },
      testDb
    );
    stageB_1Id = sB1.id;
  });

  // Scenario 1: Lead can be created without pipeline/stage
  it("Scenario 1: Lead can be created without pipeline/stage (backward compatible)", async () => {
    const lead = await createLead(
      orgAId,
      {
        firstName: "Unassigned",
        lastName: "Lead",
        email: "unassigned@example.com",
      },
      testDb
    );

    expect(lead).toBeDefined();
    expect(lead.pipelineId).toBeNull();
    expect(lead.stageId).toBeNull();
    expect(lead.pipeline).toBeNull();
    expect(lead.stage).toBeNull();
  });

  // Scenario 2: Lead can be created with valid pipeline/stage
  it("Scenario 2: Lead can be created with valid pipeline/stage", async () => {
    const lead = await createLead(
      orgAId,
      {
        firstName: "Rahul",
        lastName: "Sharma",
        email: "rahul@example.com",
        pipelineId: pipelineA1Id,
        stageId: stageA1_1Id,
      },
      testDb
    );

    expect(lead).toBeDefined();
    expect(lead.pipelineId).toBe(pipelineA1Id);
    expect(lead.stageId).toBe(stageA1_1Id);
    expect(lead.pipeline?.name).toBe("Admissions Pipeline");
    expect(lead.stage?.name).toBe("New Lead");
  });

  // Scenario 3: Lead can be updated with valid pipeline/stage
  it("Scenario 3: Lead can be updated with valid pipeline/stage from unassigned", async () => {
    const initial = await createLead(
      orgAId,
      {
        firstName: "Priya",
        lastName: "Patel",
      },
      testDb
    );
    expect(initial.pipelineId).toBeNull();

    const updated = await updateLead(
      orgAId,
      initial.id,
      {
        pipelineId: pipelineA1Id,
        stageId: stageA1_1Id,
      },
      testDb
    );

    expect(updated.pipelineId).toBe(pipelineA1Id);
    expect(updated.stageId).toBe(stageA1_1Id);
    expect(updated.pipeline?.name).toBe("Admissions Pipeline");
    expect(updated.stage?.name).toBe("New Lead");
  });

  // Scenario 4: Lead can change stage within the same pipeline
  it("Scenario 4: Lead can change stage within the same pipeline (Quick Stage Change)", async () => {
    const lead = await createLead(
      orgAId,
      {
        firstName: "Amit",
        lastName: "Verma",
        pipelineId: pipelineA1Id,
        stageId: stageA1_1Id,
      },
      testDb
    );

    const changed = await updateLead(
      orgAId,
      lead.id,
      {
        stageId: stageA1_2Id,
      },
      testDb
    );

    expect(changed.pipelineId).toBe(pipelineA1Id);
    expect(changed.stageId).toBe(stageA1_2Id);
    expect(changed.stage?.name).toBe("Counselling Scheduled");
  });

  // Scenario 5: Lead can change pipeline and stage together
  it("Scenario 5: Lead can change pipeline and stage together", async () => {
    const lead = await createLead(
      orgAId,
      {
        firstName: "Kavita",
        lastName: "Nair",
        pipelineId: pipelineA1Id,
        stageId: stageA1_1Id,
      },
      testDb
    );

    const changed = await updateLead(
      orgAId,
      lead.id,
      {
        pipelineId: pipelineA2Id,
        stageId: stageA2_1Id,
      },
      testDb
    );

    expect(changed.pipelineId).toBe(pipelineA2Id);
    expect(changed.stageId).toBe(stageA2_1Id);
    expect(changed.pipeline?.name).toBe("Sales Pipeline");
    expect(changed.stage?.name).toBe("Demo");
  });

  // Scenario 6: Invalid pipeline ID is rejected
  it("Scenario 6: Invalid/non-existent pipeline ID is rejected", async () => {
    await expect(
      createLead(
        orgAId,
        {
          firstName: "Invalid",
          pipelineId: crypto.randomUUID(),
        },
        testDb
      )
    ).rejects.toThrow(ValidationError);
  });

  // Scenario 7: Invalid stage ID is rejected
  it("Scenario 7: Invalid/non-existent stage ID is rejected", async () => {
    await expect(
      createLead(
        orgAId,
        {
          firstName: "Invalid Stage",
          pipelineId: pipelineA1Id,
          stageId: crypto.randomUUID(),
        },
        testDb
      )
    ).rejects.toThrow(ValidationError);
  });

  // Scenario 8: Stage from another pipeline is rejected
  it("Scenario 8: Stage from another pipeline is rejected", async () => {
    // Pipeline A1 with Stage from Pipeline A2
    await expect(
      createLead(
        orgAId,
        {
          firstName: "Mismatched",
          pipelineId: pipelineA1Id,
          stageId: stageA2_1Id, // Belongs to pipeline A2
        },
        testDb
      )
    ).rejects.toThrow(ValidationError);

    // Also on update: changing pipeline without changing stage
    const lead = await createLead(
      orgAId,
      {
        firstName: "Test Mismatch Update",
        pipelineId: pipelineA1Id,
        stageId: stageA1_1Id,
      },
      testDb
    );

    await expect(
      updateLead(
        orgAId,
        lead.id,
        {
          pipelineId: pipelineA2Id, // Kept previous stage which is from A1
        },
        testDb
      )
    ).rejects.toThrow(ValidationError);
  });

  // Scenario 9: Cross-tenant pipeline assignment is rejected
  it("Scenario 9: Cross-tenant pipeline assignment is rejected (Org A lead with Org B pipeline)", async () => {
    await expect(
      createLead(
        orgAId,
        {
          firstName: "Cross Tenant",
          pipelineId: pipelineBId, // Belongs to Org B!
        },
        testDb
      )
    ).rejects.toThrow(ValidationError);

    const lead = await createLead(
      orgAId,
      {
        firstName: "Cross Tenant Update",
      },
      testDb
    );

    await expect(
      updateLead(
        orgAId,
        lead.id,
        {
          pipelineId: pipelineBId,
        },
        testDb
      )
    ).rejects.toThrow(ValidationError);
  });

  // Scenario 10: Cross-tenant stage assignment is rejected
  it("Scenario 10: Cross-tenant stage assignment is rejected (Org A lead with Org B stage)", async () => {
    await expect(
      createLead(
        orgAId,
        {
          firstName: "Cross Tenant Stage",
          pipelineId: pipelineA1Id,
          stageId: stageB_1Id, // Belongs to Org B!
        },
        testDb
      )
    ).rejects.toThrow(ValidationError);
  });

  // Scenario 11: Stage cannot be assigned without pipeline
  it("Scenario 11: Stage cannot be assigned without pipeline", async () => {
    await expect(
      createLead(
        orgAId,
        {
          firstName: "Stage Without Pipeline",
          stageId: stageA1_1Id,
        },
        testDb
      )
    ).rejects.toThrow(ValidationError);

    const lead = await createLead(
      orgAId,
      {
        firstName: "No Pipeline Lead",
      },
      testDb
    );

    await expect(
      updateLead(
        orgAId,
        lead.id,
        {
          stageId: stageA1_1Id,
        },
        testDb
      )
    ).rejects.toThrow(ValidationError);
  });

  // Scenario 12: Pipeline can be cleared to null
  it("Scenario 12: Pipeline can be cleared to null, which clears stage as well", async () => {
    const lead = await createLead(
      orgAId,
      {
        firstName: "To Be Cleared",
        pipelineId: pipelineA1Id,
        stageId: stageA1_1Id,
      },
      testDb
    );

    expect(lead.pipelineId).toBe(pipelineA1Id);

    const cleared = await updateLead(
      orgAId,
      lead.id,
      {
        pipelineId: null,
      },
      testDb
    );

    expect(cleared.pipelineId).toBeNull();
    expect(cleared.stageId).toBeNull();
    expect(cleared.pipeline).toBeNull();
    expect(cleared.stage).toBeNull();
  });

  // Scenario 13: Lead list returns pipeline/stage information
  it("Scenario 13: Lead list returns pipeline and stage information for leads", async () => {
    const leadsRes = await getLeads(orgAId, {}, testDb);

    expect(leadsRes.data.length).toBeGreaterThan(0);
    const withPipeline = leadsRes.data.find((l) => l.pipelineId !== null);
    expect(withPipeline).toBeDefined();
    expect(withPipeline?.pipeline).toBeDefined();
    expect(withPipeline?.stage).toBeDefined();
  });

  // Scenario 14: Lead detail returns pipeline/stage information
  it("Scenario 14: Lead detail returns pipeline and stage information", async () => {
    const created = await createLead(
      orgAId,
      {
        firstName: "Detailed",
        pipelineId: pipelineA1Id,
        stageId: stageA1_2Id,
      },
      testDb
    );

    const fetched = await getLeadById(orgAId, created.id, testDb);
    expect(fetched.pipelineId).toBe(pipelineA1Id);
    expect(fetched.stageId).toBe(stageA1_2Id);
    expect(fetched.pipeline?.name).toBe("Admissions Pipeline");
    expect(fetched.stage?.name).toBe("Counselling Scheduled");
  });

  // Scenario 15: Existing Leads with NULL pipeline/stage still load correctly
  it("Scenario 15: Existing Leads with NULL pipeline/stage load safely with null relations", async () => {
    const nullLead = await createLead(
      orgAId,
      {
        firstName: "Legacy",
        lastName: "Lead",
      },
      testDb
    );

    const fetched = await getLeadById(orgAId, nullLead.id, testDb);
    expect(fetched.pipelineId).toBeNull();
    expect(fetched.stageId).toBeNull();
    expect(fetched.pipeline).toBeNull();
    expect(fetched.stage).toBeNull();
  });

  // Scenario 16: Archived Lead behavior remains correct
  it("Scenario 16: Archived Lead behavior remains correct with pipeline/stage", async () => {
    const lead = await createLead(
      orgAId,
      {
        firstName: "Archived",
        pipelineId: pipelineA1Id,
        stageId: stageA1_1Id,
      },
      testDb
    );

    const archived = await archiveLead(orgAId, lead.id, testDb);
    expect(archived.archivedAt).not.toBeNull();
    expect(archived.pipelineId).toBe(pipelineA1Id);
    expect(archived.stageId).toBe(stageA1_1Id);
  });

  // Scenario 17: Pipeline filters work in getLeads
  it("Scenario 17: Pipeline filters work in getLeads", async () => {
    const filteredA1 = await getLeads(
      orgAId,
      { pipelineId: pipelineA1Id },
      testDb
    );
    expect(filteredA1.data.every((l) => l.pipelineId === pipelineA1Id)).toBe(true);

    const filteredUnassigned = await getLeads(
      orgAId,
      { pipelineId: "unassigned" },
      testDb
    );
    expect(filteredUnassigned.data.every((l) => l.pipelineId === null)).toBe(true);
  });

  // Scenario 18: Stage filters work in getLeads
  it("Scenario 18: Stage filters work in getLeads", async () => {
    const filteredStage = await getLeads(
      orgAId,
      { stageId: stageA1_1Id },
      testDb
    );
    expect(filteredStage.data.every((l) => l.stageId === stageA1_1Id)).toBe(true);
  });

  // Scenario 19: Cannot assign to archived pipeline or stage
  it("Scenario 19: Prohibits assignment to archived pipeline or archived stage", async () => {
    const pipeToArchive = await createPipeline(
      orgAId,
      { name: "Temp Pipe" },
      testDb
    );
    const stageToArchive = await createStage(
      orgAId,
      pipeToArchive.id,
      { name: "Temp Stage" },
      testDb
    );

    // Archive the stage
    await archiveStage(orgAId, stageToArchive.id, testDb);

    await expect(
      createLead(
        orgAId,
        {
          firstName: "Archived Stage Lead",
          pipelineId: pipeToArchive.id,
          stageId: stageToArchive.id,
        },
        testDb
      )
    ).rejects.toThrow(ValidationError);

    // Archive the pipeline
    await archivePipeline(orgAId, pipeToArchive.id, testDb);

    await expect(
      createLead(
        orgAId,
        {
          firstName: "Archived Pipe Lead",
          pipelineId: pipeToArchive.id,
        },
        testDb
      )
    ).rejects.toThrow(ValidationError);
  });

  // Scenario 20: Existing custom fields continue working on leads with pipeline
  it("Scenario 20: Existing custom fields continue working on leads with pipeline", async () => {
    await createCustomField(
      orgAId,
      {
        entityType: "lead",
        label: "Career Goal",
        key: "career_goal",
        fieldType: "text",
      },
      testDb
    );

    const lead = await createLead(
      orgAId,
      {
        firstName: "Rahul",
        pipelineId: pipelineA1Id,
        stageId: stageA1_2Id,
        customFields: {
          career_goal: "Become a full stack developer",
        },
      },
      testDb
    );

    const fetched = await getLeadById(orgAId, lead.id, testDb);
    expect(fetched.customFields?.["career_goal"]).toBe(
      "Become a full stack developer"
    );
  });

  // Scenario 21: Existing activities and follow-ups continue working on leads with pipeline
  it("Scenario 21: Existing activities and follow-ups continue working on leads with pipeline", async () => {
    const lead = await createLead(
      orgAId,
      {
        firstName: "Activities Test",
        pipelineId: pipelineA1Id,
        stageId: stageA1_1Id,
      },
      testDb
    );

    // Create Activity
    const activity = await createActivity(
      orgAId,
      userAId,
      lead.id,
      {
        type: "call",
        title: "Discussed Full Stack course",
      },
      testDb
    );
    expect(activity.id).toBeDefined();

    const activities = await getLeadActivities(orgAId, lead.id, {}, testDb);
    expect(activities.length).toBe(1);
    expect(activities[0].title).toBe("Discussed Full Stack course");

    // Create Follow-up
    const followUp = await createFollowUp(
      orgAId,
      userAId,
      lead.id,
      {
        title: "Call Rahul about weekend batch",
        dueDate: "2026-10-04",
        dueTime: "11:00",
      },
      testDb
    );
    expect(followUp.id).toBeDefined();

    const followUps = await getLeadFollowUps(orgAId, lead.id, {}, testDb);
    expect(followUps.length).toBe(1);
    expect(followUps[0].title).toBe("Call Rahul about weekend batch");
  });
});
