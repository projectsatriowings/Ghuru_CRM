import { db } from "@/db";
import { DbClient } from "@/db/types";
import { pipelines, pipelineStages } from "@/db/schema/pipelines";
import { eq, and, isNull, asc, max, sql, ne } from "drizzle-orm";
import {
  createPipelineSchema,
  updatePipelineSchema,
  createStageSchema,
  updateStageSchema,
  reorderStagesSchema,
  type CreatePipelineInput,
  type UpdatePipelineInput,
  type CreateStageInput,
  type UpdateStageInput,
} from "@/lib/validations/pipeline";
import {
  type Pipeline,
  type PipelineStage,
  type PipelineWithStages,
  type PipelineWithCount,
} from "@/lib/types/pipelines";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";

/**
 * Retrieves all active pipelines for an organization with active stage counts.
 */
export async function getPipelines(
  organizationId: string,
  options?: { includeArchived?: boolean },
  dbInstance: DbClient = db as DbClient
): Promise<PipelineWithCount[]> {
  const conditions = [eq(pipelines.organizationId, organizationId)];

  if (!options?.includeArchived) {
    conditions.push(isNull(pipelines.archivedAt));
  }

  const rows = await dbInstance
    .select({
      pipeline: pipelines,
    })
    .from(pipelines)
    .where(and(...conditions))
    .orderBy(asc(pipelines.displayOrder), asc(pipelines.createdAt));

  if (rows.length === 0) {
    return [];
  }

  // Get active stage counts for each pipeline
  const stageCounts = await dbInstance
    .select({
      pipelineId: pipelineStages.pipelineId,
      count: sql<number>`cast(count(${pipelineStages.id}) as int)`,
    })
    .from(pipelineStages)
    .where(
      and(
        eq(pipelineStages.organizationId, organizationId),
        isNull(pipelineStages.archivedAt)
      )
    )
    .groupBy(pipelineStages.pipelineId);

  const countMap = new Map<string, number>();
  for (const sc of stageCounts) {
    countMap.set(sc.pipelineId, sc.count);
  }

  return rows.map((r) => ({
    ...r.pipeline,
    stageCount: countMap.get(r.pipeline.id) || 0,
  }));
}

/**
 * Retrieves a single pipeline with all its active stages.
 */
export async function getPipelineById(
  organizationId: string,
  pipelineId: string,
  options?: { includeArchived?: boolean },
  dbInstance: DbClient = db as DbClient
): Promise<PipelineWithStages> {
  const conditions = [
    eq(pipelines.id, pipelineId),
    eq(pipelines.organizationId, organizationId),
  ];

  if (!options?.includeArchived) {
    conditions.push(isNull(pipelines.archivedAt));
  }

  const [pipeline] = await dbInstance
    .select()
    .from(pipelines)
    .where(and(...conditions))
    .limit(1);

  if (!pipeline) {
    throw new NotFoundError("Pipeline not found in this organization.");
  }

  const stageConditions = [
    eq(pipelineStages.pipelineId, pipelineId),
    eq(pipelineStages.organizationId, organizationId),
  ];

  if (!options?.includeArchived) {
    stageConditions.push(isNull(pipelineStages.archivedAt));
  }

  const stages = await dbInstance
    .select()
    .from(pipelineStages)
    .where(and(...stageConditions))
    .orderBy(asc(pipelineStages.displayOrder), asc(pipelineStages.createdAt));

  return {
    ...pipeline,
    stages,
  };
}

/**
 * Creates a new pipeline for an organization.
 * Enforces unique name among active pipelines and single default pipeline per org.
 */
export async function createPipeline(
  organizationId: string,
  input: CreatePipelineInput,
  dbInstance: DbClient = db as DbClient
): Promise<PipelineWithStages> {
  const validated = createPipelineSchema.parse(input);

  // 1. Check uniqueness of name among active pipelines in this organization
  const [existing] = await dbInstance
    .select({ id: pipelines.id })
    .from(pipelines)
    .where(
      and(
        eq(pipelines.organizationId, organizationId),
        sql`lower(${pipelines.name}) = lower(${validated.name})`,
        isNull(pipelines.archivedAt)
      )
    )
    .limit(1);

  if (existing) {
    throw new ConflictError(
      "A pipeline with this name already exists in this organization."
    );
  }

  // 2. If isDefault is true, unset any existing default pipeline in this organization
  if (validated.isDefault) {
    await dbInstance
      .update(pipelines)
      .set({ isDefault: false, updatedAt: new Date() })
      .where(
        and(
          eq(pipelines.organizationId, organizationId),
          eq(pipelines.isDefault, true),
          isNull(pipelines.archivedAt)
        )
      );
  }

  const id = crypto.randomUUID();

  const [newPipeline] = await dbInstance
    .insert(pipelines)
    .values({
      id,
      organizationId,
      name: validated.name,
      description: validated.description || null,
      active: validated.active ?? true,
      isDefault: validated.isDefault ?? false,
      displayOrder: validated.displayOrder ?? 0,
    })
    .returning();

  return {
    ...newPipeline,
    stages: [],
  };
}

/**
 * Updates an existing pipeline.
 */
export async function updatePipeline(
  organizationId: string,
  pipelineId: string,
  input: UpdatePipelineInput,
  dbInstance: DbClient = db as DbClient
): Promise<PipelineWithStages> {
  // 1. Verify existence in this organization
  const existing = await getPipelineById(organizationId, pipelineId, undefined, dbInstance);

  const validated = updatePipelineSchema.parse(input);

  // 2. If name is changing, check uniqueness among active pipelines
  if (validated.name && validated.name.toLowerCase() !== existing.name.toLowerCase()) {
    const [duplicate] = await dbInstance
      .select({ id: pipelines.id })
      .from(pipelines)
      .where(
        and(
          eq(pipelines.organizationId, organizationId),
          sql`lower(${pipelines.name}) = lower(${validated.name})`,
          ne(pipelines.id, pipelineId),
          isNull(pipelines.archivedAt)
        )
      )
      .limit(1);

    if (duplicate) {
      throw new ConflictError(
        "A pipeline with this name already exists in this organization."
      );
    }
  }

  // 3. If isDefault is being set to true, unset any other default pipeline
  if (validated.isDefault === true && !existing.isDefault) {
    await dbInstance
      .update(pipelines)
      .set({ isDefault: false, updatedAt: new Date() })
      .where(
        and(
          eq(pipelines.organizationId, organizationId),
          eq(pipelines.isDefault, true),
          ne(pipelines.id, pipelineId),
          isNull(pipelines.archivedAt)
        )
      );
  }

  const updateData: Partial<typeof pipelines.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (validated.name !== undefined) updateData.name = validated.name;
  if (validated.description !== undefined) updateData.description = validated.description;
  if (validated.active !== undefined) updateData.active = validated.active;
  if (validated.isDefault !== undefined) updateData.isDefault = validated.isDefault;
  if (validated.displayOrder !== undefined) updateData.displayOrder = validated.displayOrder;

  const [updated] = await dbInstance
    .update(pipelines)
    .set(updateData)
    .where(
      and(
        eq(pipelines.id, pipelineId),
        eq(pipelines.organizationId, organizationId)
      )
    )
    .returning();

  return {
    ...updated,
    stages: existing.stages,
  };
}

/**
 * Safely archives a pipeline (soft delete).
 * If the pipeline was default, isDefault is unset.
 */
export async function archivePipeline(
  organizationId: string,
  pipelineId: string,
  dbInstance: DbClient = db as DbClient
): Promise<Pipeline> {
  await getPipelineById(organizationId, pipelineId, undefined, dbInstance);

  const [archived] = await dbInstance
    .update(pipelines)
    .set({
      archivedAt: new Date(),
      active: false,
      isDefault: false,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(pipelines.id, pipelineId),
        eq(pipelines.organizationId, organizationId)
      )
    )
    .returning();

  return archived;
}

/**
 * Sets a pipeline as the default for an organization.
 */
export async function setDefaultPipeline(
  organizationId: string,
  pipelineId: string,
  dbInstance: DbClient = db as DbClient
): Promise<PipelineWithStages> {
  return updatePipeline(organizationId, pipelineId, { isDefault: true }, dbInstance);
}

/**
 * Retrieves all active stages for a pipeline, ordered by displayOrder asc, createdAt asc.
 */
export async function getPipelineStages(
  organizationId: string,
  pipelineId: string,
  options?: { includeArchived?: boolean },
  dbInstance: DbClient = db as DbClient
): Promise<PipelineStage[]> {
  // Verify pipeline ownership first
  await getPipelineById(organizationId, pipelineId, options, dbInstance);

  const conditions = [
    eq(pipelineStages.pipelineId, pipelineId),
    eq(pipelineStages.organizationId, organizationId),
  ];

  if (!options?.includeArchived) {
    conditions.push(isNull(pipelineStages.archivedAt));
  }

  return dbInstance
    .select()
    .from(pipelineStages)
    .where(and(...conditions))
    .orderBy(asc(pipelineStages.displayOrder), asc(pipelineStages.createdAt));
}

/**
 * Retrieves a single stage by ID within an organization.
 */
export async function getStageById(
  organizationId: string,
  stageId: string,
  dbInstance: DbClient = db as DbClient
): Promise<PipelineStage> {
  const [stage] = await dbInstance
    .select()
    .from(pipelineStages)
    .where(
      and(
        eq(pipelineStages.id, stageId),
        eq(pipelineStages.organizationId, organizationId),
        isNull(pipelineStages.archivedAt)
      )
    )
    .limit(1);

  if (!stage) {
    throw new NotFoundError("Pipeline stage not found in this organization.");
  }

  return stage;
}

/**
 * Creates a new stage in a pipeline.
 * If displayOrder is not specified, auto-assigns (maxOrder + 1).
 */
export async function createStage(
  organizationId: string,
  pipelineId: string,
  input: CreateStageInput,
  dbInstance: DbClient = db as DbClient
): Promise<PipelineStage> {
  // 1. Verify pipeline belongs to this organization
  await getPipelineById(organizationId, pipelineId, undefined, dbInstance);

  const validated = createStageSchema.parse(input);

  // 2. Resolve display order if not specified
  let displayOrder = validated.displayOrder;
  if (displayOrder === undefined) {
    const [maxResult] = await dbInstance
      .select({ maxOrder: max(pipelineStages.displayOrder) })
      .from(pipelineStages)
      .where(
        and(
          eq(pipelineStages.pipelineId, pipelineId),
          eq(pipelineStages.organizationId, organizationId),
          isNull(pipelineStages.archivedAt)
        )
      );

    displayOrder = (maxResult?.maxOrder ?? 0) + 1;
  }

  const id = crypto.randomUUID();

  const [newStage] = await dbInstance
    .insert(pipelineStages)
    .values({
      id,
      organizationId,
      pipelineId,
      name: validated.name,
      description: validated.description || null,
      displayOrder,
      active: validated.active ?? true,
    })
    .returning();

  return newStage;
}

/**
 * Updates an existing stage.
 */
export async function updateStage(
  organizationId: string,
  stageId: string,
  input: UpdateStageInput,
  dbInstance: DbClient = db as DbClient
): Promise<PipelineStage> {
  // Verify existence
  await getStageById(organizationId, stageId, dbInstance);

  const validated = updateStageSchema.parse(input);

  const updateData: Partial<typeof pipelineStages.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (validated.name !== undefined) updateData.name = validated.name;
  if (validated.description !== undefined) updateData.description = validated.description;
  if (validated.displayOrder !== undefined) updateData.displayOrder = validated.displayOrder;
  if (validated.active !== undefined) updateData.active = validated.active;

  const [updated] = await dbInstance
    .update(pipelineStages)
    .set(updateData)
    .where(
      and(
        eq(pipelineStages.id, stageId),
        eq(pipelineStages.organizationId, organizationId)
      )
    )
    .returning();

  return updated;
}

/**
 * Archives a stage (soft delete).
 */
export async function archiveStage(
  organizationId: string,
  stageId: string,
  dbInstance: DbClient = db as DbClient
): Promise<PipelineStage> {
  await getStageById(organizationId, stageId, dbInstance);

  const [archived] = await dbInstance
    .update(pipelineStages)
    .set({
      archivedAt: new Date(),
      active: false,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(pipelineStages.id, stageId),
        eq(pipelineStages.organizationId, organizationId)
      )
    )
    .returning();

  return archived;
}

/**
 * Reorders stages of a pipeline given an ordered array of stage IDs.
 * Verifies that all stage IDs belong to the requested pipeline & organization.
 */
export async function reorderStages(
  organizationId: string,
  pipelineId: string,
  stageIds: string[],
  dbInstance: DbClient = db as DbClient
): Promise<PipelineStage[]> {
  // 1. Verify pipeline ownership
  await getPipelineById(organizationId, pipelineId, undefined, dbInstance);

  // 2. Validate input schema (checks non-empty, no duplicates)
  reorderStagesSchema.parse({ stageIds });

  // 3. Fetch existing active stages for this pipeline
  const currentStages = await dbInstance
    .select()
    .from(pipelineStages)
    .where(
      and(
        eq(pipelineStages.pipelineId, pipelineId),
        eq(pipelineStages.organizationId, organizationId),
        isNull(pipelineStages.archivedAt)
      )
    );

  const stageMap = new Map(currentStages.map((s) => [s.id, s]));

  // Verify every submitted stage belongs to this pipeline and organization
  for (const id of stageIds) {
    if (!stageMap.has(id)) {
      throw new ValidationError(
        `Stage ${id} does not belong to this pipeline or organization.`
      );
    }
  }

  // 4. Update displayOrder sequentially
  const updatedStages: PipelineStage[] = [];
  for (let index = 0; index < stageIds.length; index++) {
    const stageId = stageIds[index];
    const newOrder = index + 1;
    const [updated] = await dbInstance
      .update(pipelineStages)
      .set({
        displayOrder: newOrder,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(pipelineStages.id, stageId),
          eq(pipelineStages.organizationId, organizationId),
          eq(pipelineStages.pipelineId, pipelineId)
        )
      )
      .returning();

    if (updated) {
      updatedStages.push(updated);
    }
  }

  return updatedStages.sort((a, b) => a.displayOrder - b.displayOrder);
}

/**
 * Move a stage up or down relative to its siblings.
 */
export async function moveStage(
  organizationId: string,
  stageId: string,
  direction: "up" | "down",
  dbInstance: DbClient = db as DbClient
): Promise<PipelineStage[]> {
  const currentStage = await getStageById(organizationId, stageId, dbInstance);
  const allStages = await getPipelineStages(
    organizationId,
    currentStage.pipelineId,
    undefined,
    dbInstance
  );

  const currentIndex = allStages.findIndex((s) => s.id === stageId);
  if (currentIndex === -1) {
    throw new NotFoundError("Stage not found in pipeline.");
  }

  const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
  if (targetIndex < 0 || targetIndex >= allStages.length) {
    // Already at the top or bottom boundary
    return allStages;
  }

  // Swap in array
  const reordered = [...allStages];
  const [removed] = reordered.splice(currentIndex, 1);
  reordered.splice(targetIndex, 0, removed);

  return reorderStages(
    organizationId,
    currentStage.pipelineId,
    reordered.map((s) => s.id),
    dbInstance
  );
}

/**
 * Retrieves all active pipelines and their active stages for an organization.
 * Used for dropdown selections in Lead create/edit and filters.
 */
export async function getActivePipelinesWithStages(
  organizationId: string,
  dbInstance: DbClient = db as DbClient
): Promise<PipelineWithStages[]> {
  const activePipelines = await dbInstance
    .select()
    .from(pipelines)
    .where(
      and(
        eq(pipelines.organizationId, organizationId),
        eq(pipelines.active, true),
        isNull(pipelines.archivedAt)
      )
    )
    .orderBy(asc(pipelines.displayOrder), asc(pipelines.createdAt));

  if (activePipelines.length === 0) {
    return [];
  }

  const activeStages = await dbInstance
    .select()
    .from(pipelineStages)
    .where(
      and(
        eq(pipelineStages.organizationId, organizationId),
        eq(pipelineStages.active, true),
        isNull(pipelineStages.archivedAt)
      )
    )
    .orderBy(asc(pipelineStages.displayOrder), asc(pipelineStages.createdAt));

  const stagesByPipeline = new Map<string, PipelineStage[]>();
  for (const stage of activeStages) {
    if (!stagesByPipeline.has(stage.pipelineId)) {
      stagesByPipeline.set(stage.pipelineId, []);
    }
    stagesByPipeline.get(stage.pipelineId)!.push(stage);
  }

  return activePipelines.map((p) => ({
    ...p,
    stages: stagesByPipeline.get(p.id) || [],
  }));
}
