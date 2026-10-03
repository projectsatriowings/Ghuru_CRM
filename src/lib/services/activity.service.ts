import { db } from "@/db";
import { DbClient } from "@/db/types";
import { activities, ActivityType } from "@/db/schema/activities";
import { leads } from "@/db/schema/leads";
import { users } from "@/db/schema/users";
import { eq, and, isNull, desc } from "drizzle-orm";
import {
  createActivitySchema,
  updateActivitySchema,
  type CreateActivityInput,
  type UpdateActivityInput,
} from "@/lib/validations/activity";
import { type ActivityWithRelations } from "@/lib/types/activities";
import { NotFoundError } from "@/lib/errors";

/**
 * Creates a new activity for a specific lead after verifying tenant ownership.
 */
export async function createActivity(
  organizationId: string,
  userId: string,
  leadId: string,
  input: CreateActivityInput,
  dbInstance: DbClient = db as DbClient
): Promise<ActivityWithRelations> {
  const validated = createActivitySchema.parse(input);

  // 1. Verify lead belongs to this organization (tenant isolation check)
  const [leadRecord] = await dbInstance
    .select({ id: leads.id })
    .from(leads)
    .where(and(eq(leads.id, leadId), eq(leads.organizationId, organizationId)))
    .limit(1);

  if (!leadRecord) {
    throw new NotFoundError("Lead not found in this organization.");
  }

  // 2. Insert Activity record
  const activityId = crypto.randomUUID();

  await dbInstance.insert(activities).values({
    id: activityId,
    organizationId,
    leadId,
    type: validated.type,
    title: validated.title,
    description: validated.description ?? null,
    createdByUserId: userId,
  });

  return getActivityById(organizationId, activityId, dbInstance);
}

/**
 * Retrieves all activities for a lead (newest first) after verifying tenant ownership.
 */
export async function getLeadActivities(
  organizationId: string,
  leadId: string,
  options?: { includeArchived?: boolean },
  dbInstance: DbClient = db as DbClient
): Promise<ActivityWithRelations[]> {
  // 1. Verify lead belongs to this organization (tenant isolation check)
  const [leadRecord] = await dbInstance
    .select({ id: leads.id })
    .from(leads)
    .where(and(eq(leads.id, leadId), eq(leads.organizationId, organizationId)))
    .limit(1);

  if (!leadRecord) {
    throw new NotFoundError("Lead not found in this organization.");
  }

  const conditions = [
    eq(activities.organizationId, organizationId),
    eq(activities.leadId, leadId),
  ];

  if (!options?.includeArchived) {
    conditions.push(isNull(activities.archivedAt));
  }

  const rows = await dbInstance
    .select({
      activity: activities,
      createdByUser: {
        id: users.id,
        name: users.name,
        email: users.email,
        image: users.image,
      },
    })
    .from(activities)
    .leftJoin(users, eq(activities.createdByUserId, users.id))
    .where(and(...conditions))
    .orderBy(desc(activities.createdAt));

  return rows.map((r) => ({
    ...r.activity,
    type: r.activity.type as ActivityType,
    createdByUser: r.createdByUser || {
      id: r.activity.createdByUserId,
      name: "Unknown User",
      email: "",
      image: null,
    },
  }));
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
    })
    .from(activities)
    .leftJoin(users, eq(activities.createdByUserId, users.id))
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
    type: row.activity.type as ActivityType,
    createdByUser: row.createdByUser || {
      id: row.activity.createdByUserId,
      name: "Unknown User",
      email: "",
      image: null,
    },
  };
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
  // 1. Ensure activity exists in this organization
  await getActivityById(organizationId, activityId, dbInstance);

  const validated = updateActivitySchema.parse(input);

  // 2. Perform update
  await dbInstance
    .update(activities)
    .set({
      ...(validated.type !== undefined ? { type: validated.type } : {}),
      ...(validated.title !== undefined ? { title: validated.title } : {}),
      ...(validated.description !== undefined
        ? { description: validated.description }
        : {}),
      updatedAt: new Date(),
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
  // 1. Ensure activity exists in this organization
  await getActivityById(organizationId, activityId, dbInstance);

  // 2. Perform soft delete
  await dbInstance
    .update(activities)
    .set({
      archivedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(activities.id, activityId),
        eq(activities.organizationId, organizationId)
      )
    );

  return getActivityById(organizationId, activityId, dbInstance);
}
