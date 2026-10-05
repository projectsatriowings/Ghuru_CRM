import { DbClient } from "@/db/types";
import { db } from "@/db";
import {
  AutomationActionConfig,
  AutomationActionType,
  AutomationEntityType,
  AutomationExecutionContext,
} from "@/lib/types/automations";
import { createActivity } from "@/lib/services/activity.service";
import { createFollowUp } from "@/lib/services/follow-up.service";
import { validateDealPipelineAndStage } from "@/lib/services/deal.service";
import { validateLeadPipelineAndStage } from "@/lib/services/lead.service";
import { organizationMembers } from "@/db/schema/organizations";
import { leads } from "@/db/schema/leads";
import { deals } from "@/db/schema/deals";
import { contacts } from "@/db/schema/contacts";
import { companies } from "@/db/schema/companies";
import { activities, type ActivityType } from "@/db/schema/activities";
import { eq, and } from "drizzle-orm";
import { ValidationError, NotFoundError } from "@/lib/errors";

export interface ActionExecutionContext {
  organizationId: string;
  entityType: AutomationEntityType;
  entityId: string;
  actorUserId?: string | null;
  entitySnapshot?: Record<string, unknown>;
  executionContext?: AutomationExecutionContext;
  emitSubsequentEvent?: (
    entityType: AutomationEntityType,
    entityId: string,
    triggerType: string,
    payload: Record<string, unknown>
  ) => Promise<void>;
}

export interface ActionResult {
  success: boolean;
  output?: Record<string, unknown>;
  error?: string;
}

/**
 * Resolves a date string like "today", "+2d", "+7d", or ISO date string into "YYYY-MM-DD".
 */
export function resolveDueDate(dueDateInput?: string | null): string {
  if (!dueDateInput || dueDateInput.toLowerCase() === "today") {
    return new Date().toISOString().split("T")[0];
  }
  const match = dueDateInput.match(/^\+(\d+)d$/i);
  if (match) {
    const days = parseInt(match[1], 10);
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().split("T")[0];
  }
  const parsed = new Date(dueDateInput);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split("T")[0];
  }
  return new Date().toISOString().split("T")[0];
}

/**
 * Validates that an assigned target user belongs to the organization and is active.
 */
export async function validateOrgMember(
  organizationId: string,
  userId: string,
  dbInstance: DbClient
): Promise<string> {
  const [member] = await dbInstance
    .select({ id: organizationMembers.id })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.userId, userId)
      )
    )
    .limit(1);

  if (!member) {
    throw new ValidationError(
      "Referenced user does not belong to this organization."
    );
  }
  return userId;
}

/**
 * Resolves the assignee target. If set to "current_owner", extracts from entity snapshot.
 */
export function resolveAssigneeUserId(
  requestedUserId: unknown,
  entitySnapshot?: Record<string, unknown>
): string | null {
  if (!requestedUserId || typeof requestedUserId !== "string") return null;
  const trimmed = requestedUserId.trim();
  if (trimmed === "current_owner" && entitySnapshot) {
    const ownerId =
      entitySnapshot.ownerUserId || entitySnapshot.assignedToUserId;
    return typeof ownerId === "string" && ownerId ? ownerId : null;
  }
  return trimmed !== "" ? trimmed : null;
}

/**
 * Verifies that the target entity exists in the organization and is not archived.
 */
export async function assertEntityActive(
  organizationId: string,
  entityType: AutomationEntityType,
  entityId: string,
  dbInstance: DbClient
): Promise<void> {
  switch (entityType) {
    case "lead": {
      const [record] = await dbInstance
        .select({ id: leads.id, archivedAt: leads.archivedAt })
        .from(leads)
        .where(
          and(eq(leads.id, entityId), eq(leads.organizationId, organizationId))
        )
        .limit(1);
      if (!record) throw new NotFoundError("Lead not found in this organization.");
      if (record.archivedAt)
        throw new ValidationError("Cannot perform automation on an archived lead.");
      break;
    }
    case "deal": {
      const [record] = await dbInstance
        .select({ id: deals.id, archivedAt: deals.archivedAt })
        .from(deals)
        .where(
          and(eq(deals.id, entityId), eq(deals.organizationId, organizationId))
        )
        .limit(1);
      if (!record) throw new NotFoundError("Deal not found in this organization.");
      if (record.archivedAt)
        throw new ValidationError("Cannot perform automation on an archived deal.");
      break;
    }
    case "contact": {
      const [record] = await dbInstance
        .select({ id: contacts.id, archivedAt: contacts.archivedAt })
        .from(contacts)
        .where(
          and(
            eq(contacts.id, entityId),
            eq(contacts.organizationId, organizationId)
          )
        )
        .limit(1);
      if (!record)
        throw new NotFoundError("Contact not found in this organization.");
      if (record.archivedAt)
        throw new ValidationError(
          "Cannot perform automation on an archived contact."
        );
      break;
    }
    case "company": {
      const [record] = await dbInstance
        .select({ id: companies.id, archivedAt: companies.archivedAt })
        .from(companies)
        .where(
          and(
            eq(companies.id, entityId),
            eq(companies.organizationId, organizationId)
          )
        )
        .limit(1);
      if (!record)
        throw new NotFoundError("Company not found in this organization.");
      if (record.archivedAt)
        throw new ValidationError(
          "Cannot perform automation on an archived company."
        );
      break;
    }
  }
}

/**
 * Resolves an actor user ID to attribute system/automated creations to.
 */
async function resolveActorUserId(
  ctx: ActionExecutionContext,
  dbInstance: DbClient
): Promise<string> {
  if (ctx.actorUserId) return ctx.actorUserId;

  // Try entity owner from snapshot
  const owner =
    ctx.entitySnapshot?.ownerUserId || ctx.entitySnapshot?.assignedToUserId;
  if (typeof owner === "string" && owner) {
    return owner;
  }

  // Fallback to first active org member
  const [member] = await dbInstance
    .select({ userId: organizationMembers.userId })
    .from(organizationMembers)
    .where(eq(organizationMembers.organizationId, ctx.organizationId))
    .limit(1);

  if (member) return member.userId;
  throw new ValidationError("No valid user found to attribute automation action.");
}

// ==========================================
// ACTION IMPLEMENTATIONS
// ==========================================

/**
 * Action: create_activity
 * Reuses existing createActivity service.
 */
export async function executeCreateActivityAction(
  action: AutomationActionConfig,
  ctx: ActionExecutionContext,
  dbInstance: DbClient = db as DbClient
): Promise<ActionResult> {
  await assertEntityActive(
    ctx.organizationId,
    ctx.entityType,
    ctx.entityId,
    dbInstance
  );

  const actorId = await resolveActorUserId(ctx, dbInstance);
  const params = action.params;

  const assignedUserId = resolveAssigneeUserId(
    params.assignedToUserId,
    ctx.entitySnapshot
  );
  if (assignedUserId) {
    await validateOrgMember(ctx.organizationId, assignedUserId, dbInstance);
  }

  const activityType = (params.type as ActivityType) || "note";
  const title = (params.title as string) || "Automated Activity";
  const description =
    params.description !== undefined ? String(params.description) : null;

  const result = await createActivity(
    ctx.organizationId,
    actorId,
    {
      entityType: ctx.entityType,
      entityId: ctx.entityId,
      type: activityType,
      title,
      description,
      assignedToUserId: assignedUserId,
      dueAt: params.dueDate ? new Date(resolveDueDate(String(params.dueDate))) : undefined,
    },
    dbInstance
  );

  return {
    success: true,
    output: {
      activityId: result.id,
      title: result.title,
      type: result.type,
    },
  };
}

/**
 * Action: create_follow_up
 * Reuses existing createFollowUp service.
 */
export async function executeCreateFollowUpAction(
  action: AutomationActionConfig,
  ctx: ActionExecutionContext,
  dbInstance: DbClient = db as DbClient
): Promise<ActionResult> {
  if (ctx.entityType !== "lead" && ctx.entityType !== "deal") {
    throw new ValidationError(
      `create_follow_up action is only supported for lead and deal, not ${ctx.entityType}.`
    );
  }

  await assertEntityActive(
    ctx.organizationId,
    ctx.entityType,
    ctx.entityId,
    dbInstance
  );

  const actorId = await resolveActorUserId(ctx, dbInstance);
  const params = action.params;

  const assignedUserId = resolveAssigneeUserId(
    params.assignedToUserId,
    ctx.entitySnapshot
  );
  if (assignedUserId) {
    await validateOrgMember(ctx.organizationId, assignedUserId, dbInstance);
  }

  const title = (params.title as string) || "Automated Follow-up";
  const dueDate = resolveDueDate(String(params.dueDate || "today"));
  const dueTime = params.dueTime ? String(params.dueTime) : null;
  const description =
    params.description !== undefined ? String(params.description) : null;

  const result = await createFollowUp(
    ctx.organizationId,
    actorId,
    ctx.entityId,
    {
      leadId: ctx.entityType === "lead" ? ctx.entityId : undefined,
      dealId: ctx.entityType === "deal" ? ctx.entityId : undefined,
      title,
      dueDate,
      dueTime,
      description,
      assignedToUserId: assignedUserId,
    },
    dbInstance
  );

  return {
    success: true,
    output: {
      followUpId: result.id,
      title: result.title,
      dueDate: result.dueDate,
    },
  };
}

/**
 * Action: assign_owner
 * Safely assigns the entity to a validated organization user.
 */
export async function executeAssignOwnerAction(
  action: AutomationActionConfig,
  ctx: ActionExecutionContext,
  dbInstance: DbClient = db as DbClient
): Promise<ActionResult> {
  await assertEntityActive(
    ctx.organizationId,
    ctx.entityType,
    ctx.entityId,
    dbInstance
  );

  const targetUserId = String(action.params.targetUserId || "").trim();
  if (!targetUserId) {
    throw new ValidationError("Target user ID is required for assign_owner.");
  }

  await validateOrgMember(ctx.organizationId, targetUserId, dbInstance);

  const actorId = await resolveActorUserId(ctx, dbInstance);

  switch (ctx.entityType) {
    case "lead": {
      await dbInstance
        .update(leads)
        .set({ assignedToUserId: targetUserId, updatedAt: new Date() })
        .where(
          and(eq(leads.id, ctx.entityId), eq(leads.organizationId, ctx.organizationId))
        );

      await dbInstance.insert(activities).values({
        id: crypto.randomUUID(),
        organizationId: ctx.organizationId,
        entityType: "lead",
        entityId: ctx.entityId,
        type: "assignment_change",
        title: "Lead Reassigned (Automation)",
        description: `Lead ownership assigned by automation.`,
        status: "completed",
        createdByUserId: actorId,
      });
      break;
    }
    case "deal": {
      await dbInstance
        .update(deals)
        .set({ ownerUserId: targetUserId, updatedAt: new Date() })
        .where(
          and(eq(deals.id, ctx.entityId), eq(deals.organizationId, ctx.organizationId))
        );

      await dbInstance.insert(activities).values({
        id: crypto.randomUUID(),
        organizationId: ctx.organizationId,
        entityType: "deal",
        entityId: ctx.entityId,
        type: "assignment_change",
        title: "Deal Reassigned (Automation)",
        description: `Deal ownership assigned by automation.`,
        status: "completed",
        createdByUserId: actorId,
      });
      break;
    }
    case "contact": {
      await dbInstance
        .update(contacts)
        .set({ ownerUserId: targetUserId, updatedAt: new Date() })
        .where(
          and(
            eq(contacts.id, ctx.entityId),
            eq(contacts.organizationId, ctx.organizationId)
          )
        );
      break;
    }
    case "company": {
      await dbInstance
        .update(companies)
        .set({ ownerUserId: targetUserId, updatedAt: new Date() })
        .where(
          and(
            eq(companies.id, ctx.entityId),
            eq(companies.organizationId, ctx.organizationId)
          )
        );
      break;
    }
  }

  if (ctx.emitSubsequentEvent) {
    await ctx.emitSubsequentEvent(
      ctx.entityType,
      ctx.entityId,
      "entity_assigned",
      { assignedToUserId: targetUserId, ownerUserId: targetUserId }
    );
  }

  return {
    success: true,
    output: {
      assignedUserId: targetUserId,
    },
  };
}

/**
 * Action: update_field
 * Controlled allowlisted field updates.
 */
export async function executeUpdateFieldAction(
  action: AutomationActionConfig,
  ctx: ActionExecutionContext,
  dbInstance: DbClient = db as DbClient
): Promise<ActionResult> {
  await assertEntityActive(
    ctx.organizationId,
    ctx.entityType,
    ctx.entityId,
    dbInstance
  );

  const field = String(action.params.field || "").trim();
  const value = action.params.value;

  if (!field) {
    throw new ValidationError("Field name is required for update_field action.");
  }

  const actorId = await resolveActorUserId(ctx, dbInstance);

  switch (ctx.entityType) {
    case "lead": {
      if (field === "status") {
        const validStatuses = [
          "new",
          "contacted",
          "qualified",
          "unqualified",
          "converted",
        ];
        const statusVal = String(value).toLowerCase();
        if (!validStatuses.includes(statusVal)) {
          throw new ValidationError(
            `Invalid lead status: ${value}. Allowed: ${validStatuses.join(", ")}`
          );
        }

        await dbInstance
          .update(leads)
          .set({ status: statusVal, updatedAt: new Date() })
          .where(
            and(
              eq(leads.id, ctx.entityId),
              eq(leads.organizationId, ctx.organizationId)
            )
          );

        await dbInstance.insert(activities).values({
          id: crypto.randomUUID(),
          organizationId: ctx.organizationId,
          entityType: "lead",
          entityId: ctx.entityId,
          type: "status_change",
          title: "Lead Status Updated (Automation)",
          description: `Status changed to ${statusVal} via automation.`,
          status: "completed",
          createdByUserId: actorId,
        });

        if (ctx.emitSubsequentEvent) {
          await ctx.emitSubsequentEvent(
            "lead",
            ctx.entityId,
            "entity_status_changed",
            { status: statusVal }
          );
        }
      } else {
        throw new ValidationError(
          `Field '${field}' is not allowed for update on entity 'lead'.`
        );
      }
      break;
    }

    case "deal": {
      if (field === "status") {
        const validStatuses = ["open", "won", "lost"];
        const statusVal = String(value).toLowerCase();
        if (!validStatuses.includes(statusVal)) {
          throw new ValidationError(
            `Invalid deal status: ${value}. Allowed: ${validStatuses.join(", ")}`
          );
        }

        await dbInstance
          .update(deals)
          .set({ status: statusVal, updatedAt: new Date() })
          .where(
            and(
              eq(deals.id, ctx.entityId),
              eq(deals.organizationId, ctx.organizationId)
            )
          );

        await dbInstance.insert(activities).values({
          id: crypto.randomUUID(),
          organizationId: ctx.organizationId,
          entityType: "deal",
          entityId: ctx.entityId,
          type: "status_change",
          title: "Deal Status Updated (Automation)",
          description: `Status changed to ${statusVal.toUpperCase()} via automation.`,
          status: "completed",
          createdByUserId: actorId,
        });

        if (ctx.emitSubsequentEvent) {
          await ctx.emitSubsequentEvent(
            "deal",
            ctx.entityId,
            "entity_status_changed",
            { status: statusVal }
          );
        }
      } else if (field === "probability") {
        const numVal = Number(value);
        if (isNaN(numVal) || numVal < 0 || numVal > 100) {
          throw new ValidationError(
            `Probability must be an integer between 0 and 100.`
          );
        }

        await dbInstance
          .update(deals)
          .set({ probability: Math.round(numVal), updatedAt: new Date() })
          .where(
            and(
              eq(deals.id, ctx.entityId),
              eq(deals.organizationId, ctx.organizationId)
            )
          );
      } else if (field === "expectedCloseDate") {
        const dateVal = value ? new Date(value as string | number | Date) : null;
        if (dateVal && isNaN(dateVal.getTime())) {
          throw new ValidationError("Invalid date for expectedCloseDate.");
        }

        await dbInstance
          .update(deals)
          .set({ expectedCloseDate: dateVal, updatedAt: new Date() })
          .where(
            and(
              eq(deals.id, ctx.entityId),
              eq(deals.organizationId, ctx.organizationId)
            )
          );
      } else {
        throw new ValidationError(
          `Field '${field}' is not allowed for update on entity 'deal'.`
        );
      }
      break;
    }

    case "contact": {
      if (field === "notes") {
        await dbInstance
          .update(contacts)
          .set({ notes: String(value), updatedAt: new Date() })
          .where(
            and(
              eq(contacts.id, ctx.entityId),
              eq(contacts.organizationId, ctx.organizationId)
            )
          );
      } else {
        throw new ValidationError(
          `Field '${field}' is not allowed for update on entity 'contact'.`
        );
      }
      break;
    }

    case "company": {
      if (field === "industry" || field === "companySize") {
        await dbInstance
          .update(companies)
          .set({ [field]: String(value), updatedAt: new Date() })
          .where(
            and(
              eq(companies.id, ctx.entityId),
              eq(companies.organizationId, ctx.organizationId)
            )
          );
      } else {
        throw new ValidationError(
          `Field '${field}' is not allowed for update on entity 'company'.`
        );
      }
      break;
    }
  }

  return {
    success: true,
    output: {
      field,
      value,
    },
  };
}

/**
 * Action: move_pipeline_stage
 * Moves a lead or deal to a validated pipeline stage.
 */
export async function executeMovePipelineStageAction(
  action: AutomationActionConfig,
  ctx: ActionExecutionContext,
  dbInstance: DbClient = db as DbClient
): Promise<ActionResult> {
  if (ctx.entityType !== "lead" && ctx.entityType !== "deal") {
    throw new ValidationError(
      `move_pipeline_stage action is only supported for lead and deal, not ${ctx.entityType}.`
    );
  }

  await assertEntityActive(
    ctx.organizationId,
    ctx.entityType,
    ctx.entityId,
    dbInstance
  );

  const pipelineId = String(action.params.pipelineId || "").trim();
  const stageId = String(action.params.stageId || "").trim();

  if (!pipelineId || !stageId) {
    throw new ValidationError(
      "Both pipelineId and stageId are required to move pipeline stage."
    );
  }

  const actorId = await resolveActorUserId(ctx, dbInstance);

  if (ctx.entityType === "deal") {
    const stageInfo = await validateDealPipelineAndStage(
      ctx.organizationId,
      pipelineId,
      stageId,
      dbInstance
    );

    await dbInstance
      .update(deals)
      .set({
        pipelineId,
        pipelineStageId: stageId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(deals.id, ctx.entityId),
          eq(deals.organizationId, ctx.organizationId)
        )
      );

    await dbInstance.insert(activities).values({
      id: crypto.randomUUID(),
      organizationId: ctx.organizationId,
      entityType: "deal",
      entityId: ctx.entityId,
      type: "status_change",
      title: "Deal Stage Moved (Automation)",
      description: `Stage moved to "${stageInfo.stageName}" in pipeline "${stageInfo.pipelineName}" via automation.`,
      status: "completed",
      createdByUserId: actorId,
    });

    if (ctx.emitSubsequentEvent) {
      await ctx.emitSubsequentEvent(
        "deal",
        ctx.entityId,
        "pipeline_stage_changed",
        {
          pipelineId,
          stageId,
          pipelineStageId: stageId,
          stageName: stageInfo.stageName,
        }
      );
    }

    return {
      success: true,
      output: {
        pipelineId,
        stageId,
        stageName: stageInfo.stageName,
      },
    };
  } else {
    // Lead
    const validation = await validateLeadPipelineAndStage(
      ctx.organizationId,
      pipelineId,
      stageId,
      dbInstance
    );

    await dbInstance
      .update(leads)
      .set({
        pipelineId: validation.resolvedPipelineId,
        stageId: validation.resolvedStageId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(leads.id, ctx.entityId),
          eq(leads.organizationId, ctx.organizationId)
        )
      );

    await dbInstance.insert(activities).values({
      id: crypto.randomUUID(),
      organizationId: ctx.organizationId,
      entityType: "lead",
      entityId: ctx.entityId,
      type: "status_change",
      title: "Lead Stage Moved (Automation)",
      description: `Lead moved to new pipeline stage via automation.`,
      status: "completed",
      createdByUserId: actorId,
    });

    if (ctx.emitSubsequentEvent) {
      await ctx.emitSubsequentEvent(
        "lead",
        ctx.entityId,
        "pipeline_stage_changed",
        {
          pipelineId: validation.resolvedPipelineId,
          stageId: validation.resolvedStageId,
        }
      );
    }

    return {
      success: true,
      output: {
        pipelineId: validation.resolvedPipelineId,
        stageId: validation.resolvedStageId,
      },
    };
  }
}

/**
 * Registry mapping action type to execution handler.
 */
export const ACTION_HANDLERS: Record<
  AutomationActionType,
  (
    action: AutomationActionConfig,
    ctx: ActionExecutionContext,
    dbInstance: DbClient
  ) => Promise<ActionResult>
> = {
  create_activity: executeCreateActivityAction,
  create_follow_up: executeCreateFollowUpAction,
  assign_owner: executeAssignOwnerAction,
  update_field: executeUpdateFieldAction,
  move_pipeline_stage: executeMovePipelineStageAction,
};
