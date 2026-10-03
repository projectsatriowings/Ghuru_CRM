import { describe, it, expect, beforeAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "@/db/schema";
import fs from "fs";
import path from "path";
import { createOrganization } from "@/lib/services/organization.service";
import {
  createPipeline,
  getPipelines,
  getPipelineById,
  updatePipeline,
  archivePipeline,
  setDefaultPipeline,
  createStage,
  getPipelineStages,
  getStageById,
  updateStage,
  archiveStage,
  reorderStages,
  moveStage,
} from "@/lib/services/pipeline.service";
import {
  createPipelineSchema,
  createStageSchema,
  reorderStagesSchema,
} from "@/lib/validations/pipeline";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { INITIAL_PERMISSIONS } from "@/lib/permissions";

describe("Milestone 2.4A — Pipelines & Stages Foundation Test Suite", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let testDb: any;
  let userAId: string;
  let userBId: string;
  let orgAId: string;
  let orgBId: string;

  beforeAll(async () => {
    // 1. Initialize PGlite database
    const client = new PGlite();
    testDb = drizzle(client, { schema });

    // 2. Read and apply all DDL migrations in order (0000 to 0005)
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
    userAId = crypto.randomUUID();
    userBId = crypto.randomUUID();

    await testDb.insert(schema.users).values([
      {
        id: userAId,
        name: "Admin User",
        email: "admin@org-a.com",
        emailVerified: true,
      },
      {
        id: userBId,
        name: "External User",
        email: "external@org-b.com",
        emailVerified: true,
      },
    ]);

    // 4. Create Organizations
    const orgA = await createOrganization(
      { name: "Alpha Workspace", slug: "alpha-ws", userId: userAId },
      testDb
    );
    orgAId = orgA.organization.id;

    const orgB = await createOrganization(
      { name: "Beta Workspace", slug: "beta-ws", userId: userBId },
      testDb
    );
    orgBId = orgB.organization.id;
  });

  describe("1. Pipeline CRUD & Name Validation", () => {
    it("should successfully create a pipeline with valid inputs", async () => {
      const pipeline = await createPipeline(
        orgAId,
        {
          name: "Admissions Pipeline",
          description: "Main student admissions journey",
          isDefault: true,
        },
        testDb
      );

      expect(pipeline).toBeDefined();
      expect(pipeline.id).toBeDefined();
      expect(pipeline.organizationId).toBe(orgAId);
      expect(pipeline.name).toBe("Admissions Pipeline");
      expect(pipeline.description).toBe("Main student admissions journey");
      expect(pipeline.isDefault).toBe(true);
      expect(pipeline.active).toBe(true);
      expect(pipeline.archivedAt).toBeNull();
    });

    it("should reject pipeline creation with empty name", async () => {
      expect(() =>
        createPipelineSchema.parse({
          name: "   ",
        })
      ).toThrow();
    });

    it("should reject duplicate pipeline name within the same organization", async () => {
      await expect(
        createPipeline(
          orgAId,
          {
            name: "admissions pipeline", // case-insensitive duplicate
          },
          testDb
        )
      ).rejects.toThrow(ConflictError);
    });

    it("should allow same pipeline name in a different organization", async () => {
      const pipelineB = await createPipeline(
        orgBId,
        {
          name: "Admissions Pipeline",
        },
        testDb
      );

      expect(pipelineB).toBeDefined();
      expect(pipelineB.organizationId).toBe(orgBId);
      expect(pipelineB.name).toBe("Admissions Pipeline");
    });

    it("should retrieve pipelines with active stage counts", async () => {
      const list = await getPipelines(orgAId, undefined, testDb);
      expect(list.length).toBeGreaterThanOrEqual(1);
      const found = list.find((p) => p.name === "Admissions Pipeline");
      expect(found).toBeDefined();
      expect(found?.stageCount).toBe(0);
    });

    it("should update pipeline details successfully", async () => {
      const list = await getPipelines(orgAId, undefined, testDb);
      const p = list[0];

      const updated = await updatePipeline(
        orgAId,
        p.id,
        {
          description: "Updated admissions description",
        },
        testDb
      );

      expect(updated.description).toBe("Updated admissions description");
    });
  });

  describe("2. Default Pipeline Behavior", () => {
    it("should ensure only one active default pipeline exists per organization", async () => {
      // Currently "Admissions Pipeline" is default
      const p1List = await getPipelines(orgAId, undefined, testDb);
      const admissions = p1List.find((p) => p.name === "Admissions Pipeline");
      expect(admissions?.isDefault).toBe(true);

      // Create "Sales Pipeline" as default
      const sales = await createPipeline(
        orgAId,
        {
          name: "Sales Pipeline",
          isDefault: true,
        },
        testDb
      );

      expect(sales.isDefault).toBe(true);

      // Check that Admissions Pipeline is now no longer default
      const p2List = await getPipelines(orgAId, undefined, testDb);
      const updatedAdmissions = p2List.find((p) => p.name === "Admissions Pipeline");
      const updatedSales = p2List.find((p) => p.name === "Sales Pipeline");

      expect(updatedAdmissions?.isDefault).toBe(false);
      expect(updatedSales?.isDefault).toBe(true);
    });

    it("should safely set default using setDefaultPipeline", async () => {
      const pList = await getPipelines(orgAId, undefined, testDb);
      const admissions = pList.find((p) => p.name === "Admissions Pipeline")!;

      await setDefaultPipeline(orgAId, admissions.id, testDb);

      const updatedList = await getPipelines(orgAId, undefined, testDb);
      const updatedAdmissions = updatedList.find((p) => p.name === "Admissions Pipeline");
      const updatedSales = updatedList.find((p) => p.name === "Sales Pipeline");

      expect(updatedAdmissions?.isDefault).toBe(true);
      expect(updatedSales?.isDefault).toBe(false);
    });
  });

  describe("3. Pipeline Archive & Tenant Isolation", () => {
    it("should archive a pipeline and exclude it from active listings", async () => {
      const tempPipeline = await createPipeline(
        orgAId,
        {
          name: "Temporary Pipeline",
        },
        testDb
      );

      const archived = await archivePipeline(orgAId, tempPipeline.id, testDb);
      expect(archived.archivedAt).not.toBeNull();
      expect(archived.active).toBe(false);

      const activeList = await getPipelines(orgAId, undefined, testDb);
      expect(activeList.some((p) => p.id === tempPipeline.id)).toBe(false);
    });

    it("should reject cross-tenant pipeline access", async () => {
      const orgAPipelines = await getPipelines(orgAId, undefined, testDb);
      const pipelineAId = orgAPipelines[0].id;

      // Org B user attempts to get Org A pipeline
      await expect(getPipelineById(orgBId, pipelineAId, undefined, testDb)).rejects.toThrow(
        NotFoundError
      );

      // Org B user attempts to update Org A pipeline
      await expect(
        updatePipeline(orgBId, pipelineAId, { name: "Hacked Name" }, testDb)
      ).rejects.toThrow(NotFoundError);

      // Org B user attempts to archive Org A pipeline
      await expect(archivePipeline(orgBId, pipelineAId, testDb)).rejects.toThrow(
        NotFoundError
      );
    });
  });

  describe("4. Stage CRUD & Auto-Ordering", () => {
    let pipelineId: string;

    beforeAll(async () => {
      const list = await getPipelines(orgAId, undefined, testDb);
      pipelineId = list.find((p) => p.name === "Admissions Pipeline")!.id;
    });

    it("should reject stage creation with empty name", async () => {
      expect(() =>
        createStageSchema.parse({
          name: "",
        })
      ).toThrow();
    });

    it("should auto-assign sequential displayOrder on stage creation", async () => {
      const s1 = await createStage(
        orgAId,
        pipelineId,
        { name: "New Lead", description: "First contact" },
        testDb
      );
      expect(s1.displayOrder).toBe(1);

      const s2 = await createStage(
        orgAId,
        pipelineId,
        { name: "Contacted" },
        testDb
      );
      expect(s2.displayOrder).toBe(2);

      const s3 = await createStage(
        orgAId,
        pipelineId,
        { name: "Counselling" },
        testDb
      );
      expect(s3.displayOrder).toBe(3);

      const s4 = await createStage(
        orgAId,
        pipelineId,
        { name: "Demo" },
        testDb
      );
      expect(s4.displayOrder).toBe(4);
    });

    it("should retrieve stages in displayOrder ascending", async () => {
      const stages = await getPipelineStages(orgAId, pipelineId, undefined, testDb);
      expect(stages.length).toBe(4);
      expect(stages[0].name).toBe("New Lead");
      expect(stages[1].name).toBe("Contacted");
      expect(stages[2].name).toBe("Counselling");
      expect(stages[3].name).toBe("Demo");
      expect(stages.map((s) => s.displayOrder)).toEqual([1, 2, 3, 4]);
    });

    it("should update a stage name and description", async () => {
      const stages = await getPipelineStages(orgAId, pipelineId, undefined, testDb);
      const counsellingStage = stages[2];

      const updated = await updateStage(
        orgAId,
        counsellingStage.id,
        { name: "Counselling Scheduled", description: "Scheduled meeting" },
        testDb
      );

      expect(updated.name).toBe("Counselling Scheduled");
      expect(updated.description).toBe("Scheduled meeting");
    });
  });

  describe("5. Stage Reordering & Move", () => {
    let pipelineId: string;

    beforeAll(async () => {
      const list = await getPipelines(orgAId, undefined, testDb);
      pipelineId = list.find((p) => p.name === "Admissions Pipeline")!.id;
    });

    it("should move a stage up or down relative to siblings", async () => {
      const stages = await getPipelineStages(orgAId, pipelineId, undefined, testDb);
      // stages are: [New Lead (1), Contacted (2), Counselling Scheduled (3), Demo (4)]
      const demoStage = stages[3]; // Demo

      // Move Demo UP (above Counselling Scheduled)
      const afterMoveUp = await moveStage(orgAId, demoStage.id, "up", testDb);
      expect(afterMoveUp.map((s) => s.name)).toEqual([
        "New Lead",
        "Contacted",
        "Demo",
        "Counselling Scheduled",
      ]);
      expect(afterMoveUp.map((s) => s.displayOrder)).toEqual([1, 2, 3, 4]);
    });

    it("should reorder stages via reorderStages with complete array", async () => {
      const stages = await getPipelineStages(orgAId, pipelineId, undefined, testDb);
      // Reverse stages
      const reversedIds = [...stages].reverse().map((s) => s.id);

      const reordered = await reorderStages(orgAId, pipelineId, reversedIds, testDb);
      expect(reordered.map((s) => s.id)).toEqual(reversedIds);
      expect(reordered.map((s) => s.displayOrder)).toEqual([1, 2, 3, 4]);
    });

    it("should reject reorder with duplicate stage IDs", async () => {
      const stages = await getPipelineStages(orgAId, pipelineId, undefined, testDb);
      expect(() =>
        reorderStagesSchema.parse({
          stageIds: [stages[0].id, stages[0].id],
        })
      ).toThrow();
    });

    it("should reject reordering stages belonging to a different pipeline or org", async () => {
      // Create a pipeline in Org B with a stage
      const orgBPipeline = await createPipeline(
        orgBId,
        { name: "Org B Pipeline" },
        testDb
      );
      const orgBStage = await createStage(
        orgBId,
        orgBPipeline.id,
        { name: "Foreign Stage" },
        testDb
      );

      const orgAStages = await getPipelineStages(orgAId, pipelineId, undefined, testDb);

      // Attempt to include Org B's stage in Org A's reorder
      await expect(
        reorderStages(
          orgAId,
          pipelineId,
          [orgAStages[0].id, orgBStage.id],
          testDb
        )
      ).rejects.toThrow(ValidationError);
    });

    it("should archive a stage and exclude it from active stages", async () => {
      const stages = await getPipelineStages(orgAId, pipelineId, undefined, testDb);
      const stageToArchive = stages[0];

      const archived = await archiveStage(orgAId, stageToArchive.id, testDb);
      expect(archived.archivedAt).not.toBeNull();
      expect(archived.active).toBe(false);

      const remaining = await getPipelineStages(orgAId, pipelineId, undefined, testDb);
      expect(remaining.some((s) => s.id === stageToArchive.id)).toBe(false);
    });
  });

  describe("6. RBAC & Cross-Tenant Stage Access", () => {
    it("should include all 4 pipeline permissions in system permissions", () => {
      const requiredPerms = [
        "pipelines.view",
        "pipelines.create",
        "pipelines.update",
        "pipelines.delete",
      ];

      const existingKeys = INITIAL_PERMISSIONS.map((p) => p.key);
      for (const req of requiredPerms) {
        expect(existingKeys).toContain(req);
      }
    });

    it("should reject cross-tenant stage retrieval and updates", async () => {
      const orgAPipelines = await getPipelines(orgAId, undefined, testDb);
      const pipelineAId = orgAPipelines[0].id;
      const orgAStages = await getPipelineStages(orgAId, pipelineAId, undefined, testDb);
      const stageAId = orgAStages[0].id;

      // Org B user attempts to access Org A stage
      await expect(getStageById(orgBId, stageAId, testDb)).rejects.toThrow(
        NotFoundError
      );

      // Org B user attempts to update Org A stage
      await expect(
        updateStage(orgBId, stageAId, { name: "Cross Tenant Attack" }, testDb)
      ).rejects.toThrow(NotFoundError);

      // Org B user attempts to archive Org A stage
      await expect(archiveStage(orgBId, stageAId, testDb)).rejects.toThrow(
        NotFoundError
      );
    });
  });
});
