import { db } from "@/db";
import { DbClient } from "@/db/types";
import { followUps, type FollowUpStatus } from "@/db/schema/follow-ups";
import { leads } from "@/db/schema/leads";
import { deals } from "@/db/schema/deals";
import { users } from "@/db/schema/users";
import { organizationMembers } from "@/db/schema/organizations";
import { eq, and, isNull, asc } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import {
  createFollowUpSchema,
  updateFollowUpSchema,
  type CreateFollowUpInput,
  type UpdateFollowUpInput,
} from "@/lib/validations/follow-up";
import { type FollowUpWithRelations } from "@/lib/types/follow-ups";
import { NotFoundError, ValidationError } from "@/lib/errors";

const assignedUser = alias(users, "assigned_user");
const createdUser = alias(users, "created_user");

/**
 * Creates a new follow-up for a lead after verifying tenant ownership and assignee membership.
 */
export async function createFollowUp(
  organizationId: string,
  currentUserId: string,
  leadId: string,
  input: CreateFollowUpInput,
  dbInstance: DbClient = db as DbClient
): Promise<FollowUpWithRelations> {
  const validated = createFollowUpSchema.parse(input);

  let resolvedLeadId: string | null = null;
  let resolvedDealId: string | null = null;

  if (validated.dealId) {
    const [dealRecord] = await dbInstance
      .select({ id: deals.id, archivedAt: deals.archivedAt })
      .from(deals)
      .where(and(eq(deals.id, validated.dealId), eq(deals.organizationId, organizationId)))
      .limit(1);

    if (!dealRecord) {
      throw new NotFoundError("Deal not found in this organization.");
    }
    if (dealRecord.archivedAt) {
      throw new ValidationError("Cannot create follow-up for an archived deal.");
    }
    resolvedDealId = validated.dealId;
  } else if (validated.leadId) {
    const [leadRecord] = await dbInstance
      .select({ id: leads.id, archivedAt: leads.archivedAt })
      .from(leads)
      .where(and(eq(leads.id, validated.leadId), eq(leads.organizationId, organizationId)))
      .limit(1);

    if (!leadRecord) {
      throw new NotFoundError("Lead not found in this organization.");
    }
    if (leadRecord.archivedAt) {
      throw new ValidationError("Cannot create follow-up for an archived lead.");
    }
    resolvedLeadId = validated.leadId;
  } else {
    // Check if leadOrDealId is a lead first
    const [leadRecord] = await dbInstance
      .select({ id: leads.id, archivedAt: leads.archivedAt })
      .from(leads)
      .where(and(eq(leads.id, leadId), eq(leads.organizationId, organizationId)))
      .limit(1);

    if (leadRecord) {
      if (leadRecord.archivedAt) {
        throw new ValidationError("Cannot create follow-up for an archived lead.");
      }
      resolvedLeadId = leadId;
    } else {
      // Check if it's a deal
      const [dealRecord] = await dbInstance
        .select({ id: deals.id, archivedAt: deals.archivedAt })
        .from(deals)
        .where(and(eq(deals.id, leadId), eq(deals.organizationId, organizationId)))
        .limit(1);

      if (dealRecord) {
        if (dealRecord.archivedAt) {
          throw new ValidationError("Cannot create follow-up for an archived deal.");
        }
        resolvedDealId = leadId;
      } else {
        throw new NotFoundError("Lead not found in this organization.");
      }
    }
  }

  // 2. Validate assignee (if provided, must be in this organization; default to current user)
  let assigneeId = validated.assignedToUserId && validated.assignedToUserId.trim() !== ""
    ? validated.assignedToUserId.trim()
    : currentUserId;

  if (assigneeId) {
    const member = await dbInstance
      .select({ id: organizationMembers.id })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, organizationId),
          eq(organizationMembers.userId, assigneeId)
        )
      )
      .limit(1);

    if (member.length === 0) {
      throw new ValidationError(
        "Assigned user does not belong to this organization."
      );
    }
  } else {
    assigneeId = currentUserId;
  }

  // 3. Insert Follow-up
  const followUpId = crypto.randomUUID();
  const isCompleted = validated.status === "completed";

  await dbInstance.insert(followUps).values({
    id: followUpId,
    organizationId,
    leadId: resolvedLeadId,
    dealId: resolvedDealId,
    assignedToUserId: assigneeId,
    title: validated.title,
    description: validated.description ? validated.description.trim() : null,
    dueDate: validated.dueDate,
    dueTime: validated.dueTime ? validated.dueTime.trim() : null,
    status: validated.status || "pending",
    createdByUserId: currentUserId,
    completedAt: isCompleted ? new Date() : null,
  });

  return getFollowUpById(organizationId, followUpId, dbInstance);
}

/**
 * Retrieves all active (non-archived) follow-ups for a lead, sorted by due date and time.
 */
export async function getLeadFollowUps(
  organizationId: string,
  leadId: string,
  options?: { includeArchived?: boolean },
  dbInstance: DbClient = db as DbClient
): Promise<FollowUpWithRelations[]> {
  // 1. Verify lead belongs to this organization (tenant isolation)
  const [leadRecord] = await dbInstance
    .select({ id: leads.id })
    .from(leads)
    .where(and(eq(leads.id, leadId), eq(leads.organizationId, organizationId)))
    .limit(1);

  if (!leadRecord) {
    throw new NotFoundError("Lead not found in this organization.");
  }

  const conditions = [
    eq(followUps.organizationId, organizationId),
    eq(followUps.leadId, leadId),
  ];

  if (!options?.includeArchived) {
    conditions.push(isNull(followUps.archivedAt));
  }

  const rows = await dbInstance
    .select({
      followUp: followUps,
      assignedUser: {
        id: assignedUser.id,
        name: assignedUser.name,
        email: assignedUser.email,
        image: assignedUser.image,
      },
      createdByUser: {
        id: createdUser.id,
        name: createdUser.name,
        email: createdUser.email,
        image: createdUser.image,
      },
    })
    .from(followUps)
    .leftJoin(assignedUser, eq(followUps.assignedToUserId, assignedUser.id))
    .leftJoin(createdUser, eq(followUps.createdByUserId, createdUser.id))
    .where(and(...conditions))
    .orderBy(
      asc(followUps.dueDate),
      asc(followUps.dueTime),
      asc(followUps.createdAt)
    );

  return rows.map((r) => ({
    ...r.followUp,
    status: r.followUp.status as FollowUpStatus,
    assignedToUser: r.assignedUser?.id ? r.assignedUser : null,
    createdByUser: r.createdByUser || {
      id: r.followUp.createdByUserId,
      name: "Unknown User",
      email: "",
      image: null,
    },
  }));
}

/**
 * Retrieves all active (non-archived) follow-ups for a deal, sorted by due date and time.
 */
export async function getDealFollowUps(
  organizationId: string,
  dealId: string,
  optionsOrDb?: { includeArchived?: boolean } | DbClient,
  dbInstance?: DbClient
): Promise<FollowUpWithRelations[]> {
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

  // 1. Verify deal belongs to this organization (tenant isolation)
  const [dealRecord] = await activeDb
    .select({ id: deals.id })
    .from(deals)
    .where(and(eq(deals.id, dealId), eq(deals.organizationId, organizationId)))
    .limit(1);

  if (!dealRecord) {
    throw new NotFoundError("Deal not found in this organization.");
  }

  const conditions = [
    eq(followUps.organizationId, organizationId),
    eq(followUps.dealId, dealId),
  ];

  if (!options?.includeArchived) {
    conditions.push(isNull(followUps.archivedAt));
  }

  const rows = await activeDb
    .select({
      followUp: followUps,
      assignedUser: {
        id: assignedUser.id,
        name: assignedUser.name,
        email: assignedUser.email,
        image: assignedUser.image,
      },
      createdByUser: {
        id: createdUser.id,
        name: createdUser.name,
        email: createdUser.email,
        image: createdUser.image,
      },
    })
    .from(followUps)
    .leftJoin(assignedUser, eq(followUps.assignedToUserId, assignedUser.id))
    .leftJoin(createdUser, eq(followUps.createdByUserId, createdUser.id))
    .where(and(...conditions))
    .orderBy(
      asc(followUps.dueDate),
      asc(followUps.dueTime),
      asc(followUps.createdAt)
    );

  return rows.map((r) => ({
    ...r.followUp,
    status: r.followUp.status as FollowUpStatus,
    assignedToUser: r.assignedUser?.id ? r.assignedUser : null,
    createdByUser: r.createdByUser || {
      id: r.followUp.createdByUserId,
      name: "Unknown User",
      email: "",
      image: null,
    },
  }));
}

/**
 * Retrieves a single follow-up by ID with tenant isolation check.
 */
export async function getFollowUpById(
  organizationId: string,
  followUpId: string,
  dbInstance: DbClient = db as DbClient
): Promise<FollowUpWithRelations> {
  const [row] = await dbInstance
    .select({
      followUp: followUps,
      assignedUser: {
        id: assignedUser.id,
        name: assignedUser.name,
        email: assignedUser.email,
        image: assignedUser.image,
      },
      createdByUser: {
        id: createdUser.id,
        name: createdUser.name,
        email: createdUser.email,
        image: createdUser.image,
      },
    })
    .from(followUps)
    .leftJoin(assignedUser, eq(followUps.assignedToUserId, assignedUser.id))
    .leftJoin(createdUser, eq(followUps.createdByUserId, createdUser.id))
    .where(
      and(
        eq(followUps.id, followUpId),
        eq(followUps.organizationId, organizationId)
      )
    )
    .limit(1);

  if (!row) {
    throw new NotFoundError("Follow-up not found in this organization.");
  }

  return {
    ...row.followUp,
    status: row.followUp.status as FollowUpStatus,
    assignedToUser: r(row.assignedUser),
    createdByUser: row.createdByUser || {
      id: row.followUp.createdByUserId,
      name: "Unknown User",
      email: "",
      image: null,
    },
  };
}

function r(user: { id: string | null; name: string | null; email: string | null; image: string | null } | null) {
  if (!user || !user.id) return null;
  return {
    id: user.id,
    name: user.name || "Unknown",
    email: user.email || "",
    image: user.image,
  };
}

/**
 * Updates an existing follow-up with tenant isolation and assignee validation.
 */
export async function updateFollowUp(
  organizationId: string,
  followUpId: string,
  input: UpdateFollowUpInput,
  dbInstance: DbClient = db as DbClient
): Promise<FollowUpWithRelations> {
  const existing = await getFollowUpById(organizationId, followUpId, dbInstance);

  const validated = updateFollowUpSchema.parse(input);

  // Validate assignee if changed
  let assignedUserId: string | null | undefined = undefined;
  if (validated.assignedToUserId !== undefined) {
    if (validated.assignedToUserId && validated.assignedToUserId.trim() !== "") {
      const targetUserId = validated.assignedToUserId.trim();
      const member = await dbInstance
        .select({ id: organizationMembers.id })
        .from(organizationMembers)
        .where(
          and(
            eq(organizationMembers.organizationId, organizationId),
            eq(organizationMembers.userId, targetUserId)
          )
        )
        .limit(1);

      if (member.length === 0) {
        throw new ValidationError(
          "Assigned user does not belong to this organization."
        );
      }
      assignedUserId = targetUserId;
    } else {
      assignedUserId = null;
    }
  }

  // Handle completed_at timestamp
  let completedAtUpdate: Date | null | undefined = undefined;
  if (validated.status !== undefined) {
    if (validated.status === "completed") {
      completedAtUpdate = existing.completedAt || new Date();
    } else {
      completedAtUpdate = null;
    }
  }

  await dbInstance
    .update(followUps)
    .set({
      ...(validated.title !== undefined ? { title: validated.title } : {}),
      ...(validated.description !== undefined
        ? { description: validated.description ? validated.description.trim() : null }
        : {}),
      ...(validated.dueDate !== undefined ? { dueDate: validated.dueDate } : {}),
      ...(validated.dueTime !== undefined
        ? { dueTime: validated.dueTime ? validated.dueTime.trim() : null }
        : {}),
      ...(assignedUserId !== undefined ? { assignedToUserId: assignedUserId } : {}),
      ...(validated.status !== undefined ? { status: validated.status } : {}),
      ...(completedAtUpdate !== undefined ? { completedAt: completedAtUpdate } : {}),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(followUps.id, followUpId),
        eq(followUps.organizationId, organizationId)
      )
    );

  return getFollowUpById(organizationId, followUpId, dbInstance);
}

/**
 * Marks a follow-up as completed.
 */
export async function completeFollowUp(
  organizationId: string,
  followUpId: string,
  dbInstance: DbClient = db as DbClient
): Promise<FollowUpWithRelations> {
  return updateFollowUp(
    organizationId,
    followUpId,
    { status: "completed" },
    dbInstance
  );
}

/**
 * Marks a follow-up as cancelled.
 */
export async function cancelFollowUp(
  organizationId: string,
  followUpId: string,
  dbInstance: DbClient = db as DbClient
): Promise<FollowUpWithRelations> {
  return updateFollowUp(
    organizationId,
    followUpId,
    { status: "cancelled" },
    dbInstance
  );
}

/**
 * Soft deletes / archives a follow-up.
 */
export async function archiveFollowUp(
  organizationId: string,
  followUpId: string,
  dbInstance: DbClient = db as DbClient
): Promise<FollowUpWithRelations> {
  await getFollowUpById(organizationId, followUpId, dbInstance);

  await dbInstance
    .update(followUps)
    .set({
      archivedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(followUps.id, followUpId),
        eq(followUps.organizationId, organizationId)
      )
    );

  return getFollowUpById(organizationId, followUpId, dbInstance);
}

export { selectPrimaryNextAction } from "@/lib/utils/follow-up-utils";
