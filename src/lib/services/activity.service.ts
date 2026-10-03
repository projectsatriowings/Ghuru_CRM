import { db } from "@/db";
import { DbClient } from "@/db/types";
import {
  activities,
  type ActivityType,
  type CrmEntityType,
  type ActivityStatus,
  CRM_ENTITY_TYPES,
} from "@/db/schema/activities";
import { leads } from "@/db/schema/leads";
import { contacts } from "@/db/schema/contacts";
import { companies } from "@/db/schema/companies";
import { users } from "@/db/schema/users";
import { organizationMembers } from "@/db/schema/organizations";
import { eq, and, isNull, desc, count, gte, lte } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import {
  createActivitySchema,
  updateActivitySchema,
  activityQuerySchema,
  type CreateActivityInput,
  type UpdateActivityInput,
  type ActivityQueryParams,
} from "@/lib/validations/activity";
import {
  type ActivityWithRelations,
  type PaginatedActivitiesResult,
} from "@/lib/types/activities";
import { NotFoundError, ValidationError } from "@/lib/errors";

const assignedUsers = alias(users, "assigned_user");

/**
 * Validates that an entity (lead, contact, or company) exists in the organization
 * and is not archived.
 */
export async function validateEntityForActivity(
  organizationId: string,
  entityType: CrmEntityType,
  entityId: string,
  dbInstance: DbClient = db as DbClient
) {
  if (!CRM_ENTITY_TYPES.includes(entityType)) {
    throw new ValidationError(`Unsupported entity type: ${entityType}`);
  }

  if (!entityId || entityId.trim() === "") {
    throw new ValidationError("entityId is required.");
  }

  const cleanEntityId = entityId.trim();

  if (entityType === "lead") {
    const [record] = await dbInstance
      .select({ id: leads.id, archivedAt: leads.archivedAt })
      .from(leads)
      .where(and(eq(leads.id, cleanEntityId), eq(leads.organizationId, organizationId)))
      .limit(1);

    if (!record) {
      throw new NotFoundError("Lead not found in this organization.");
    }
    if (record.archivedAt) {
      throw new ValidationError("Cannot create activity for an archived lead.");
    }
    return record;
  }

  if (entityType === "contact") {
    const [record] = await dbInstance
      .select({ id: contacts.id, archivedAt: contacts.archivedAt })
      .from(contacts)
      .where(and(eq(contacts.id, cleanEntityId), eq(contacts.organizationId, organizationId)))
      .limit(1);

    if (!record) {
      throw new NotFoundError("Contact not found in this organization.");
    }
    if (record.archivedAt) {
      throw new ValidationError("Cannot create activity for an archived contact.");
    }
    return record;
  }

  if (entityType === "company") {
    const [record] = await dbInstance
      .select({ id: companies.id, archivedAt: companies.archivedAt })
      .from(companies)
      .where(and(eq(companies.id, cleanEntityId), eq(companies.organizationId, organizationId)))
      .limit(1);

    if (!record) {
      throw new NotFoundError("Company not found in this organization.");
    }
    if (record.archivedAt) {
      throw new ValidationError("Cannot create activity for an archived company.");
    }
    return record;
  }

  throw new ValidationError(`Unsupported entity type: ${entityType}`);
}

export type LegacyCreateActivityInput = {
  type: ActivityType;
  title: string;
  description?: string | null;
  status?: ActivityStatus;
  assignedToUserId?: string | null;
  dueAt?: Date | null;
};

/**
 * Creates an activity for a CRM entity (lead, contact, or company).
 *
 * Supports both:
 * 1. createActivity(orgId, userId, leadId, input, dbInstance) — backwards compatible with Milestone 2.3A
 * 2. createActivity(orgId, userId, input, dbInstance) — unified signature with entityType & entityId
 */
export async function createActivity(
  organizationId: string,
  userId: string,
  input: CreateActivityInput,
  dbInstance?: DbClient
): Promise<ActivityWithRelations>;
export async function createActivity(
  organizationId: string,
  userId: string,
  leadId: string,
  input: LegacyCreateActivityInput | CreateActivityInput,
  dbInstance?: DbClient
): Promise<ActivityWithRelations>;
export async function createActivity(
  organizationId: string,
  userId: string,
  leadIdOrInput: string | CreateActivityInput,
  maybeInputOrDb?: LegacyCreateActivityInput | CreateActivityInput | DbClient,
  maybeDb?: DbClient
): Promise<ActivityWithRelations> {
  let resolvedEntityType: CrmEntityType = "lead";
  let resolvedEntityId: string;
  let rawInput: CreateActivityInput;
  let dbInstance: DbClient;

  if (typeof leadIdOrInput === "string") {
    // Legacy signature: (orgId, userId, leadId, input, dbInstance)
    resolvedEntityType = "lead";
    resolvedEntityId = leadIdOrInput;
    rawInput = maybeInputOrDb as CreateActivityInput;
    dbInstance = (maybeDb as DbClient) || (db as DbClient);
  } else {
    // Unified signature: (orgId, userId, input, dbInstance)
    resolvedEntityType = leadIdOrInput.entityType || "lead";
    resolvedEntityId = leadIdOrInput.entityId || "";
    rawInput = leadIdOrInput;
    dbInstance = (maybeInputOrDb as DbClient) || (db as DbClient);
  }

  if (!resolvedEntityId) {
    throw new ValidationError("An entity ID is required to create an activity.");
  }

  const validated = createActivitySchema.parse(rawInput);

  // 1. Verify entity exists in this organization and is not archived
  await validateEntityForActivity(
    organizationId,
    resolvedEntityType,
    resolvedEntityId,
    dbInstance
  );

  // 2. Validate assignedToUserId if provided
  if (validated.assignedToUserId) {
    const [member] = await dbInstance
      .select({ id: organizationMembers.id })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, organizationId),
          eq(organizationMembers.userId, validated.assignedToUserId)
        )
      )
      .limit(1);

    if (!member) {
      throw new ValidationError("Assigned user does not belong to this organization.");
    }
  }

  const activityId = crypto.randomUUID();
  const now = new Date();
  const status: ActivityStatus = validated.status || "completed";
  const completedAt = status === "completed" ? now : null;

  await dbInstance.insert(activities).values({
    id: activityId,
    organizationId,
    entityType: resolvedEntityType,
    entityId: resolvedEntityId,
    leadId: resolvedEntityType === "lead" ? resolvedEntityId : null,
    type: validated.type,
    title: validated.title,
    description: validated.description ?? null,
    status,
    assignedToUserId: validated.assignedToUserId ?? null,
    createdByUserId: userId,
    dueAt: validated.dueAt ?? null,
    completedAt,
    createdAt: now,
    updatedAt: now,
  });

  return getActivityById(organizationId, activityId, dbInstance);
}

/**
 * Retrieves a single activity by ID with tenant isolation verification.
 */
export async function getActivityById(
  organizationId: string,
  activityId: string,
  dbInstance: DbClient = db as DbClient
): Promise<ActivityWithRelations> {
  const [row] = await dbInstance
    .select({
      activity: activities,
      createdByUser: {
        id: users.id,
        name: users.name,
        email: users.email,
        image: users.image,
      },
      assignedToUser: {
        id: assignedUsers.id,
        name: assignedUsers.name,
        email: assignedUsers.email,
        image: assignedUsers.image,
      },
    })
    .from(activities)
    .leftJoin(users, eq(activities.createdByUserId, users.id))
    .leftJoin(assignedUsers, eq(activities.assignedToUserId, assignedUsers.id))
    .where(
      and(
        eq(activities.id, activityId),
        eq(activities.organizationId, organizationId)
      )
    )
    .limit(1);

  if (!row) {
    throw new NotFoundError("Activity not found in this organization.");
  }

  return {
    ...row.activity,
    entityType: row.activity.entityType as CrmEntityType,
    status: row.activity.status as ActivityStatus,
    type: row.activity.type as ActivityType,
    createdByUser: row.createdByUser || {
      id: row.activity.createdByUserId,
      name: "Unknown User",
      email: "",
      image: null,
    },
    assignedToUser: row.assignedToUser?.id ? row.assignedToUser : null,
  };
}

/**
 * Retrieves chronological activity history for a specific CRM entity (lead, contact, or company).
 * Default ordering: newest first.
 * Supports pagination and filters.
 */
export async function getActivitiesForEntity(
  organizationId: string,
  entityType: CrmEntityType,
  entityId: string,
  options: Partial<ActivityQueryParams> = {},
  dbInstance: DbClient = db as DbClient
): Promise<PaginatedActivitiesResult> {
  // 1. Verify entity exists in this organization
  await validateEntityForActivity(organizationId, entityType, entityId, dbInstance);

  const parsed = activityQuerySchema.parse({
    entityType,
    entityId,
    ...options,
  });

  const conditions = [
    eq(activities.organizationId, organizationId),
    eq(activities.entityType, entityType),
    eq(activities.entityId, entityId),
  ];

  if (!parsed.includeArchived) {
    conditions.push(isNull(activities.archivedAt));
  }

  if (parsed.activityType) {
    conditions.push(eq(activities.type, parsed.activityType));
  }

  if (parsed.status) {
    conditions.push(eq(activities.status, parsed.status));
  }

  if (parsed.assignedTo) {
    conditions.push(eq(activities.assignedToUserId, parsed.assignedTo));
  }

  if (parsed.dateFrom) {
    conditions.push(gte(activities.createdAt, parsed.dateFrom));
  }

  if (parsed.dateTo) {
    conditions.push(lte(activities.createdAt, parsed.dateTo));
  }

  const whereClause = and(...conditions);

  // Total count
  const [{ totalCount }] = await dbInstance
    .select({ totalCount: count() })
    .from(activities)
    .where(whereClause);

  const total = Number(totalCount);
  const totalPages = Math.ceil(total / parsed.pageSize) || 1;
  const offset = (parsed.page - 1) * parsed.pageSize;

  const rows = await dbInstance
    .select({
      activity: activities,
      createdByUser: {
        id: users.id,
        name: users.name,
        email: users.email,
        image: users.image,
      },
      assignedToUser: {
        id: assignedUsers.id,
        name: assignedUsers.name,
        email: assignedUsers.email,
        image: assignedUsers.image,
      },
    })
    .from(activities)
    .leftJoin(users, eq(activities.createdByUserId, users.id))
    .leftJoin(assignedUsers, eq(activities.assignedToUserId, assignedUsers.id))
    .where(whereClause)
    .orderBy(desc(activities.createdAt))
    .limit(parsed.pageSize)
    .offset(offset);

  const data: ActivityWithRelations[] = rows.map((r) => ({
    ...r.activity,
    entityType: r.activity.entityType as CrmEntityType,
    status: r.activity.status as ActivityStatus,
    type: r.activity.type as ActivityType,
    createdByUser: r.createdByUser || {
      id: r.activity.createdByUserId,
      name: "Unknown User",
      email: "",
      image: null,
    },
    assignedToUser: r.assignedToUser?.id ? r.assignedToUser : null,
  }));

  return {
    data,
    pagination: {
      page: parsed.page,
      pageSize: parsed.pageSize,
      total,
      totalPages,
    },
  };
}

/**
 * Retrieves activities for the organization with generic filters and pagination.
 */
export async function getActivities(
  organizationId: string,
  params: Partial<ActivityQueryParams> = {},
  dbInstance: DbClient = db as DbClient
): Promise<PaginatedActivitiesResult> {
  const parsed = activityQuerySchema.parse(params);

  const conditions = [eq(activities.organizationId, organizationId)];

  if (!parsed.includeArchived) {
    conditions.push(isNull(activities.archivedAt));
  }

  if (parsed.entityType) {
    conditions.push(eq(activities.entityType, parsed.entityType));
  }

  if (parsed.entityId) {
    conditions.push(eq(activities.entityId, parsed.entityId));
  }

  if (parsed.activityType) {
    conditions.push(eq(activities.type, parsed.activityType));
  }

  if (parsed.status) {
    conditions.push(eq(activities.status, parsed.status));
  }

  if (parsed.assignedTo) {
    conditions.push(eq(activities.assignedToUserId, parsed.assignedTo));
  }

  if (parsed.dateFrom) {
    conditions.push(gte(activities.createdAt, parsed.dateFrom));
  }

  if (parsed.dateTo) {
    conditions.push(lte(activities.createdAt, parsed.dateTo));
  }

  const whereClause = and(...conditions);

  const [{ totalCount }] = await dbInstance
    .select({ totalCount: count() })
    .from(activities)
    .where(whereClause);

  const total = Number(totalCount);
  const totalPages = Math.ceil(total / parsed.pageSize) || 1;
  const offset = (parsed.page - 1) * parsed.pageSize;

  const rows = await dbInstance
    .select({
      activity: activities,
      createdByUser: {
        id: users.id,
        name: users.name,
        email: users.email,
        image: users.image,
      },
      assignedToUser: {
        id: assignedUsers.id,
        name: assignedUsers.name,
        email: assignedUsers.email,
        image: assignedUsers.image,
      },
    })
    .from(activities)
    .leftJoin(users, eq(activities.createdByUserId, users.id))
    .leftJoin(assignedUsers, eq(activities.assignedToUserId, assignedUsers.id))
    .where(whereClause)
    .orderBy(desc(activities.createdAt))
    .limit(parsed.pageSize)
    .offset(offset);

  const data: ActivityWithRelations[] = rows.map((r) => ({
    ...r.activity,
    entityType: r.activity.entityType as CrmEntityType,
    status: r.activity.status as ActivityStatus,
    type: r.activity.type as ActivityType,
    createdByUser: r.createdByUser || {
      id: r.activity.createdByUserId,
      name: "Unknown User",
      email: "",
      image: null,
    },
    assignedToUser: r.assignedToUser?.id ? r.assignedToUser : null,
  }));

  return {
    data,
    pagination: {
      page: parsed.page,
      pageSize: parsed.pageSize,
      total,
      totalPages,
    },
  };
}

/**
 * Backwards compatible helper: retrieves all activities for a lead (newest first).
 */
export async function getLeadActivities(
  organizationId: string,
  leadId: string,
  optionsOrDb?: { includeArchived?: boolean } | DbClient,
  dbInstance?: DbClient
): Promise<ActivityWithRelations[]> {
  let options: { includeArchived?: boolean } | undefined;
  let activeDb: DbClient = db as DbClient;

  if (optionsOrDb && typeof (optionsOrDb as unknown as Record<string, unknown>).select === "function") {
    activeDb = optionsOrDb as DbClient;
  } else {
    options = optionsOrDb as { includeArchived?: boolean } | undefined;
    if (dbInstance) {
      activeDb = dbInstance;
    }
  }

  const result = await getActivitiesForEntity(
    organizationId,
    "lead",
    leadId,
    { includeArchived: options?.includeArchived, pageSize: 1000 },
    activeDb
  );
  return result.data;
}

/**
 * Updates an activity after verifying tenant ownership.
 */
export async function updateActivity(
  organizationId: string,
  activityId: string,
  input: UpdateActivityInput,
  dbInstance: DbClient = db as DbClient
): Promise<ActivityWithRelations> {
  const existing = await getActivityById(organizationId, activityId, dbInstance);

  const validated = updateActivitySchema.parse(input);

  if (validated.assignedToUserId) {
    const [member] = await dbInstance
      .select({ id: organizationMembers.id })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, organizationId),
          eq(organizationMembers.userId, validated.assignedToUserId)
        )
      )
      .limit(1);

    if (!member) {
      throw new ValidationError("Assigned user does not belong to this organization.");
    }
  }

  const updates: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (validated.type !== undefined) updates.type = validated.type;
  if (validated.title !== undefined) updates.title = validated.title;
  if (validated.description !== undefined) updates.description = validated.description;
  if (validated.assignedToUserId !== undefined) {
    updates.assignedToUserId = validated.assignedToUserId;
  }
  if (validated.dueAt !== undefined) updates.dueAt = validated.dueAt;

  if (validated.status !== undefined) {
    updates.status = validated.status;
    if (validated.status === "completed" && existing.status !== "completed") {
      updates.completedAt = new Date();
    } else if (validated.status !== "completed") {
      updates.completedAt = null;
    }
  }

  if (validated.completedAt !== undefined) {
    updates.completedAt = validated.completedAt;
  }

  await dbInstance
    .update(activities)
    .set(updates)
    .where(
      and(
        eq(activities.id, activityId),
        eq(activities.organizationId, organizationId)
      )
    );

  return getActivityById(organizationId, activityId, dbInstance);
}

/**
 * Completes an activity, marking status as 'completed' and recording completion timestamp.
 */
export async function completeActivity(
  organizationId: string,
  activityId: string,
  dbInstance: DbClient = db as DbClient
): Promise<ActivityWithRelations> {
  await getActivityById(organizationId, activityId, dbInstance);

  const now = new Date();
  await dbInstance
    .update(activities)
    .set({
      status: "completed",
      completedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(activities.id, activityId),
        eq(activities.organizationId, organizationId)
      )
    );

  return getActivityById(organizationId, activityId, dbInstance);
}

/**
 * Cancels an activity, marking status as 'cancelled'.
 */
export async function cancelActivity(
  organizationId: string,
  activityId: string,
  dbInstance: DbClient = db as DbClient
): Promise<ActivityWithRelations> {
  await getActivityById(organizationId, activityId, dbInstance);

  const now = new Date();
  await dbInstance
    .update(activities)
    .set({
      status: "cancelled",
      updatedAt: now,
    })
    .where(
      and(
        eq(activities.id, activityId),
        eq(activities.organizationId, organizationId)
      )
    );

  return getActivityById(organizationId, activityId, dbInstance);
}

/**
 * Soft deletes / archives an activity by setting archivedAt.
 */
export async function archiveActivity(
  organizationId: string,
  activityId: string,
  dbInstance: DbClient = db as DbClient
): Promise<ActivityWithRelations> {
  await getActivityById(organizationId, activityId, dbInstance);

  const now = new Date();
  await dbInstance
    .update(activities)
    .set({
      archivedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(activities.id, activityId),
        eq(activities.organizationId, organizationId)
      )
    );

  return getActivityById(organizationId, activityId, dbInstance);
}
