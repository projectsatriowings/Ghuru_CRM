import { db } from "@/db";
import { DbClient } from "@/db/types";
import {
  type CRMIntelligenceContext,
  type EntityIntelligenceContext,
} from "./ai-types";
import { resolveDateRange } from "@/lib/utils/date-range-utils";
import {
  getOrganizationAttentionItems,
  getLeadHealth,
  getDealHealth,
} from "@/lib/services/crm-health.service";
import {
  getLeadFunnelIntelligence,
  getLeadSourcePerformance,
  getDealPipelineIntelligence,
  getPipelineBottlenecks,
  getPeriodComparisonMetrics,
} from "@/lib/services/pipeline-intelligence.service";
import {
  getTeamAndOwnerIntelligence,
} from "@/lib/services/team-owner-intelligence.service";
import { getLeadById } from "@/lib/services/lead.service";
import { getDealById } from "@/lib/services/deal.service";
import { getAutomations } from "@/lib/services/automation.service";
import { organizations } from "@/db/schema/organizations";
import { activities } from "@/db/schema/activities";
import { eq, and, isNull, desc } from "drizzle-orm";
import { ForbiddenError, NotFoundError } from "@/lib/errors";

export interface ContextBuildOptions {
  preset?: string;
  from?: string | Date;
  to?: string | Date;
  assigneeId?: string;
  pipelineId?: string;
}

/**
 * Builds the deterministic intelligence context for an organization.
 * Strictly respects caller tenant isolation and caller RBAC permissions.
 */
export async function buildCRMIntelligenceContext(
  organizationId: string,
  userPermissions: string[],
  options: ContextBuildOptions = {},
  dbInstance: DbClient = db as DbClient
): Promise<CRMIntelligenceContext> {
  const permSet = new Set(userPermissions);
  const dateRange = resolveDateRange(options.preset, options.from, options.to);

  // 1. Fetch organization details
  const [org] = await dbInstance
    .select({ id: organizations.id, name: organizations.name })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);

  const orgName = org?.name || "Organization Workspace";

  // Permission flags
  const canViewLeads = permSet.has("leads.view");
  const canViewDeals = permSet.has("deals.view");
  const canViewIntelligence =
    permSet.has("intelligence.view") || permSet.has("dashboard.view");
  const canViewTeams = permSet.has("teams.view");
  const canViewActivities = permSet.has("activities.view");
  const canViewAutomations = permSet.has("automations.view");

  // 2. Parallel deterministic queries based on RBAC permissions
  const queryOptions = {
    dateRange,
    assigneeId: options.assigneeId,
    pipelineId: options.pipelineId,
  };

  const [
    attentionResult,
    funnelResult,
    sourcesResult,
    pipelinesResult,
    bottlenecksResult,
    periodCompResult,
    teamOwnerResult,
    recentActivitiesResult,
    automationsResult,
  ] = await Promise.all([
    // CRM Health & Attention Items (filtered by entity permissions)
    canViewIntelligence
      ? getOrganizationAttentionItems(
          organizationId,
          { pageSize: 30, assigneeId: options.assigneeId },
          dbInstance
        )
      : Promise.resolve({ items: [], summary: null }),

    // Lead Funnel (2.10B)
    canViewLeads
      ? getLeadFunnelIntelligence(
          organizationId,
          queryOptions,
          options.assigneeId,
          options.pipelineId,
          dbInstance
        )
      : Promise.resolve(null),

    // Lead Sources (2.10B)
    canViewLeads
      ? getLeadSourcePerformance(
          organizationId,
          queryOptions,
          options.assigneeId,
          options.pipelineId,
          dbInstance
        )
      : Promise.resolve([]),

    // Deal Pipelines (2.10B)
    canViewDeals
      ? getDealPipelineIntelligence(
          organizationId,
          queryOptions,
          options.assigneeId,
          options.pipelineId,
          dbInstance
        )
      : Promise.resolve([]),

    // Pipeline Bottlenecks (2.10B)
    canViewDeals
      ? getPipelineBottlenecks(
          organizationId,
          queryOptions,
          options.assigneeId,
          options.pipelineId,
          dbInstance
        )
      : Promise.resolve([]),

    // Period Comparison (2.10B)
    canViewIntelligence
      ? getPeriodComparisonMetrics(
          organizationId,
          queryOptions,
          options.assigneeId,
          options.pipelineId,
          dbInstance
        )
      : Promise.resolve(null),

    // Team & Owner Intelligence (2.10C)
    canViewTeams
      ? getTeamAndOwnerIntelligence(
          organizationId,
          queryOptions,
          options.assigneeId,
          options.pipelineId,
          dbInstance
        )
      : Promise.resolve(null),

    // Recent CRM Activities (2.7)
    canViewActivities
      ? dbInstance
          .select({
            id: activities.id,
            type: activities.type,
            title: activities.title,
            entityType: activities.entityType,
            createdAt: activities.createdAt,
          })
          .from(activities)
          .where(
            and(
              eq(activities.organizationId, organizationId),
              isNull(activities.archivedAt)
            )
          )
          .orderBy(desc(activities.createdAt))
          .limit(10)
      : Promise.resolve([]),

    // Automations (2.9)
    canViewAutomations
      ? getAutomations(organizationId, { pageSize: 50 }, dbInstance)
      : Promise.resolve(null),
  ]);

  // Filter attention items by entity permission
  let filteredAttentionItems = attentionResult.items;
  if (!canViewDeals) {
    filteredAttentionItems = filteredAttentionItems.filter(
      (item) => item.entityType !== "deal"
    );
  }
  if (!canViewLeads) {
    filteredAttentionItems = filteredAttentionItems.filter(
      (item) => item.entityType !== "lead"
    );
  }

  // Format recent activities with strict entity view filtering
  const formattedActivities = (recentActivitiesResult || [])
    .filter((act) => {
      if (act.entityType === "deal" && !canViewDeals) return false;
      if (act.entityType === "lead" && !canViewLeads) return false;
      return true;
    })
    .map((act) => ({
      id: act.id,
      type: act.type,
      title: act.title,
      entityType: act.entityType,
      createdAt:
        act.createdAt instanceof Date
          ? act.createdAt.toISOString()
          : String(act.createdAt),
    }));

  // Automations summary
  let automationsSummary = null;
  if (automationsResult) {
    const activeCount = automationsResult.data.filter(
      (a) => a.active && !a.archivedAt
    ).length;
    automationsSummary = {
      total: automationsResult.pagination.total,
      active: activeCount,
      recentExecutionsCount: automationsResult.data.reduce(
        (acc: number, curr) => acc + (curr.executionStats?.total || 0),
        0
      ),
    };
  }

  // Redact deal and lead metrics from unassigned workload if permissions are absent
  let sanitizedUnassigned = teamOwnerResult?.unassigned || null;
  if (sanitizedUnassigned) {
    if (!canViewDeals) {
      sanitizedUnassigned = {
        ...sanitizedUnassigned,
        unassignedOpenDeals: 0,
        unassignedDealsByStatus: { open: 0, won: 0, lost: 0 },
        unassignedOpenDealValueByCurrency: {},
      };
    }
    if (!canViewLeads) {
      sanitizedUnassigned = {
        ...sanitizedUnassigned,
        unassignedLeads: 0,
      };
    }
  }

  // Redact deal metrics from team owners if deals.view is absent
  const sanitizedOwners = (teamOwnerResult?.owners || []).map((o) => {
    if (!canViewDeals) {
      return {
        ...o,
        deals: {
          totalDeals: 0,
          openDeals: 0,
          wonDeals: 0,
          lostDeals: 0,
          closedDeals: 0,
          winRate: 0,
          hasSufficientClosedDeals: false,
        },
        dealValue: {
          openValueByCurrency: {},
          wonValueByCurrency: {},
          lostValueByCurrency: {},
          totalClosedValueByCurrency: {},
        },
      };
    }
    return o;
  });

  return {
    organizationSummary: {
      id: organizationId,
      name: orgName,
    },
    dateRange: {
      from: dateRange.from.toISOString(),
      to: dateRange.to.toISOString(),
      preset: dateRange.preset,
    },
    userPermissions,
    healthSummary: attentionResult.summary,
    attentionItems: filteredAttentionItems,
    funnel: funnelResult,
    leadSources: sourcesResult,
    pipelines: pipelinesResult,
    bottlenecks: bottlenecksResult,
    periodComparison: periodCompResult,
    owners: sanitizedOwners,
    teams: teamOwnerResult?.teams || [],
    unassignedWorkload: sanitizedUnassigned,
    workloadIndicators: teamOwnerResult?.indicators || null,
    recentActivities: formattedActivities,
    automationsSummary,
  };
}

/**
 * Builds entity-specific intelligence context for entity-aware queries.
 * Enforces strict entity-level RBAC (e.g., deals.view, leads.view).
 */
export async function buildEntityIntelligenceContext(
  organizationId: string,
  entityType: "lead" | "deal" | "pipeline" | "owner" | "team" | "company" | "contact",
  entityId: string,
  userPermissions: string[],
  dbInstance: DbClient = db as DbClient
): Promise<EntityIntelligenceContext> {
  const permSet = new Set(userPermissions);

  if (entityType === "deal") {
    if (!permSet.has("deals.view")) {
      throw new ForbiddenError(
        "Forbidden: You do not have permission [deals.view] to analyze deals."
      );
    }
    const deal = await getDealById(organizationId, entityId, dbInstance);
    if (!deal) {
      throw new NotFoundError("Deal not found in this organization.");
    }

    let health = null;
    try {
      health = await getDealHealth(organizationId, entityId, dbInstance);
    } catch {
      // If health calculation fails or entity not evaluated
    }

    return {
      entityType: "deal",
      entityId: deal.id,
      entityName: deal.name,
      details: {
        value: deal.value,
        currency: deal.currency,
        status: deal.status,
        pipeline: deal.pipeline?.name,
        stage: deal.stage?.name,
        owner: deal.ownerUser?.name || "Unassigned",
        expectedCloseDate: deal.expectedCloseDate,
        createdAt: deal.createdAt,
        updatedAt: deal.updatedAt,
      },
      health,
      signals: health?.signals || [],
    };
  }

  if (entityType === "lead") {
    if (!permSet.has("leads.view")) {
      throw new ForbiddenError(
        "Forbidden: You do not have permission [leads.view] to analyze leads."
      );
    }
    const lead = await getLeadById(organizationId, entityId, dbInstance);
    if (!lead) {
      throw new NotFoundError("Lead not found in this organization.");
    }

    let health = null;
    try {
      health = await getLeadHealth(organizationId, entityId, dbInstance);
    } catch {
      // Health calculation fallback
    }

    const leadName = `${lead.firstName} ${lead.lastName || ""}`.trim();
    return {
      entityType: "lead",
      entityId: lead.id,
      entityName: leadName,
      details: {
        status: lead.status,
        source: lead.source,
        pipeline: lead.pipeline?.name,
        stage: lead.stage?.name,
        assignedTo: lead.assignedToUser?.name || "Unassigned",
        createdAt: lead.createdAt,
        updatedAt: lead.updatedAt,
      },
      health,
      signals: health?.signals || [],
    };
  }

  // Generic entity fallback
  return {
    entityType,
    entityId,
    entityName: `${entityType}_${entityId}`,
    details: { entityType, entityId },
  };
}
