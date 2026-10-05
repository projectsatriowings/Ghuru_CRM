import { db } from "@/db";
import { DbClient } from "@/db/types";
import { automations, automationExecutions } from "@/db/schema/automations";
import { users } from "@/db/schema/users";
import { organizationMembers } from "@/db/schema/organizations";
import {
  eq,
  and,
  or,
  ilike,
  isNull,
  isNotNull,
  asc,
  desc,
  count,
} from "drizzle-orm";
import {
  createAutomationSchema,
  updateAutomationSchema,
  automationQuerySchema,
  automationExecutionQuerySchema,
  type CreateAutomationInput,
  type UpdateAutomationInput,
} from "@/lib/validations/automation";
import {
  type AutomationWithRelations,
  type PaginatedAutomationsResult,
  type AutomationExecutionWithRelations,
  type PaginatedExecutionsResult,
  type AutomationEntityType,
  type AutomationTriggerType,
  type AutomationExecutionStatus,
} from "@/lib/types/automations";
import { isTriggerSupportedForEntity } from "@/lib/automation/trigger-registry";
import { validateDealPipelineAndStage } from "@/lib/services/deal.service";
import { NotFoundError, ValidationError } from "@/lib/errors";

/**
 * Validates cross-entity references inside action parameters (users, pipelines, stages).
 */
async function validateActionReferences(
  organizationId: string,
  actions: CreateAutomationInput["actions"],
  dbInstance: DbClient
) {
  for (const action of actions) {
    if (action.type === "assign_owner") {
      const targetUserId = String(action.params.targetUserId || "").trim();
      if (targetUserId) {
        const [member] = await dbInstance
          .select({ id: organizationMembers.id })
          .from(organizationMembers)
          .where(
            and(
              eq(organizationMembers.organizationId, organizationId),
              eq(organizationMembers.userId, targetUserId)
            )
          )
          .limit(1);
        if (!member) {
          throw new ValidationError(
            "Assigned target user does not belong to this organization."
          );
        }
      }
    } else if (
      action.type === "create_activity" ||
      action.type === "create_follow_up"
    ) {
      const assigned = String(action.params.assignedToUserId || "").trim();
      if (assigned && assigned !== "current_owner") {
        const [member] = await dbInstance
          .select({ id: organizationMembers.id })
          .from(organizationMembers)
          .where(
            and(
              eq(organizationMembers.organizationId, organizationId),
              eq(organizationMembers.userId, assigned)
            )
          )
          .limit(1);
        if (!member) {
          throw new ValidationError(
            "Assigned user does not belong to this organization."
          );
        }
      }
    } else if (action.type === "move_pipeline_stage") {
      const pId = String(action.params.pipelineId || "").trim();
      const sId = String(action.params.stageId || "").trim();
      if (pId && sId) {
        await validateDealPipelineAndStage(organizationId, pId, sId, dbInstance);
      }
    }
  }
}

/**
 * Creates a new Automation definition.
 */
export async function createAutomation(
  organizationId: string,
  input: CreateAutomationInput,
  dbInstance: DbClient = db as DbClient,
  creatorUserId?: string
): Promise<AutomationWithRelations> {
  const validated = createAutomationSchema.parse(input);

  // Validate trigger compatibility with entity
  if (!isTriggerSupportedForEntity(validated.entityType, validated.triggerType)) {
    throw new ValidationError(
      `Trigger '${validated.triggerType}' is not supported for entity type '${validated.entityType}'.`
    );
  }

  // Validate referenced entity IDs in actions belong to the same organization
  await validateActionReferences(organizationId, validated.actions, dbInstance);

  const automationId = crypto.randomUUID();

  await dbInstance.insert(automations).values({
    id: automationId,
    organizationId,
    name: validated.name.trim(),
    description: validated.description ? validated.description.trim() : null,
    active: validated.active !== undefined ? validated.active : true,
    entityType: validated.entityType,
    triggerType: validated.triggerType,
    conditions: validated.conditions || [],
    actions: validated.actions || [],
    createdByUserId: creatorUserId || null,
  });

  return getAutomationById(organizationId, automationId, dbInstance);
}

/**
 * Retrieves a single automation by ID scoped by organizationId.
 */
export async function getAutomationById(
  organizationId: string,
  automationId: string,
  dbInstance: DbClient = db as DbClient
): Promise<AutomationWithRelations> {
  const [row] = await dbInstance
    .select({
      automation: automations,
      createdByUser: {
        id: users.id,
        name: users.name,
        email: users.email,
        image: users.image,
      },
    })
    .from(automations)
    .leftJoin(users, eq(automations.createdByUserId, users.id))
    .where(
      and(
        eq(automations.id, automationId),
        eq(automations.organizationId, organizationId)
      )
    )
    .limit(1);

  if (!row) {
    throw new NotFoundError("Automation not found in this organization.");
  }

  // Fetch execution stats for this automation
  const [stats] = await dbInstance
    .select({
      total: count(),
    })
    .from(automationExecutions)
    .where(
      and(
        eq(automationExecutions.automationId, automationId),
        eq(automationExecutions.organizationId, organizationId)
      )
    );

  const [lastExec] = await dbInstance
    .select({
      startedAt: automationExecutions.startedAt,
      status: automationExecutions.status,
    })
    .from(automationExecutions)
    .where(
      and(
        eq(automationExecutions.automationId, automationId),
        eq(automationExecutions.organizationId, organizationId)
      )
    )
    .orderBy(desc(automationExecutions.startedAt))
    .limit(1);

  return {
    ...row.automation,
    entityType: row.automation.entityType as AutomationEntityType,
    triggerType: row.automation.triggerType as AutomationTriggerType,
    createdByUser: row.createdByUser?.id ? row.createdByUser : null,
    executionStats: {
      total: Number(stats?.total || 0),
      lastExecutedAt: lastExec?.startedAt || null,
      lastStatus: (lastExec?.status as AutomationExecutionStatus) || null,
    },
  };
}

/**
 * Retrieves paginated list of automations for an organization with filters.
 */
export async function getAutomations(
  organizationId: string,
  query: Record<string, unknown> = {},
  dbInstance: DbClient = db as DbClient
): Promise<PaginatedAutomationsResult> {
  const validated = automationQuerySchema.parse(query);

  const conditions = [eq(automations.organizationId, organizationId)];

  // Archive & active status filter
  if (validated.status === "archived") {
    conditions.push(isNotNull(automations.archivedAt));
  } else if (validated.status === "active") {
    conditions.push(isNull(automations.archivedAt));
    conditions.push(eq(automations.active, true));
  } else if (validated.status === "inactive") {
    conditions.push(isNull(automations.archivedAt));
    conditions.push(eq(automations.active, false));
  } else if (validated.status === "all") {
    // Show all including archived
  } else {
    // Default: non-archived
    conditions.push(isNull(automations.archivedAt));
  }

  // Entity filter
  if (validated.entityType && validated.entityType !== "all") {
    conditions.push(eq(automations.entityType, validated.entityType));
  }

  // Trigger filter
  if (validated.triggerType && validated.triggerType !== "all") {
    conditions.push(eq(automations.triggerType, validated.triggerType));
  }

  // Search filter (name, description)
  if (validated.search && validated.search.trim() !== "") {
    const term = `%${validated.search.trim()}%`;
    conditions.push(
      or(ilike(automations.name, term), ilike(automations.description, term))!
    );
  }

  const whereClause = and(...conditions);

  // Total count
  const [{ totalCount }] = await dbInstance
    .select({ totalCount: count() })
    .from(automations)
    .where(whereClause);

  const total = Number(totalCount);
  const totalPages = Math.ceil(total / validated.pageSize) || 1;
  const offset = (validated.page - 1) * validated.pageSize;

  // Sorting
  let orderByClause;
  const dir = validated.sortDirection === "asc" ? asc : desc;
  switch (validated.sort) {
    case "name":
      orderByClause = dir(automations.name);
      break;
    case "entityType":
      orderByClause = dir(automations.entityType);
      break;
    case "triggerType":
      orderByClause = dir(automations.triggerType);
      break;
    case "updatedAt":
      orderByClause = dir(automations.updatedAt);
      break;
    case "createdAt":
    default:
      orderByClause = dir(automations.createdAt);
      break;
  }

  const rows = await dbInstance
    .select({
      automation: automations,
      createdByUser: {
        id: users.id,
        name: users.name,
        email: users.email,
        image: users.image,
      },
    })
    .from(automations)
    .leftJoin(users, eq(automations.createdByUserId, users.id))
    .where(whereClause)
    .orderBy(orderByClause)
    .limit(validated.pageSize)
    .offset(offset);

  const data: AutomationWithRelations[] = rows.map((r) => ({
    ...r.automation,
    entityType: r.automation.entityType as AutomationEntityType,
    triggerType: r.automation.triggerType as AutomationTriggerType,
    createdByUser: r.createdByUser?.id ? r.createdByUser : null,
  }));

  return {
    data,
    pagination: {
      page: validated.page,
      pageSize: validated.pageSize,
      total,
      totalPages,
    },
  };
}

/**
 * Updates an existing automation definition.
 */
export async function updateAutomation(
  organizationId: string,
  automationId: string,
  input: UpdateAutomationInput,
  dbInstance: DbClient = db as DbClient
): Promise<AutomationWithRelations> {
  const existing = await getAutomationById(organizationId, automationId, dbInstance);

  const validated = updateAutomationSchema.parse(input);

  const resolvedEntityType = validated.entityType || existing.entityType;
  const resolvedTriggerType = validated.triggerType || existing.triggerType;

  if (
    !isTriggerSupportedForEntity(resolvedEntityType, resolvedTriggerType)
  ) {
    throw new ValidationError(
      `Trigger '${resolvedTriggerType}' is not supported for entity type '${resolvedEntityType}'.`
    );
  }

  if (validated.actions) {
    await validateActionReferences(organizationId, validated.actions, dbInstance);
  }

  await dbInstance
    .update(automations)
    .set({
      ...(validated.name !== undefined ? { name: validated.name.trim() } : {}),
      ...(validated.description !== undefined
        ? {
            description: validated.description
              ? validated.description.trim()
              : null,
          }
        : {}),
      ...(validated.active !== undefined ? { active: validated.active } : {}),
      ...(validated.entityType !== undefined
        ? { entityType: validated.entityType }
        : {}),
      ...(validated.triggerType !== undefined
        ? { triggerType: validated.triggerType }
        : {}),
      ...(validated.conditions !== undefined
        ? { conditions: validated.conditions }
        : {}),
      ...(validated.actions !== undefined ? { actions: validated.actions } : {}),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(automations.id, automationId),
        eq(automations.organizationId, organizationId)
      )
    );

  return getAutomationById(organizationId, automationId, dbInstance);
}

/**
 * Archives an automation (soft-delete).
 */
export async function archiveAutomation(
  organizationId: string,
  automationId: string,
  dbInstance: DbClient = db as DbClient
): Promise<AutomationWithRelations> {
  await getAutomationById(organizationId, automationId, dbInstance);

  await dbInstance
    .update(automations)
    .set({
      archivedAt: new Date(),
      active: false,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(automations.id, automationId),
        eq(automations.organizationId, organizationId)
      )
    );

  return getAutomationById(organizationId, automationId, dbInstance);
}

/**
 * Restores an archived automation.
 */
export async function restoreAutomation(
  organizationId: string,
  automationId: string,
  dbInstance: DbClient = db as DbClient
): Promise<AutomationWithRelations> {
  const [existing] = await dbInstance
    .select()
    .from(automations)
    .where(
      and(
        eq(automations.id, automationId),
        eq(automations.organizationId, organizationId)
      )
    )
    .limit(1);

  if (!existing) {
    throw new NotFoundError("Automation not found in this organization.");
  }

  await dbInstance
    .update(automations)
    .set({
      archivedAt: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(automations.id, automationId),
        eq(automations.organizationId, organizationId)
      )
    );

  return getAutomationById(organizationId, automationId, dbInstance);
}

/**
 * Fetches paginated execution history for an organization and/or specific automation.
 */
export async function getAutomationExecutions(
  organizationId: string,
  query: Record<string, unknown> = {},
  dbInstance: DbClient = db as DbClient
): Promise<PaginatedExecutionsResult> {
  const validated = automationExecutionQuerySchema.parse(query);

  const conditions = [eq(automationExecutions.organizationId, organizationId)];

  if (validated.automationId) {
    conditions.push(
      eq(automationExecutions.automationId, validated.automationId)
    );
  }
  if (validated.entityType) {
    conditions.push(eq(automationExecutions.entityType, validated.entityType));
  }
  if (validated.entityId) {
    conditions.push(eq(automationExecutions.entityId, validated.entityId));
  }
  if (validated.status && validated.status !== "all") {
    conditions.push(eq(automationExecutions.status, validated.status));
  }

  const whereClause = and(...conditions);

  const [{ totalCount }] = await dbInstance
    .select({ totalCount: count() })
    .from(automationExecutions)
    .where(whereClause);

  const total = Number(totalCount);
  const totalPages = Math.ceil(total / validated.pageSize) || 1;
  const offset = (validated.page - 1) * validated.pageSize;

  const rows = await dbInstance
    .select({
      execution: automationExecutions,
      automation: {
        id: automations.id,
        name: automations.name,
        entityType: automations.entityType,
        triggerType: automations.triggerType,
      },
    })
    .from(automationExecutions)
    .leftJoin(automations, eq(automationExecutions.automationId, automations.id))
    .where(whereClause)
    .orderBy(desc(automationExecutions.startedAt))
    .limit(validated.pageSize)
    .offset(offset);

  const data: AutomationExecutionWithRelations[] = rows.map((r) => ({
    ...r.execution,
    status: r.execution.status as AutomationExecutionStatus,
    metadata: (r.execution.metadata as AutomationExecutionWithRelations["metadata"]) || null,
    automation: r.automation?.id ? r.automation : null,
  }));

  return {
    data,
    pagination: {
      page: validated.page,
      pageSize: validated.pageSize,
      total,
      totalPages,
    },
  };
}

/**
 * Gets a single automation execution by ID with organization verification.
 */
export async function getExecutionById(
  organizationId: string,
  executionId: string,
  dbInstance: DbClient = db as DbClient
): Promise<AutomationExecutionWithRelations> {
  const [row] = await dbInstance
    .select({
      execution: automationExecutions,
      automation: {
        id: automations.id,
        name: automations.name,
        entityType: automations.entityType,
        triggerType: automations.triggerType,
      },
    })
    .from(automationExecutions)
    .leftJoin(automations, eq(automationExecutions.automationId, automations.id))
    .where(
      and(
        eq(automationExecutions.id, executionId),
        eq(automationExecutions.organizationId, organizationId)
      )
    )
    .limit(1);

  if (!row) {
    throw new NotFoundError(
      "Automation execution not found in this organization."
    );
  }

  return {
    ...row.execution,
    status: row.execution.status as AutomationExecutionStatus,
    metadata: (row.execution.metadata as AutomationExecutionWithRelations["metadata"]) || null,
    automation: row.automation?.id ? row.automation : null,
  };
}
