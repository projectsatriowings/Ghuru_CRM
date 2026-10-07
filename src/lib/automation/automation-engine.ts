import { DbClient } from "@/db/types";
import { db } from "@/db";
import {
  AutomationEvent,
  AutomationExecutionContext,
  AutomationEntityType,
  AutomationTriggerType,
} from "@/lib/types/automations";
import { automations, automationExecutions } from "@/db/schema/automations";
import { leads } from "@/db/schema/leads";
import { deals } from "@/db/schema/deals";
import { contacts } from "@/db/schema/contacts";
import { companies } from "@/db/schema/companies";
import { eq, and, isNull } from "drizzle-orm";
import { evaluateConditionGroups } from "./condition-evaluator";
import { ACTION_HANDLERS, ActionExecutionContext } from "./action-registry";
import { getCustomFieldValuesForEntity } from "@/lib/services/custom-field.service";
import { publishIntegrationEvent } from "@/lib/services/integrations/integration-event.service";

export const MAX_AUTOMATION_DEPTH = 5;

export interface EngineExecutionSummary {
  correlationId: string;
  matchedCount: number;
  executedCount: number;
  skippedCount: number;
  failedCount: number;
  depth: number;
}

/**
 * Loads the current full entity snapshot including custom fields and relations for condition evaluation.
 */
export async function loadEntitySnapshot(
  organizationId: string,
  entityType: AutomationEntityType,
  entityId: string,
  dbInstance: DbClient = db as DbClient
): Promise<Record<string, unknown> | null> {
  let baseData: Record<string, unknown> | null = null;

  switch (entityType) {
    case "lead": {
      const [lead] = await dbInstance
        .select()
        .from(leads)
        .where(
          and(eq(leads.id, entityId), eq(leads.organizationId, organizationId))
        )
        .limit(1);
      if (!lead || lead.archivedAt) return null;
      baseData = { ...lead };
      break;
    }
    case "deal": {
      const [deal] = await dbInstance
        .select()
        .from(deals)
        .where(
          and(eq(deals.id, entityId), eq(deals.organizationId, organizationId))
        )
        .limit(1);
      if (!deal || deal.archivedAt) return null;
      baseData = {
        ...deal,
        value: deal.value !== null ? Number(deal.value) : null,
      };
      break;
    }
    case "contact": {
      const [contact] = await dbInstance
        .select()
        .from(contacts)
        .where(
          and(
            eq(contacts.id, entityId),
            eq(contacts.organizationId, organizationId)
          )
        )
        .limit(1);
      if (!contact || contact.archivedAt) return null;
      baseData = { ...contact };
      break;
    }
    case "company": {
      const [company] = await dbInstance
        .select()
        .from(companies)
        .where(
          and(
            eq(companies.id, entityId),
            eq(companies.organizationId, organizationId)
          )
        )
        .limit(1);
      if (!company || company.archivedAt) return null;
      baseData = { ...company };
      break;
    }
  }

  if (!baseData) return null;

  // Fetch custom field values
  try {
    const customFieldValues = await getCustomFieldValuesForEntity(
      organizationId,
      entityType,
      entityId,
      dbInstance
    );
    const customFieldsMap: Record<string, unknown> = {};
    for (const cf of customFieldValues) {
      customFieldsMap[cf.field.key] = cf.value;
    }
    baseData.customFields = customFieldsMap;
  } catch {
    baseData.customFields = {};
  }

  return baseData;
}

/**
 * Emits an internal domain automation event and executes matching active automations.
 */
export async function emitAutomationEvent(
  event: AutomationEvent,
  context?: AutomationExecutionContext,
  dbInstance: DbClient = db as DbClient
): Promise<EngineExecutionSummary> {
  const currentContext: AutomationExecutionContext = context || {
    correlationId: crypto.randomUUID(),
    depth: 0,
    visitedAutomationIds: new Set<string>(),
  };

  const summary: EngineExecutionSummary = {
    correlationId: currentContext.correlationId,
    matchedCount: 0,
    executedCount: 0,
    skippedCount: 0,
    failedCount: 0,
    depth: currentContext.depth,
  };

  // Guard: Maximum automation recursion depth
  if (currentContext.depth >= MAX_AUTOMATION_DEPTH) {
    console.warn(
      `[AutomationEngine] Halting: Maximum depth (${MAX_AUTOMATION_DEPTH}) exceeded for correlation ${currentContext.correlationId}`
    );
    return summary;
  }

  try {
    // 1. Load active entity snapshot
    const entitySnapshot =
      (event.payload?.current as Record<string, unknown>) ||
      (await loadEntitySnapshot(
        event.organizationId,
        event.entityType,
        event.entityId,
        dbInstance
      ));

    if (!entitySnapshot) {
      // Entity not found or archived; do not execute automations
      return summary;
    }

    // Bridge root domain events to generic integration platform subscribers (webhooks)
    if (currentContext.depth === 0) {
      let integrationEventType = `${event.entityType}.${
        event.eventType === "entity_created"
          ? "created"
          : event.eventType === "entity_updated"
          ? "updated"
          : event.eventType === "entity_status_changed"
          ? "status_changed"
          : event.eventType === "entity_assigned"
          ? "assigned"
          : event.eventType === "pipeline_stage_changed"
          ? "stage_changed"
          : event.eventType
      }`;

      if (event.entityType === "deal" && event.eventType === "entity_status_changed") {
        const dealStatus = entitySnapshot.status as string;
        if (dealStatus === "won") integrationEventType = "deal.won";
        else if (dealStatus === "lost") integrationEventType = "deal.lost";
      }

      void publishIntegrationEvent(
        {
          organizationId: event.organizationId,
          eventType: integrationEventType,
          entityType: event.entityType,
          entityId: event.entityId,
          payload: {
            snapshot: entitySnapshot,
            previous: event.payload?.previous ?? null,
          },
          metadata: {
            actorUserId: event.actorUserId ?? null,
            correlationId: currentContext.correlationId,
          },
        },
        dbInstance
      ).catch((err) => {
        console.error(
          "[AutomationEngine] Failed to dispatch integration event:",
          err
        );
      });
    }

    // 2. Fetch active automations matching (orgId, entityType, triggerType, active=true, archivedAt is null)
    const matchingAutomations = await dbInstance
      .select()
      .from(automations)
      .where(
        and(
          eq(automations.organizationId, event.organizationId),
          eq(automations.entityType, event.entityType),
          eq(automations.triggerType, event.eventType),
          eq(automations.active, true),
          isNull(automations.archivedAt)
        )
      );

    summary.matchedCount = matchingAutomations.length;
    if (matchingAutomations.length === 0) {
      return summary;
    }

    // 3. Process each matching automation
    for (const auto of matchingAutomations) {
      // Check for recursion loop
      if (currentContext.visitedAutomationIds.has(auto.id)) {
        summary.skippedCount++;
        // Log loop skip
        const loopExecId = crypto.randomUUID();
        await dbInstance.insert(automationExecutions).values({
          id: loopExecId,
          organizationId: event.organizationId,
          automationId: auto.id,
          eventType: event.eventType,
          entityType: event.entityType,
          entityId: event.entityId,
          status: "skipped",
          startedAt: new Date(),
          completedAt: new Date(),
          errorMessage: "Recursion loop detected: automation already in execution chain.",
          metadata: {
            skippedReason: "Recursion loop detected",
            correlationId: currentContext.correlationId,
            depth: currentContext.depth,
          },
        });
        continue;
      }

      const executionId = crypto.randomUUID();
      const startedAt = new Date();

      // Initial execution log
      await dbInstance.insert(automationExecutions).values({
        id: executionId,
        organizationId: event.organizationId,
        automationId: auto.id,
        eventType: event.eventType,
        entityType: event.entityType,
        entityId: event.entityId,
        status: "running",
        startedAt,
        metadata: {
          correlationId: currentContext.correlationId,
          depth: currentContext.depth,
        },
      });

      try {
        // 4. Condition Evaluation
        const evalReport = evaluateConditionGroups(
          auto.conditions,
          entitySnapshot
        );

        if (!evalReport.passed) {
          summary.skippedCount++;
          await dbInstance
            .update(automationExecutions)
            .set({
              status: "skipped",
              completedAt: new Date(),
              metadata: {
                correlationId: currentContext.correlationId,
                depth: currentContext.depth,
                conditionsEvaluated: true,
                conditionResults: evalReport.groupResults,
                skippedReason: "Conditions did not match",
              },
            })
            .where(eq(automationExecutions.id, executionId));
          continue;
        }

        // 5. Conditions passed! Execute Actions sequentially
        const visitedNext = new Set(currentContext.visitedAutomationIds);
        visitedNext.add(auto.id);

        const nextContext: AutomationExecutionContext = {
          correlationId: currentContext.correlationId,
          depth: currentContext.depth + 1,
          visitedAutomationIds: visitedNext,
        };

        const actionResults: Array<{
          type: string;
          status: "success" | "failed";
          output?: unknown;
          error?: string;
        }> = [];

        let anyActionFailed = false;
        let lastErrorMessage: string | null = null;

        const actionCtx: ActionExecutionContext = {
          organizationId: event.organizationId,
          entityType: event.entityType,
          entityId: event.entityId,
          actorUserId: event.actorUserId,
          entitySnapshot,
          executionContext: nextContext,
          emitSubsequentEvent: async (
            subEntityType,
            subEntityId,
            subTriggerType,
            subPayload
          ) => {
            await emitAutomationEvent(
              {
                organizationId: event.organizationId,
                entityType: subEntityType,
                entityId: subEntityId,
                eventType: subTriggerType as AutomationTriggerType,
                actorUserId: event.actorUserId,
                payload: { current: subPayload },
              },
              nextContext,
              dbInstance
            );
          },
        };

        for (const action of auto.actions) {
          const handler = ACTION_HANDLERS[action.type];
          if (!handler) {
            anyActionFailed = true;
            lastErrorMessage = `Unsupported action type: ${action.type}`;
            actionResults.push({
              type: action.type,
              status: "failed",
              error: lastErrorMessage,
            });
            break;
          }

          try {
            const result = await handler(action, actionCtx, dbInstance);
            if (result.success) {
              actionResults.push({
                type: action.type,
                status: "success",
                output: result.output,
              });
            } else {
              anyActionFailed = true;
              lastErrorMessage = result.error || "Action execution failed";
              actionResults.push({
                type: action.type,
                status: "failed",
                error: lastErrorMessage || undefined,
              });
            }
          } catch (err: unknown) {
            anyActionFailed = true;
            lastErrorMessage =
              err instanceof Error ? err.message : "Action execution exception";
            actionResults.push({
              type: action.type,
              status: "failed",
              error: lastErrorMessage || undefined,
            });
          }
        }

        const finalStatus = anyActionFailed ? "failed" : "completed";
        if (anyActionFailed) {
          summary.failedCount++;
        } else {
          summary.executedCount++;
        }

        await dbInstance
          .update(automationExecutions)
          .set({
            status: finalStatus,
            completedAt: new Date(),
            errorMessage: lastErrorMessage || undefined,
            metadata: {
              correlationId: currentContext.correlationId,
              depth: currentContext.depth,
              conditionsEvaluated: true,
              conditionResults: evalReport.groupResults,
              actionsExecuted: actionResults,
            },
          })
          .where(eq(automationExecutions.id, executionId));
      } catch (autoErr: unknown) {
        summary.failedCount++;
        const autoErrMsg =
          autoErr instanceof Error
            ? autoErr.message
            : "Unhandled automation execution failure";
        const autoErrStack = autoErr instanceof Error ? autoErr.stack : undefined;
        console.error(
          `[AutomationEngine] Error executing automation ${auto.id}:`,
          autoErr
        );
        await dbInstance
          .update(automationExecutions)
          .set({
            status: "failed",
            completedAt: new Date(),
            errorMessage: autoErrMsg,
            metadata: {
              correlationId: currentContext.correlationId,
              depth: currentContext.depth,
              errorStack: autoErrStack,
            },
          })
          .where(eq(automationExecutions.id, executionId));
      }
    }
  } catch (outerErr) {
    console.error("[AutomationEngine] Outer error in emitAutomationEvent:", outerErr);
  }

  return summary;
}
