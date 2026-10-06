import { db } from "@/db";
import { DbClient } from "@/db/types";
import {
  leads,
  deals,
  followUps,
  activities,
  pipelineStages,
  users,
} from "@/db/schema";
import {
  type AttentionItem,
  type EntityHealthResult,
  type OrganizationAttentionSummary,
  type AttentionQueryOptions,
  type IntelligenceSeverity,
  type HealthState,
} from "@/lib/types/intelligence";
import {
  CRM_HEALTH_DEFAULTS,
  CrmHealthThresholds,
  getHighValueThreshold,
} from "@/lib/intelligence/config";
import {
  SIGNAL_CATALOG,
  SEVERITY_WEIGHTS,
} from "@/lib/intelligence/signal-registry";
import { NotFoundError } from "@/lib/errors";
import { eq, and, isNull, inArray, sql, desc, asc } from "drizzle-orm";

export interface MinimalActivity {
  id: string;
  type: string;
  createdAt: Date;
}

export interface MinimalFollowUp {
  id: string;
  title: string;
  dueDate: string;
  dueTime?: string | null;
  status: string;
}

/**
 * Pure function: Evaluates health signals for a single Lead based on its state,
 * activity history, and scheduled follow-ups.
 */
export function evaluateLeadSignals(
  lead: {
    id: string;
    organizationId: string;
    firstName: string;
    lastName: string | null;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    archivedAt: Date | null;
    pipelineStageId?: string | null;
    stageName?: string | null;
    ownerName?: string | null;
  },
  leadActivities: MinimalActivity[],
  leadFollowUps: MinimalFollowUp[],
  now: Date = new Date(),
  thresholds: CrmHealthThresholds = CRM_HEALTH_DEFAULTS
): AttentionItem[] {
  // Guardrail: Archived, converted, or lost leads do not generate open-work attention signals
  if (lead.archivedAt || lead.status === "converted" || lead.status === "lost") {
    return [];
  }

  const signals: AttentionItem[] = [];
  const todayStr = now.toISOString().slice(0, 10);
  const leadName = `${lead.firstName} ${lead.lastName || ""}`.trim();

  // 1. Check for overdue follow-ups
  const overdueFollowUps = leadFollowUps.filter(
    (fu) => fu.status === "pending" && fu.dueDate < todayStr
  );

  for (const fu of overdueFollowUps) {
    const daysOverdue = Math.max(
      1,
      Math.floor(
        (now.getTime() - new Date(fu.dueDate).getTime()) / (1000 * 60 * 60 * 24)
      )
    );
    const severity: IntelligenceSeverity =
      daysOverdue > thresholds.overdueCriticalDays ? "critical" : "high";

    const def = SIGNAL_CATALOG.overdue_lead_follow_up;
    const ctx = {
      followUpTitle: fu.title,
      daysOverdue,
      dueDate: fu.dueDate,
    };

    signals.push({
      id: `lead_${lead.id}_overdue_fu_${fu.id}`,
      organizationId: lead.organizationId,
      entityType: "lead",
      entityId: lead.id,
      entityName: leadName,
      signalType: "overdue_lead_follow_up",
      severity,
      title: `${def.label}: ${fu.title}`,
      description: def.buildDescription(ctx),
      recommendedAction: def.buildRecommendedAction(ctx),
      detectedAt: now,
      metadata: {
        leadStatus: lead.status,
        followUpId: fu.id,
        dueDate: fu.dueDate,
        daysOverdue,
      },
      link: `/leads/${lead.id}`,
      stageName: lead.stageName,
      ownerName: lead.ownerName,
    });
  }

  // 2. Check for upcoming active follow-up (next action)
  const hasUpcomingFollowUp = leadFollowUps.some(
    (fu) => fu.status === "pending" && fu.dueDate >= todayStr
  );

  // 3. Qualified lead with no next action
  if (lead.status === "qualified" && !hasUpcomingFollowUp) {
    const def = SIGNAL_CATALOG.qualified_lead_no_next_action;
    const ctx = {};
    signals.push({
      id: `lead_${lead.id}_qualified_no_next_action`,
      organizationId: lead.organizationId,
      entityType: "lead",
      entityId: lead.id,
      entityName: leadName,
      signalType: "qualified_lead_no_next_action",
      severity: def.defaultSeverity,
      title: `${def.label} (${leadName})`,
      description: def.buildDescription(ctx),
      recommendedAction: def.buildRecommendedAction(ctx),
      detectedAt: now,
      metadata: {
        leadStatus: lead.status,
        hasNextAction: false,
      },
      link: `/leads/${lead.id}`,
      stageName: lead.stageName,
      ownerName: lead.ownerName,
    });
  }

  // 4. Stale lead (no activity for threshold days)
  const latestActivity = leadActivities.length > 0 ? leadActivities[0] : null;
  const lastActiveDate = latestActivity ? new Date(latestActivity.createdAt) : new Date(lead.createdAt);
  const daysInactive = Math.floor(
    (now.getTime() - lastActiveDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Do not flag stale if lead is terminal (unqualified, converted, lost)
  if (lead.status !== "unqualified" && daysInactive >= thresholds.staleLeadDays) {
    const def = SIGNAL_CATALOG.stale_lead;
    const ctx = { daysInactive, threshold: thresholds.staleLeadDays };
    signals.push({
      id: `lead_${lead.id}_stale_lead`,
      organizationId: lead.organizationId,
      entityType: "lead",
      entityId: lead.id,
      entityName: leadName,
      signalType: "stale_lead",
      severity: def.defaultSeverity,
      title: `${def.label} (${leadName})`,
      description: def.buildDescription(ctx),
      recommendedAction: def.buildRecommendedAction(ctx),
      detectedAt: now,
      metadata: {
        leadStatus: lead.status,
        daysInactive,
        threshold: thresholds.staleLeadDays,
        lastActivityAt: latestActivity?.createdAt ?? null,
      },
      link: `/leads/${lead.id}`,
      stageName: lead.stageName,
      ownerName: lead.ownerName,
    });
  }

  // 5. New lead with no meaningful contact/activity after threshold hours
  const hoursSinceCreation = Math.floor(
    (now.getTime() - new Date(lead.createdAt).getTime()) / (1000 * 60 * 60)
  );

  if (
    lead.status === "new" &&
    leadActivities.length === 0 &&
    hoursSinceCreation >= thresholds.newLeadContactHours
  ) {
    const def = SIGNAL_CATALOG.new_lead_no_contact;
    const ctx = { hoursSinceCreation };
    signals.push({
      id: `lead_${lead.id}_new_lead_no_contact`,
      organizationId: lead.organizationId,
      entityType: "lead",
      entityId: lead.id,
      entityName: leadName,
      signalType: "new_lead_no_contact",
      severity: def.defaultSeverity,
      title: `${def.label} (${leadName})`,
      description: def.buildDescription(ctx),
      recommendedAction: def.buildRecommendedAction(ctx),
      detectedAt: now,
      metadata: {
        leadStatus: lead.status,
        hoursSinceCreation,
        thresholdHours: thresholds.newLeadContactHours,
      },
      link: `/leads/${lead.id}`,
      stageName: lead.stageName,
      ownerName: lead.ownerName,
    });
  }

  return signals;
}

/**
 * Pure function: Evaluates health signals for a single Deal based on its stage,
 * value, close date, activity history, and scheduled follow-ups.
 */
export function evaluateDealSignals(
  deal: {
    id: string;
    organizationId: string;
    name: string;
    status: string;
    value: number | null;
    currency: string;
    expectedCloseDate: Date | null;
    createdAt: Date;
    updatedAt: Date;
    archivedAt: Date | null;
    stageName?: string | null;
    ownerName?: string | null;
  },
  dealActivities: MinimalActivity[],
  dealFollowUps: MinimalFollowUp[],
  now: Date = new Date(),
  thresholds: CrmHealthThresholds = CRM_HEALTH_DEFAULTS
): AttentionItem[] {
  // Guardrail: Archived deals or closed deals (won, lost) do not generate open-deal attention
  if (deal.archivedAt || deal.status !== "open") {
    return [];
  }

  const signals: AttentionItem[] = [];
  const todayStr = now.toISOString().slice(0, 10);
  const dealValue = deal.value !== null ? Number(deal.value) : 0;
  const highValueThreshold = getHighValueThreshold(deal.currency, thresholds);
  const isHighValue = dealValue >= highValueThreshold;
  const formattedValue = `${deal.currency} ${dealValue.toLocaleString()}`;

  // 1. Check for overdue follow-ups
  const overdueFollowUps = dealFollowUps.filter(
    (fu) => fu.status === "pending" && fu.dueDate < todayStr
  );

  for (const fu of overdueFollowUps) {
    const daysOverdue = Math.max(
      1,
      Math.floor(
        (now.getTime() - new Date(fu.dueDate).getTime()) / (1000 * 60 * 60 * 24)
      )
    );
    // Overdue on a high-value deal or overdue > 3 days elevates to critical
    const severity: IntelligenceSeverity =
      daysOverdue > thresholds.overdueCriticalDays || (isHighValue && daysOverdue > 1)
        ? "critical"
        : "high";

    const def = SIGNAL_CATALOG.overdue_deal_follow_up;
    const ctx = {
      followUpTitle: fu.title,
      daysOverdue,
      dueDate: fu.dueDate,
    };

    signals.push({
      id: `deal_${deal.id}_overdue_fu_${fu.id}`,
      organizationId: deal.organizationId,
      entityType: "deal",
      entityId: deal.id,
      entityName: deal.name,
      signalType: "overdue_deal_follow_up",
      severity,
      title: `${def.label}: ${fu.title}`,
      description: def.buildDescription(ctx),
      recommendedAction: def.buildRecommendedAction(ctx),
      detectedAt: now,
      metadata: {
        dealStatus: deal.status,
        dealValue,
        currency: deal.currency,
        isHighValue,
        followUpId: fu.id,
        dueDate: fu.dueDate,
        daysOverdue,
      },
      link: `/deals/${deal.id}`,
      value: deal.value,
      currency: deal.currency,
      stageName: deal.stageName,
      ownerName: deal.ownerName,
    });
  }

  // 2. Check for upcoming active follow-up (next action)
  const hasUpcomingFollowUp = dealFollowUps.some(
    (fu) => fu.status === "pending" && fu.dueDate >= todayStr
  );

  // 3. Activity staleness calculation
  const latestActivity = dealActivities.length > 0 ? dealActivities[0] : null;
  const lastActiveDate = latestActivity ? new Date(latestActivity.createdAt) : new Date(deal.createdAt);
  const daysInactive = Math.floor(
    (now.getTime() - lastActiveDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  const isStale = daysInactive >= thresholds.staleDealDays;

  // Stale Deal signals (high value stale vs regular stale)
  if (isStale) {
    if (isHighValue) {
      const def = SIGNAL_CATALOG.high_value_stale_deal;
      const ctx = {
        daysInactive,
        formattedValue,
        stageName: deal.stageName,
      };
      signals.push({
        id: `deal_${deal.id}_high_value_stale`,
        organizationId: deal.organizationId,
        entityType: "deal",
        entityId: deal.id,
        entityName: deal.name,
        signalType: "high_value_stale_deal",
        severity: "high",
        title: `${def.label} (${formattedValue})`,
        description: def.buildDescription(ctx),
        recommendedAction: def.buildRecommendedAction(ctx),
        detectedAt: now,
        metadata: {
          daysInactive,
          dealValue,
          currency: deal.currency,
          threshold: highValueThreshold,
          lastActivityAt: latestActivity?.createdAt ?? null,
        },
        link: `/deals/${deal.id}`,
        value: deal.value,
        currency: deal.currency,
        stageName: deal.stageName,
        ownerName: deal.ownerName,
      });
    } else {
      const def = SIGNAL_CATALOG.stale_deal;
      const ctx = {
        daysInactive,
        stageName: deal.stageName,
      };
      signals.push({
        id: `deal_${deal.id}_stale_deal`,
        organizationId: deal.organizationId,
        entityType: "deal",
        entityId: deal.id,
        entityName: deal.name,
        signalType: "stale_deal",
        severity: def.defaultSeverity,
        title: `${def.label} (${deal.name})`,
        description: def.buildDescription(ctx),
        recommendedAction: def.buildRecommendedAction(ctx),
        detectedAt: now,
        metadata: {
          daysInactive,
          dealValue,
          currency: deal.currency,
          lastActivityAt: latestActivity?.createdAt ?? null,
        },
        link: `/deals/${deal.id}`,
        value: deal.value,
        currency: deal.currency,
        stageName: deal.stageName,
        ownerName: deal.ownerName,
      });
    }
  }

  // 4. Expected Close Date signals
  if (deal.expectedCloseDate) {
    const closeDate = new Date(deal.expectedCloseDate);
    const closeDateStr = closeDate.toISOString().slice(0, 10);
    const daysUntilClose = Math.ceil(
      (closeDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysUntilClose <= thresholds.approachingCloseDays) {
      if (!hasUpcomingFollowUp) {
        // High risk: Approaching close without next action!
        const severity: IntelligenceSeverity =
          daysUntilClose <= 2 || isHighValue ? "critical" : "high";
        const def = SIGNAL_CATALOG.expected_close_without_next_action;
        const ctx = { daysUntilClose, closeDateStr };
        signals.push({
          id: `deal_${deal.id}_close_no_action`,
          organizationId: deal.organizationId,
          entityType: "deal",
          entityId: deal.id,
          entityName: deal.name,
          signalType: "expected_close_without_next_action",
          severity,
          title: `${def.label} (${deal.name})`,
          description: def.buildDescription(ctx),
          recommendedAction: def.buildRecommendedAction(ctx),
          detectedAt: now,
          metadata: {
            daysUntilClose,
            closeDateStr,
            hasNextAction: false,
            dealValue,
            currency: deal.currency,
          },
          link: `/deals/${deal.id}`,
          value: deal.value,
          currency: deal.currency,
          stageName: deal.stageName,
          ownerName: deal.ownerName,
        });
      } else {
        // Approaching close date with follow-up scheduled
        const def = SIGNAL_CATALOG.approaching_expected_close;
        const ctx = { daysUntilClose, closeDateStr };
        signals.push({
          id: `deal_${deal.id}_approaching_close`,
          organizationId: deal.organizationId,
          entityType: "deal",
          entityId: deal.id,
          entityName: deal.name,
          signalType: "approaching_expected_close",
          severity: def.defaultSeverity,
          title: `${def.label} (${deal.name})`,
          description: def.buildDescription(ctx),
          recommendedAction: def.buildRecommendedAction(ctx),
          detectedAt: now,
          metadata: {
            daysUntilClose,
            closeDateStr,
            hasNextAction: true,
          },
          link: `/deals/${deal.id}`,
          value: deal.value,
          currency: deal.currency,
          stageName: deal.stageName,
          ownerName: deal.ownerName,
        });
      }
    }
  }

  // 5. Deal missing next action (if not already surfaced under close date)
  const hasCloseNoAction = signals.some(
    (s) => s.signalType === "expected_close_without_next_action"
  );
  if (!hasUpcomingFollowUp && !hasCloseNoAction) {
    const def = SIGNAL_CATALOG.deal_no_next_action;
    const ctx = { stageName: deal.stageName };
    signals.push({
      id: `deal_${deal.id}_no_next_action`,
      organizationId: deal.organizationId,
      entityType: "deal",
      entityId: deal.id,
      entityName: deal.name,
      signalType: "deal_no_next_action",
      severity: def.defaultSeverity,
      title: `${def.label} (${deal.name})`,
      description: def.buildDescription(ctx),
      recommendedAction: def.buildRecommendedAction(ctx),
      detectedAt: now,
      metadata: {
        hasNextAction: false,
        stageName: deal.stageName,
        dealValue,
      },
      link: `/deals/${deal.id}`,
      value: deal.value,
      currency: deal.currency,
      stageName: deal.stageName,
      ownerName: deal.ownerName,
    });
  }

  return signals;
}

/**
 * Deterministic comparator to rank attention items by priority.
 */
export function compareAttentionItems(a: AttentionItem, b: AttentionItem): number {
  // 1. Severity weight (critical > high > medium > low)
  const weightA = SEVERITY_WEIGHTS[a.severity] ?? 0;
  const weightB = SEVERITY_WEIGHTS[b.severity] ?? 0;
  if (weightA !== weightB) {
    return weightB - weightA;
  }

  // 2. Rank priority from catalog (lower number = higher priority)
  const defA = SIGNAL_CATALOG[a.signalType];
  const defB = SIGNAL_CATALOG[b.signalType];
  const priorityA = defA?.rankPriority ?? 99;
  const priorityB = defB?.rankPriority ?? 99;
  if (priorityA !== priorityB) {
    return priorityA - priorityB;
  }

  // 3. For deals, higher deal values rank higher
  const valA = a.value ? Number(a.value) : 0;
  const valB = b.value ? Number(b.value) : 0;
  if (valA !== valB) {
    return valB - valA;
  }

  // 4. Detected at descending
  const timeA = new Date(a.detectedAt).getTime();
  const timeB = new Date(b.detectedAt).getTime();
  if (timeA !== timeB) {
    return timeB - timeA;
  }

  // 5. Stable tie breaker: item ID
  return a.id.localeCompare(b.id);
}

/**
 * Computes overall health state from signals.
 */
function resolveHealthState(signals: AttentionItem[]): {
  healthState: HealthState;
  highestSeverity: IntelligenceSeverity | null;
} {
  if (signals.length === 0) {
    return { healthState: "healthy", highestSeverity: null };
  }

  const hasCritical = signals.some((s) => s.severity === "critical");
  const hasHigh = signals.some((s) => s.severity === "high");

  if (hasCritical || hasHigh) {
    return {
      healthState: "at_risk",
      highestSeverity: hasCritical ? "critical" : "high",
    };
  }

  const hasMedium = signals.some((s) => s.severity === "medium");
  return {
    healthState: "needs_attention",
    highestSeverity: hasMedium ? "medium" : "low",
  };
}

/**
 * Retrieves the comprehensive health evaluation for a single Lead.
 */
export async function getLeadHealth(
  organizationId: string,
  leadId: string,
  dbInstance: DbClient = db as DbClient
): Promise<EntityHealthResult> {
  // 1. Fetch Lead
  const [row] = await dbInstance
    .select({
      lead: leads,
      stage: {
        id: pipelineStages.id,
        name: pipelineStages.name,
      },
      assignedUser: {
        id: users.id,
        name: users.name,
      },
    })
    .from(leads)
    .leftJoin(pipelineStages, eq(leads.stageId, pipelineStages.id))
    .leftJoin(users, eq(leads.assignedToUserId, users.id))
    .where(and(eq(leads.id, leadId), eq(leads.organizationId, organizationId)))
    .limit(1);

  if (!row) {
    throw new NotFoundError("Lead not found in this organization.");
  }

  const lead = {
    ...row.lead,
    stageName: row.stage?.name ?? null,
    ownerName: row.assignedUser?.name ?? null,
  };

  // 2. Fetch Lead Activities (ordered desc)
  const rawActivities = await dbInstance
    .select({
      id: activities.id,
      type: activities.type,
      createdAt: activities.createdAt,
    })
    .from(activities)
    .where(
      and(
        eq(activities.organizationId, organizationId),
        eq(activities.entityType, "lead"),
        eq(activities.entityId, leadId),
        isNull(activities.archivedAt)
      )
    )
    .orderBy(desc(activities.createdAt));

  // 3. Fetch Lead Follow-ups
  const rawFollowUps = await dbInstance
    .select({
      id: followUps.id,
      title: followUps.title,
      dueDate: followUps.dueDate,
      dueTime: followUps.dueTime,
      status: followUps.status,
    })
    .from(followUps)
    .where(
      and(
        eq(followUps.organizationId, organizationId),
        eq(followUps.leadId, leadId),
        isNull(followUps.archivedAt)
      )
    )
    .orderBy(asc(followUps.dueDate));

  // 4. Evaluate Signals
  const now = new Date();
  const signals = evaluateLeadSignals(lead, rawActivities, rawFollowUps, now);
  signals.sort(compareAttentionItems);

  const { healthState, highestSeverity } = resolveHealthState(signals);

  const latestActivity = rawActivities[0];
  const daysSinceLastActivity = latestActivity
    ? Math.floor((now.getTime() - new Date(latestActivity.createdAt).getTime()) / (1000 * 60 * 60 * 24))
    : Math.floor((now.getTime() - new Date(lead.createdAt).getTime()) / (1000 * 60 * 60 * 24));

  const todayStr = now.toISOString().slice(0, 10);
  const nextPendingFollowUp = rawFollowUps.find(
    (fu) => fu.status === "pending" && fu.dueDate >= todayStr
  );

  let summary = "Lead is progressing well with no operational bottlenecks.";
  if (healthState === "at_risk") {
    summary = `Lead has ${signals.length} critical issue${signals.length === 1 ? "" : "s"} requiring immediate intervention.`;
  } else if (healthState === "needs_attention") {
    summary = `Lead requires attention: ${signals[0]?.description ?? "Follow-up needed."}`;
  }

  return {
    entityType: "lead",
    entityId: lead.id,
    entityName: `${lead.firstName} ${lead.lastName || ""}`.trim(),
    healthState,
    highestSeverity,
    signals,
    lastActivityAt: latestActivity?.createdAt ?? null,
    daysSinceLastActivity,
    nextAction: nextPendingFollowUp
      ? {
          followUpId: nextPendingFollowUp.id,
          title: nextPendingFollowUp.title,
          dueDate: nextPendingFollowUp.dueDate,
          dueTime: nextPendingFollowUp.dueTime,
          isOverdue: false,
        }
      : null,
    summary,
    recommendedAction: signals[0]?.recommendedAction ?? null,
  };
}

/**
 * Retrieves the comprehensive health evaluation for a single Deal.
 */
export async function getDealHealth(
  organizationId: string,
  dealId: string,
  dbInstance: DbClient = db as DbClient
): Promise<EntityHealthResult> {
  // 1. Fetch Deal
  const [row] = await dbInstance
    .select({
      deal: deals,
      stage: {
        id: pipelineStages.id,
        name: pipelineStages.name,
      },
      ownerUser: {
        id: users.id,
        name: users.name,
      },
    })
    .from(deals)
    .leftJoin(pipelineStages, eq(deals.pipelineStageId, pipelineStages.id))
    .leftJoin(users, eq(deals.ownerUserId, users.id))
    .where(and(eq(deals.id, dealId), eq(deals.organizationId, organizationId)))
    .limit(1);

  if (!row) {
    throw new NotFoundError("Deal not found in this organization.");
  }

  const deal = {
    ...row.deal,
    value: row.deal.value !== null ? Number(row.deal.value) : null,
    stageName: row.stage?.name ?? null,
    ownerName: row.ownerUser?.name ?? null,
  };

  // 2. Fetch Deal Activities (ordered desc)
  const rawActivities = await dbInstance
    .select({
      id: activities.id,
      type: activities.type,
      createdAt: activities.createdAt,
    })
    .from(activities)
    .where(
      and(
        eq(activities.organizationId, organizationId),
        eq(activities.entityType, "deal"),
        eq(activities.entityId, dealId),
        isNull(activities.archivedAt)
      )
    )
    .orderBy(desc(activities.createdAt));

  // 3. Fetch Deal Follow-ups
  const rawFollowUps = await dbInstance
    .select({
      id: followUps.id,
      title: followUps.title,
      dueDate: followUps.dueDate,
      dueTime: followUps.dueTime,
      status: followUps.status,
    })
    .from(followUps)
    .where(
      and(
        eq(followUps.organizationId, organizationId),
        eq(followUps.dealId, dealId),
        isNull(followUps.archivedAt)
      )
    )
    .orderBy(asc(followUps.dueDate));

  // 4. Evaluate Signals
  const now = new Date();
  const signals = evaluateDealSignals(deal, rawActivities, rawFollowUps, now);
  signals.sort(compareAttentionItems);

  const { healthState, highestSeverity } = resolveHealthState(signals);

  const latestActivity = rawActivities[0];
  const daysSinceLastActivity = latestActivity
    ? Math.floor((now.getTime() - new Date(latestActivity.createdAt).getTime()) / (1000 * 60 * 60 * 24))
    : Math.floor((now.getTime() - new Date(deal.createdAt).getTime()) / (1000 * 60 * 60 * 24));

  const todayStr = now.toISOString().slice(0, 10);
  const nextPendingFollowUp = rawFollowUps.find(
    (fu) => fu.status === "pending" && fu.dueDate >= todayStr
  );

  let summary = "Deal is healthy with active momentum and scheduled next action.";
  if (deal.status !== "open") {
    summary = `Deal is ${deal.status}.`;
  } else if (healthState === "at_risk") {
    summary = `Deal is at risk: ${signals[0]?.description ?? "Requires urgent action."}`;
  } else if (healthState === "needs_attention") {
    summary = `Deal needs attention: ${signals[0]?.description ?? "Follow-up required."}`;
  }

  return {
    entityType: "deal",
    entityId: deal.id,
    entityName: deal.name,
    healthState,
    highestSeverity,
    signals,
    lastActivityAt: latestActivity?.createdAt ?? null,
    daysSinceLastActivity,
    nextAction: nextPendingFollowUp
      ? {
          followUpId: nextPendingFollowUp.id,
          title: nextPendingFollowUp.title,
          dueDate: nextPendingFollowUp.dueDate,
          dueTime: nextPendingFollowUp.dueTime,
          isOverdue: false,
        }
      : null,
    summary,
    recommendedAction: signals[0]?.recommendedAction ?? null,
  };
}

/**
 * High-performance batch evaluation of organization attention items.
 * Completely eliminates N+1 queries using batched multi-entity queries.
 */
export async function getOrganizationAttentionItems(
  organizationId: string,
  options: AttentionQueryOptions = {},
  dbInstance: DbClient = db as DbClient
): Promise<{
  items: AttentionItem[];
  summary: OrganizationAttentionSummary;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}> {
  const now = new Date();
  const thresholds = CRM_HEALTH_DEFAULTS;
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 20));

  // 1. Batch load active leads for the organization
  const leadConditions = [
    eq(leads.organizationId, organizationId),
    isNull(leads.archivedAt),
    sql`${leads.status} NOT IN ('converted', 'lost')`,
  ];
  if (options.assigneeId) {
    leadConditions.push(eq(leads.assignedToUserId, options.assigneeId));
  }

  const activeLeads =
    options.entityType === "deal"
      ? []
      : await dbInstance
          .select({
            lead: leads,
            stageName: pipelineStages.name,
            ownerName: users.name,
          })
          .from(leads)
          .leftJoin(pipelineStages, eq(leads.stageId, pipelineStages.id))
          .leftJoin(users, eq(leads.assignedToUserId, users.id))
          .where(and(...leadConditions));

  // 2. Batch load active deals for the organization
  const dealConditions = [
    eq(deals.organizationId, organizationId),
    isNull(deals.archivedAt),
    eq(deals.status, "open"),
  ];
  if (options.assigneeId) {
    dealConditions.push(eq(deals.ownerUserId, options.assigneeId));
  }

  const activeDeals =
    options.entityType === "lead"
      ? []
      : await dbInstance
          .select({
            deal: deals,
            stageName: pipelineStages.name,
            ownerName: users.name,
          })
          .from(deals)
          .leftJoin(pipelineStages, eq(deals.pipelineStageId, pipelineStages.id))
          .leftJoin(users, eq(deals.ownerUserId, users.id))
          .where(and(...dealConditions));

  const leadIds = activeLeads.map((r) => r.lead.id);
  const dealIds = activeDeals.map((r) => r.deal.id);

  // If no active entities exist, return empty results immediately
  if (leadIds.length === 0 && dealIds.length === 0) {
    return {
      items: [],
      summary: {
        total: 0,
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        byCategory: {
          overdueFollowUps: 0,
          noNextAction: 0,
          staleLeads: 0,
          staleDeals: 0,
          approachingClose: 0,
          highValueStale: 0,
        },
      },
      total: 0,
      page,
      pageSize,
      totalPages: 0,
    };
  }

  // 3. Single Batch Query: All pending follow-ups for loaded entities
  const followUpConditions = [
    eq(followUps.organizationId, organizationId),
    isNull(followUps.archivedAt),
  ];

  const entityFilters: Array<ReturnType<typeof inArray>> = [];
  if (leadIds.length > 0) entityFilters.push(inArray(followUps.leadId, leadIds));
  if (dealIds.length > 0) entityFilters.push(inArray(followUps.dealId, dealIds));

  const rawFollowUps = await dbInstance
    .select({
      id: followUps.id,
      title: followUps.title,
      dueDate: followUps.dueDate,
      dueTime: followUps.dueTime,
      status: followUps.status,
      leadId: followUps.leadId,
      dealId: followUps.dealId,
    })
    .from(followUps)
    .where(
      and(
        ...followUpConditions,
        entityFilters.length === 1
          ? entityFilters[0]
          : sql`(${entityFilters[0]} OR ${entityFilters[1]})`
      )
    )
    .orderBy(asc(followUps.dueDate));

  const leadFollowUpsMap = new Map<string, MinimalFollowUp[]>();
  const dealFollowUpsMap = new Map<string, MinimalFollowUp[]>();

  for (const fu of rawFollowUps) {
    if (fu.leadId) {
      const list = leadFollowUpsMap.get(fu.leadId) || [];
      list.push(fu);
      leadFollowUpsMap.set(fu.leadId, list);
    }
    if (fu.dealId) {
      const list = dealFollowUpsMap.get(fu.dealId) || [];
      list.push(fu);
      dealFollowUpsMap.set(fu.dealId, list);
    }
  }

  // 4. Single Batch Query: Latest activity for loaded entities
  const activityConditions = [
    eq(activities.organizationId, organizationId),
    isNull(activities.archivedAt),
  ];

  const actFilters: Array<ReturnType<typeof and>> = [];
  if (leadIds.length > 0) {
    actFilters.push(
      and(eq(activities.entityType, "lead"), inArray(activities.entityId, leadIds))
    );
  }
  if (dealIds.length > 0) {
    actFilters.push(
      and(eq(activities.entityType, "deal"), inArray(activities.entityId, dealIds))
    );
  }

  const latestActivities = await dbInstance
    .select({
      entityId: activities.entityId,
      entityType: activities.entityType,
      maxCreatedAt: sql<Date>`max(${activities.createdAt})`,
    })
    .from(activities)
    .where(
      and(
        ...activityConditions,
        actFilters.length === 1
          ? actFilters[0]
          : sql`(${actFilters[0]} OR ${actFilters[1]})`
      )
    )
    .groupBy(activities.entityId, activities.entityType);

  const entityLatestActivityMap = new Map<string, Date>();
  for (const act of latestActivities) {
    entityLatestActivityMap.set(
      `${act.entityType}_${act.entityId}`,
      new Date(act.maxCreatedAt)
    );
  }

  // 5. In-Memory Evaluation for Leads
  const allAttentionItems: AttentionItem[] = [];

  for (const row of activeLeads) {
    const leadKey = `lead_${row.lead.id}`;
    const latestDate = entityLatestActivityMap.get(leadKey);
    const mockActivities: MinimalActivity[] = latestDate
      ? [{ id: "latest", type: "activity", createdAt: latestDate }]
      : [];

    const fUps = leadFollowUpsMap.get(row.lead.id) || [];
    const signals = evaluateLeadSignals(
      {
        ...row.lead,
        stageName: row.stageName,
        ownerName: row.ownerName,
      },
      mockActivities,
      fUps,
      now,
      thresholds
    );
    allAttentionItems.push(...signals);
  }

  // 6. In-Memory Evaluation for Deals
  for (const row of activeDeals) {
    const dealKey = `deal_${row.deal.id}`;
    const latestDate = entityLatestActivityMap.get(dealKey);
    const mockActivities: MinimalActivity[] = latestDate
      ? [{ id: "latest", type: "activity", createdAt: latestDate }]
      : [];

    const fUps = dealFollowUpsMap.get(row.deal.id) || [];
    const signals = evaluateDealSignals(
      {
        ...row.deal,
        value: row.deal.value !== null ? Number(row.deal.value) : null,
        stageName: row.stageName,
        ownerName: row.ownerName,
      },
      mockActivities,
      fUps,
      now,
      thresholds
    );
    allAttentionItems.push(...signals);
  }

  // 7. Deterministic Sorting
  allAttentionItems.sort(compareAttentionItems);

  // 8. Calculate Summary
  const summary: OrganizationAttentionSummary = {
    total: allAttentionItems.length,
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    byCategory: {
      overdueFollowUps: 0,
      noNextAction: 0,
      staleLeads: 0,
      staleDeals: 0,
      approachingClose: 0,
      highValueStale: 0,
    },
  };

  for (const item of allAttentionItems) {
    if (item.severity === "critical") summary.critical++;
    else if (item.severity === "high") summary.high++;
    else if (item.severity === "medium") summary.medium++;
    else if (item.severity === "low") summary.low++;

    if (
      item.signalType === "overdue_lead_follow_up" ||
      item.signalType === "overdue_deal_follow_up"
    ) {
      summary.byCategory.overdueFollowUps++;
    } else if (
      item.signalType === "qualified_lead_no_next_action" ||
      item.signalType === "deal_no_next_action" ||
      item.signalType === "new_lead_no_contact"
    ) {
      summary.byCategory.noNextAction++;
    } else if (item.signalType === "stale_lead") {
      summary.byCategory.staleLeads++;
    } else if (item.signalType === "stale_deal") {
      summary.byCategory.staleDeals++;
    } else if (item.signalType === "high_value_stale_deal") {
      summary.byCategory.highValueStale++;
    } else if (
      item.signalType === "approaching_expected_close" ||
      item.signalType === "expected_close_without_next_action"
    ) {
      summary.byCategory.approachingClose++;
    }
  }

  // 9. Apply Filter Options (if requested)
  let filteredItems = allAttentionItems;
  if (options.severity && options.severity !== "all") {
    if (options.severity === "high_and_critical") {
      filteredItems = filteredItems.filter(
        (i) => i.severity === "high" || i.severity === "critical"
      );
    } else {
      filteredItems = filteredItems.filter((i) => i.severity === options.severity);
    }
  }

  if (options.entityType && options.entityType !== "all") {
    filteredItems = filteredItems.filter(
      (i) => i.entityType === options.entityType
    );
  }

  // 10. Pagination
  const total = filteredItems.length;
  const totalPages = Math.ceil(total / pageSize);
  const startIndex = (page - 1) * pageSize;
  const paginatedItems = filteredItems.slice(startIndex, startIndex + pageSize);

  return {
    items: paginatedItems,
    summary,
    total,
    page,
    pageSize,
    totalPages,
  };
}

/**
 * Retrieves the high-level attention summary metrics for the organization.
 */
export async function getOrganizationAttentionSummary(
  organizationId: string,
  assigneeIdFilter?: string,
  dbInstance: DbClient = db as DbClient
): Promise<OrganizationAttentionSummary> {
  const result = await getOrganizationAttentionItems(
    organizationId,
    { assigneeId: assigneeIdFilter, pageSize: 1 },
    dbInstance
  );
  return result.summary;
}
