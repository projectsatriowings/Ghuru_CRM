"use server";

import { requirePermission } from "@/lib/context/organization-context";
import {
  getLeadHealth,
  getDealHealth,
  getOrganizationAttentionItems,
  getOrganizationAttentionSummary,
} from "@/lib/services/crm-health.service";
import {
  AttentionQueryOptions,
  IntelligenceEntityType,
} from "@/lib/types/intelligence";
import { AppError } from "@/lib/errors";

export async function getOrganizationAttentionAction(
  options: AttentionQueryOptions = {}
) {
  try {
    const ctx = await requirePermission("dashboard.view");
    const result = await getOrganizationAttentionItems(
      ctx.organization.id,
      options
    );
    return { success: true as const, data: result };
  } catch (error) {
    if (error instanceof AppError) {
      return { success: false as const, error: error.message };
    }
    const message =
      error instanceof Error
        ? error.message
        : "Failed to load attention items.";
    return { success: false as const, error: message };
  }
}

export async function getEntityHealthAction(
  entityType: IntelligenceEntityType,
  entityId: string
) {
  try {
    if (entityType === "lead") {
      const ctx = await requirePermission("leads.view");
      const health = await getLeadHealth(ctx.organization.id, entityId);
      return { success: true as const, data: health };
    } else if (entityType === "deal") {
      const ctx = await requirePermission("deals.view");
      const health = await getDealHealth(ctx.organization.id, entityId);
      return { success: true as const, data: health };
    } else {
      return {
        success: false as const,
        error: `Unsupported entity type: ${entityType}`,
      };
    }
  } catch (error) {
    if (error instanceof AppError) {
      return { success: false as const, error: error.message };
    }
    const message =
      error instanceof Error ? error.message : "Failed to load entity health.";
    return { success: false as const, error: message };
  }
}

export async function getAttentionSummaryAction(assigneeId?: string) {
  try {
    const ctx = await requirePermission("dashboard.view");
    const summary = await getOrganizationAttentionSummary(
      ctx.organization.id,
      assigneeId
    );
    return { success: true as const, data: summary };
  } catch (error) {
    if (error instanceof AppError) {
      return { success: false as const, error: error.message };
    }
    const message =
      error instanceof Error
        ? error.message
        : "Failed to load intelligence summary.";
    return { success: false as const, error: message };
  }
}
