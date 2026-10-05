import { db } from "@/db";
import { DbClient } from "@/db/types";
import {
  leads,
  followUps,
  activities,
  pipelines,
  pipelineStages,
  users,
  organizationMembers,
  type ActivityType,
  ACTIVITY_TYPES,
} from "@/db/schema";
import {
  type DashboardData,
  type DashboardFilters,
  type DashboardDateRange,
  type DashboardDateRangePreset,
  type LeadMetrics,
  type LeadSourceMetricItem,
  type PipelineMetricItem,
  type FollowUpMetrics,
  type ActivityMetrics,
  type ConversionMetrics,
  type MyWorkMetrics,
  type NeedsAttentionItem,
} from "@/lib/types/dashboard";
import {
  LEAD_SOURCES,
  LEAD_SOURCE_LABELS,
  LEAD_STATUSES,
  LEAD_STATUS_LABELS,
  type LeadSource,
  type LeadStatus,
} from "@/lib/types/leads";
import { resolveDateRange } from "@/lib/utils/date-range-utils";
import { NotFoundError } from "@/lib/errors";
import { eq, and, isNull, inArray, gte, lte, lt, desc, asc, sql } from "drizzle-orm";

export interface DashboardQueryOptions {
  dateRange?: DashboardDateRange;
  preset?: DashboardDateRangePreset;
  from?: Date | string;
  to?: Date | string;
  assigneeId?: string;
  pipelineId?: string;
}

export function isDbClient(val: unknown): val is DbClient {
  return (
    typeof val === "object" &&
    val !== null &&
    ("select" in val || "query" in val || "transaction" in val)
  );
}

function resolveQueryContext(
  arg1?: unknown,
  arg2?: unknown,
  arg3?: unknown,
  arg4?: unknown
): {
  dateRange: DashboardDateRange;
  assigneeId?: string;
  pipelineId?: string;
  dbInstance: DbClient;
} {
  let dbInstance: DbClient = db as DbClient;
  let dateRange: DashboardDateRange = resolveDateRange();
  let assigneeId: string | undefined = undefined;
  let pipelineId: string | undefined = undefined;

  // Identify which argument is the DbClient
  if (isDbClient(arg4)) dbInstance = arg4;
  else if (isDbClient(arg3)) dbInstance = arg3;
  else if (isDbClient(arg2)) dbInstance = arg2;
  else if (isDbClient(arg1)) dbInstance = arg1;

  // Resolve arg1 if object (options or dateRange)
  if (typeof arg1 === "object" && arg1 !== null && !isDbClient(arg1)) {
    const obj = arg1 as Record<string, unknown>;
    if (obj.from instanceof Date && obj.to instanceof Date) {
      dateRange = {
        from: obj.from,
        to: obj.to,
        preset: obj.preset as DashboardDateRangePreset | undefined,
      };
    } else {
      const nestedRange = obj.dateRange as Record<string, unknown> | undefined;
      dateRange = resolveDateRange(
        (obj.preset as string) || (nestedRange?.preset as string),
        (obj.from as string | Date) || (nestedRange?.from as string | Date),
        (obj.to as string | Date) || (nestedRange?.to as string | Date)
      );
    }
    if (typeof obj.assigneeId === "string") assigneeId = obj.assigneeId;
    if (typeof obj.pipelineId === "string") pipelineId = obj.pipelineId;
  }

  // Positional string arguments
  if (typeof arg2 === "string") assigneeId = arg2;
  if (typeof arg3 === "string") pipelineId = arg3;

  return { dateRange, assigneeId, pipelineId, dbInstance };
}

/**
 * Validates that an assignee belongs to the target organization.
 */
export async function validateAssignee(
  organizationId: string,
  assigneeId: string,
  dbInstance: DbClient = db as DbClient
): Promise<string> {
  const [member] = await dbInstance
    .select({ userId: organizationMembers.userId })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.userId, assigneeId)
      )
    )
    .limit(1);

  if (!member) {
    throw new NotFoundError("Assignee not found in this organization.");
  }

  return member.userId;
}

/**
 * Validates that a pipeline belongs to the target organization and is active.
 */
export async function validatePipeline(
  organizationId: string,
  pipelineId: string,
  dbInstance: DbClient = db as DbClient
): Promise<string> {
  const [pipe] = await dbInstance
    .select({ id: pipelines.id })
    .from(pipelines)
    .where(
      and(
        eq(pipelines.organizationId, organizationId),
        eq(pipelines.id, pipelineId),
        isNull(pipelines.archivedAt)
      )
    )
    .limit(1);

  if (!pipe) {
    throw new NotFoundError("Pipeline not found in this organization.");
  }

  return pipe.id;
}

/**
 * Lead Status and Volume Metrics
 */
export async function getLeadMetrics(
  organizationId: string,
  arg1?: DashboardQueryOptions | DashboardDateRange | DbClient,
  arg2?: string | DbClient,
  arg3?: string | DbClient,
  arg4?: DbClient
): Promise<LeadMetrics> {
  const { dateRange, assigneeId, pipelineId, dbInstance } = resolveQueryContext(
    arg1,
    arg2,
    arg3,
    arg4
  );

  const baseConditions = [
    eq(leads.organizationId, organizationId),
    isNull(leads.archivedAt),
  ];

  if (assigneeId) {
    baseConditions.push(eq(leads.assignedToUserId, assigneeId));
  }
  if (pipelineId) {
    baseConditions.push(eq(leads.pipelineId, pipelineId));
  }

  // 1. Total leads all-time matching filters
  const [allTimeRow] = await dbInstance
    .select({ count: sql<number>`count(*)::int` })
    .from(leads)
    .where(and(...baseConditions));

  const totalAllTime = Number(allTimeRow?.count || 0);

  // 2. Range-filtered leads with status breakdown
  const rangeConditions = [
    ...baseConditions,
    gte(leads.createdAt, dateRange.from),
    lte(leads.createdAt, dateRange.to),
  ];

  const [rangeCounts] = await dbInstance
    .select({
      total: sql<number>`count(*)::int`,
      newCount: sql<number>`count(case when ${leads.status} = 'new' then 1 end)::int`,
      contactedCount: sql<number>`count(case when ${leads.status} = 'contacted' then 1 end)::int`,
      qualifiedCount: sql<number>`count(case when ${leads.status} = 'qualified' then 1 end)::int`,
      unqualifiedCount: sql<number>`count(case when ${leads.status} = 'unqualified' then 1 end)::int`,
      convertedCount: sql<number>`count(case when ${leads.status} = 'converted' then 1 end)::int`,
      lostCount: sql<number>`count(case when ${leads.status} = 'lost' then 1 end)::int`,
    })
    .from(leads)
    .where(and(...rangeConditions));

  const total = Number(rangeCounts?.total || 0);
  const newCount = Number(rangeCounts?.newCount || 0);
  const contactedCount = Number(rangeCounts?.contactedCount || 0);
  const qualifiedCount = Number(rangeCounts?.qualifiedCount || 0);
  const unqualifiedCount = Number(rangeCounts?.unqualifiedCount || 0);
  const convertedCount = Number(rangeCounts?.convertedCount || 0);
  const lostCount = Number(rangeCounts?.lostCount || 0);

  const countsMap: Record<LeadStatus, number> = {
    new: newCount,
    contacted: contactedCount,
    qualified: qualifiedCount,
    unqualified: unqualifiedCount,
    converted: convertedCount,
    lost: lostCount,
  };

  const statusBreakdown = LEAD_STATUSES.map((status) => {
    const count = countsMap[status] || 0;
    const percentage = total > 0 ? Number(((count / total) * 100).toFixed(1)) : 0;
    return {
      status,
      label: LEAD_STATUS_LABELS[status] || status,
      count,
      percentage,
    };
  });

  return {
    total,
    totalAllTime,
    new: newCount,
    contacted: contactedCount,
    qualified: qualifiedCount,
    unqualified: unqualifiedCount,
    converted: convertedCount,
    lost: lostCount,
    statusBreakdown,
  };
}

/**
 * Lead Acquisition Source Metrics
 */
export async function getLeadSourceMetrics(
  organizationId: string,
  arg1?: DashboardQueryOptions | DashboardDateRange | DbClient,
  arg2?: string | DbClient,
  arg3?: string | DbClient,
  arg4?: DbClient
): Promise<LeadSourceMetricItem[]> {
  const { dateRange, assigneeId, pipelineId, dbInstance } = resolveQueryContext(
    arg1,
    arg2,
    arg3,
    arg4
  );

  const conditions = [
    eq(leads.organizationId, organizationId),
    isNull(leads.archivedAt),
    gte(leads.createdAt, dateRange.from),
    lte(leads.createdAt, dateRange.to),
  ];

  if (assigneeId) {
    conditions.push(eq(leads.assignedToUserId, assigneeId));
  }
  if (pipelineId) {
    conditions.push(eq(leads.pipelineId, pipelineId));
  }

  const grouped = await dbInstance
    .select({
      source: leads.source,
      count: sql<number>`count(*)::int`,
    })
    .from(leads)
    .where(and(...conditions))
    .groupBy(leads.source);

  const total = grouped.reduce((acc, curr) => acc + Number(curr.count), 0);
  if (total === 0) {
    return [];
  }

  const countBySource = new Map<string, number>();
  grouped.forEach((g) => countBySource.set(g.source, Number(g.count)));

  return LEAD_SOURCES.map((source) => {
    const count = countBySource.get(source) || 0;
    const percentage = total > 0 ? Number(((count / total) * 100).toFixed(1)) : 0;
    return {
      source,
      label: LEAD_SOURCE_LABELS[source] || source,
      count,
      percentage,
    };
  })
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count);
}

/**
 * Pipeline & Stage Progression Metrics
 */
export async function getPipelineStageMetrics(
  organizationId: string,
  arg1?: DashboardQueryOptions | DashboardDateRange | string | DbClient,
  arg2?: string | DbClient,
  arg3?: DbClient
): Promise<PipelineMetricItem[]> {
  let dbInstance: DbClient = db as DbClient;
  let pipelineIdFilter: string | undefined = undefined;
  let assigneeId: string | undefined = undefined;

  if (isDbClient(arg3)) dbInstance = arg3;
  else if (isDbClient(arg2)) dbInstance = arg2;
  else if (isDbClient(arg1)) dbInstance = arg1;

  if (typeof arg1 === "string") {
    pipelineIdFilter = arg1;
  } else if (typeof arg1 === "object" && arg1 !== null && !isDbClient(arg1)) {
    const obj = arg1 as Record<string, unknown>;
    if (typeof obj.pipelineId === "string") pipelineIdFilter = obj.pipelineId;
    if (typeof obj.assigneeId === "string") assigneeId = obj.assigneeId;
  }

  if (typeof arg2 === "string") assigneeId = arg2;

  const pipeConditions = [
    eq(pipelines.organizationId, organizationId),
    isNull(pipelines.archivedAt),
    eq(pipelines.active, true),
  ];

  if (pipelineIdFilter) {
    pipeConditions.push(eq(pipelines.id, pipelineIdFilter));
  }

  const activePipelines = await dbInstance
    .select({
      id: pipelines.id,
      name: pipelines.name,
      isDefault: pipelines.isDefault,
      displayOrder: pipelines.displayOrder,
    })
    .from(pipelines)
    .where(and(...pipeConditions))
    .orderBy(asc(pipelines.displayOrder), asc(pipelines.createdAt));

  if (activePipelines.length === 0) {
    return [];
  }

  const pipelineIds = activePipelines.map((p) => p.id);

  // Fetch stages for these pipelines
  const stages = await dbInstance
    .select({
      id: pipelineStages.id,
      pipelineId: pipelineStages.pipelineId,
      name: pipelineStages.name,
      displayOrder: pipelineStages.displayOrder,
    })
    .from(pipelineStages)
    .where(
      and(
        eq(pipelineStages.organizationId, organizationId),
        inArray(pipelineStages.pipelineId, pipelineIds),
        isNull(pipelineStages.archivedAt),
        eq(pipelineStages.active, true)
      )
    )
    .orderBy(asc(pipelineStages.displayOrder));

  // Count leads by pipeline and stage
  const leadConditions = [
    eq(leads.organizationId, organizationId),
    isNull(leads.archivedAt),
    inArray(leads.pipelineId, pipelineIds),
  ];

  if (assigneeId) {
    leadConditions.push(eq(leads.assignedToUserId, assigneeId));
  }

  const stageCounts = await dbInstance
    .select({
      pipelineId: leads.pipelineId,
      stageId: leads.stageId,
      count: sql<number>`count(*)::int`,
    })
    .from(leads)
    .where(and(...leadConditions))
    .groupBy(leads.pipelineId, leads.stageId);

  const stageCountMap = new Map<string, number>();
  const pipelineTotalMap = new Map<string, number>();

  stageCounts.forEach((sc) => {
    if (sc.pipelineId && sc.stageId) {
      const key = `${sc.pipelineId}:${sc.stageId}`;
      const count = Number(sc.count);
      stageCountMap.set(key, count);
      pipelineTotalMap.set(
        sc.pipelineId,
        (pipelineTotalMap.get(sc.pipelineId) || 0) + count
      );
    }
  });

  return activePipelines.map((pipe) => {
    const pipeStages = stages.filter((s) => s.pipelineId === pipe.id);
    const totalLeads = pipelineTotalMap.get(pipe.id) || 0;

    const mappedStages = pipeStages.map((st) => {
      const count = stageCountMap.get(`${pipe.id}:${st.id}`) || 0;
      const percentage = totalLeads > 0 ? Number(((count / totalLeads) * 100).toFixed(1)) : 0;
      return {
        stageId: st.id,
        stageName: st.name,
        displayOrder: st.displayOrder,
        count,
        percentage,
      };
    });

    return {
      pipelineId: pipe.id,
      pipelineName: pipe.name,
      isDefault: pipe.isDefault,
      totalLeads,
      stages: mappedStages,
    };
  });
}

/**
 * Operational Follow-Up Metrics
 */
export async function getFollowUpMetrics(
  organizationId: string,
  arg1?: string | DashboardQueryOptions | DashboardDateRange | DbClient,
  arg2?: DashboardQueryOptions | DashboardDateRange | string | DbClient,
  arg3?: string | DbClient,
  arg4?: string | DbClient,
  arg5?: DbClient
): Promise<FollowUpMetrics> {
  let currentUserId = "";
  let argOptions: unknown = undefined;
  let argAssignee: unknown = undefined;
  let argPipeline: unknown = undefined;
  let argDb: unknown = undefined;

  if (typeof arg1 === "string") {
    currentUserId = arg1;
    argOptions = arg2;
    argAssignee = arg3;
    argPipeline = arg4;
    argDb = arg5;
  } else {
    argOptions = arg1;
    if (typeof arg2 === "string") currentUserId = arg2;
    argAssignee = arg3;
    argPipeline = arg4;
    argDb = arg5;
  }

  const { dateRange, assigneeId, pipelineId, dbInstance } = resolveQueryContext(
    argOptions,
    argAssignee,
    argPipeline,
    argDb
  );

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  // Calculate start and end of current week (Monday to Sunday)
  const currentDayOfWeek = now.getDay(); // 0 is Sunday
  const distanceToMonday = currentDayOfWeek === 0 ? -6 : 1 - currentDayOfWeek;
  const monday = new Date(now);
  monday.setDate(now.getDate() + distanceToMonday);
  const weekStartStr = monday.toISOString().slice(0, 10);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const weekEndStr = sunday.toISOString().slice(0, 10);

  const baseConditions = [
    eq(followUps.organizationId, organizationId),
    isNull(followUps.archivedAt),
  ];

  if (assigneeId) {
    baseConditions.push(eq(followUps.assignedToUserId, assigneeId));
  }

  // Pipeline condition requires joining with leads if pipeline filter is present
  if (pipelineId) {
    const matchingLeads = await dbInstance
      .select({ id: leads.id })
      .from(leads)
      .where(
        and(
          eq(leads.organizationId, organizationId),
          eq(leads.pipelineId, pipelineId),
          isNull(leads.archivedAt)
        )
      );

    const leadIds = matchingLeads.map((l) => l.id);
    if (leadIds.length === 0) {
      return {
        pending: 0,
        overdue: 0,
        dueToday: 0,
        dueThisWeek: 0,
        completed: 0,
        myPending: 0,
        myOverdue: 0,
      };
    }
    baseConditions.push(inArray(followUps.leadId, leadIds));
  }

  const [counts] = await dbInstance
    .select({
      pending: sql<number>`count(case when ${followUps.status} = 'pending' then 1 end)::int`,
      overdue: sql<number>`count(case when ${followUps.status} = 'pending' and ${followUps.dueDate} < ${todayStr} then 1 end)::int`,
      dueToday: sql<number>`count(case when ${followUps.status} = 'pending' and ${followUps.dueDate} = ${todayStr} then 1 end)::int`,
      dueThisWeek: sql<number>`count(case when ${followUps.status} = 'pending' and ${followUps.dueDate} >= ${weekStartStr} and ${followUps.dueDate} <= ${weekEndStr} then 1 end)::int`,
      completed: sql<number>`count(case when ${followUps.status} = 'completed' and ${followUps.completedAt} >= ${dateRange.from} and ${followUps.completedAt} <= ${dateRange.to} then 1 end)::int`,
      myPending: sql<number>`count(case when ${followUps.status} = 'pending' and ${followUps.assignedToUserId} = ${currentUserId} then 1 end)::int`,
      myOverdue: sql<number>`count(case when ${followUps.status} = 'pending' and ${followUps.assignedToUserId} = ${currentUserId} and ${followUps.dueDate} < ${todayStr} then 1 end)::int`,
    })
    .from(followUps)
    .where(and(...baseConditions));

  return {
    pending: Number(counts?.pending || 0),
    overdue: Number(counts?.overdue || 0),
    dueToday: Number(counts?.dueToday || 0),
    dueThisWeek: Number(counts?.dueThisWeek || 0),
    completed: Number(counts?.completed || 0),
    myPending: Number(counts?.myPending || 0),
    myOverdue: Number(counts?.myOverdue || 0),
  };
}

/**
 * Unified Activity Metrics
 */
export async function getActivityMetrics(
  organizationId: string,
  arg1?: DashboardQueryOptions | DashboardDateRange | DbClient,
  arg2?: string | DbClient,
  arg3?: DbClient
): Promise<ActivityMetrics> {
  const { dateRange, assigneeId, dbInstance } = resolveQueryContext(
    arg1,
    arg2,
    undefined,
    arg3
  );

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  const currentDayOfWeek = now.getDay();
  const distanceToMonday = currentDayOfWeek === 0 ? -6 : 1 - currentDayOfWeek;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() + distanceToMonday);
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  const conditions = [
    eq(activities.organizationId, organizationId),
    isNull(activities.archivedAt),
  ];

  if (assigneeId) {
    conditions.push(
      sql`(${activities.assignedToUserId} = ${assigneeId} or ${activities.createdByUserId} = ${assigneeId})`
    );
  }

  // 1. Overall volume counts
  const [vol] = await dbInstance
    .select({
      total: sql<number>`count(*)::int`,
      today: sql<number>`count(case when ${activities.createdAt} >= ${todayStart} and ${activities.createdAt} <= ${todayEnd} then 1 end)::int`,
      thisWeek: sql<number>`count(case when ${activities.createdAt} >= ${weekStart} and ${activities.createdAt} <= ${weekEnd} then 1 end)::int`,
      pending: sql<number>`count(case when ${activities.status} = 'pending' then 1 end)::int`,
      completed: sql<number>`count(case when ${activities.status} = 'completed' then 1 end)::int`,
    })
    .from(activities)
    .where(and(...conditions, gte(activities.createdAt, dateRange.from), lte(activities.createdAt, dateRange.to)));

  // 2. Type breakdown for the date range
  const typeCounts = await dbInstance
    .select({
      type: activities.type,
      count: sql<number>`count(*)::int`,
    })
    .from(activities)
    .where(and(...conditions, gte(activities.createdAt, dateRange.from), lte(activities.createdAt, dateRange.to)))
    .groupBy(activities.type);

  const byTypeMap = new Map<ActivityType, number>();
  typeCounts.forEach((tc) => {
    byTypeMap.set(tc.type as ActivityType, Number(tc.count));
  });

  const byType = {} as Record<ActivityType, number>;
  ACTIVITY_TYPES.forEach((typeKey) => {
    byType[typeKey] = byTypeMap.get(typeKey) || 0;
  });

  return {
    total: Number(vol?.total || 0),
    today: Number(vol?.today || 0),
    thisWeek: Number(vol?.thisWeek || 0),
    pending: Number(vol?.pending || 0),
    completed: Number(vol?.completed || 0),
    byType,
  };
}

/**
 * Deterministic Conversion Metrics
 */
export async function getConversionMetrics(
  organizationId: string,
  arg1?: DashboardQueryOptions | DashboardDateRange | DbClient,
  arg2?: string | DbClient,
  arg3?: string | DbClient,
  arg4?: DbClient
): Promise<ConversionMetrics> {
  const { dateRange, assigneeId, pipelineId, dbInstance } = resolveQueryContext(
    arg1,
    arg2,
    arg3,
    arg4
  );

  const baseConditions = [
    eq(leads.organizationId, organizationId),
    isNull(leads.archivedAt),
    gte(leads.createdAt, dateRange.from),
    lte(leads.createdAt, dateRange.to),
  ];

  if (assigneeId) {
    baseConditions.push(eq(leads.assignedToUserId, assigneeId));
  }
  if (pipelineId) {
    baseConditions.push(eq(leads.pipelineId, pipelineId));
  }

  // 1. Overall conversion
  const [overall] = await dbInstance
    .select({
      totalEligible: sql<number>`count(*)::int`,
      convertedCount: sql<number>`count(case when ${leads.status} = 'converted' then 1 end)::int`,
    })
    .from(leads)
    .where(and(...baseConditions));

  const totalEligibleLeads = Number(overall?.totalEligible || 0);
  const convertedLeads = Number(overall?.convertedCount || 0);
  const conversionRate =
    totalEligibleLeads > 0
      ? Number(((convertedLeads / totalEligibleLeads) * 100).toFixed(1))
      : 0;

  // 2. Conversion by Source
  const sourceStats = await dbInstance
    .select({
      source: leads.source,
      total: sql<number>`count(*)::int`,
      converted: sql<number>`count(case when ${leads.status} = 'converted' then 1 end)::int`,
    })
    .from(leads)
    .where(and(...baseConditions))
    .groupBy(leads.source);

  const bySource = sourceStats.map((st) => {
    const total = Number(st.total);
    const converted = Number(st.converted);
    const rate = total > 0 ? Number(((converted / total) * 100).toFixed(1)) : 0;
    return {
      source: st.source as LeadSource,
      label: LEAD_SOURCE_LABELS[st.source as LeadSource] || st.source,
      converted,
      total,
      rate,
    };
  }).sort((a, b) => b.converted - a.converted);

  // 3. Conversion by Assignee
  const assigneeStats = await dbInstance
    .select({
      userId: leads.assignedToUserId,
      userName: users.name,
      userEmail: users.email,
      total: sql<number>`count(*)::int`,
      converted: sql<number>`count(case when ${leads.status} = 'converted' then 1 end)::int`,
    })
    .from(leads)
    .innerJoin(users, eq(leads.assignedToUserId, users.id))
    .where(and(...baseConditions))
    .groupBy(leads.assignedToUserId, users.name, users.email);

  const byAssignee = assigneeStats.map((st) => {
    const total = Number(st.total);
    const converted = Number(st.converted);
    const rate = total > 0 ? Number(((converted / total) * 100).toFixed(1)) : 0;
    return {
      userId: st.userId!,
      name: st.userName || st.userEmail,
      email: st.userEmail,
      converted,
      total,
      rate,
    };
  }).sort((a, b) => b.converted - a.converted);

  return {
    convertedLeads,
    totalEligibleLeads,
    conversionRate,
    bySource,
    byAssignee,
  };
}

/**
 * Operational My Work Metrics for Logged In User
 */
export async function getMyWorkMetrics(
  organizationId: string,
  currentUserId: string,
  arg1?: DashboardQueryOptions | DashboardDateRange | DbClient,
  arg2?: DbClient
): Promise<MyWorkMetrics> {
  const { dateRange, dbInstance } = resolveQueryContext(arg1, undefined, undefined, arg2);

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  // 1. Assigned leads count
  const [leadRow] = await dbInstance
    .select({ count: sql<number>`count(*)::int` })
    .from(leads)
    .where(
      and(
        eq(leads.organizationId, organizationId),
        eq(leads.assignedToUserId, currentUserId),
        isNull(leads.archivedAt)
      )
    );

  const assignedLeadsCount = Number(leadRow?.count || 0);

  // 2. Follow-up counts for current user
  const [fuRow] = await dbInstance
    .select({
      pending: sql<number>`count(case when ${followUps.status} = 'pending' then 1 end)::int`,
      overdue: sql<number>`count(case when ${followUps.status} = 'pending' and ${followUps.dueDate} < ${todayStr} then 1 end)::int`,
      completed: sql<number>`count(case when ${followUps.status} = 'completed' and ${followUps.completedAt} >= ${dateRange.from} and ${followUps.completedAt} <= ${dateRange.to} then 1 end)::int`,
    })
    .from(followUps)
    .where(
      and(
        eq(followUps.organizationId, organizationId),
        eq(followUps.assignedToUserId, currentUserId),
        isNull(followUps.archivedAt)
      )
    );

  const pendingFollowUpsCount = Number(fuRow?.pending || 0);
  const overdueFollowUpsCount = Number(fuRow?.overdue || 0);
  const completedFollowUpsCount = Number(fuRow?.completed || 0);

  // 3. Top follow-ups due today for current user
  const dueTodayRows = await dbInstance
    .select({
      id: followUps.id,
      title: followUps.title,
      dueDate: followUps.dueDate,
      dueTime: followUps.dueTime,
      leadId: followUps.leadId,
      leadFirstName: leads.firstName,
      leadLastName: leads.lastName,
    })
    .from(followUps)
    .innerJoin(leads, eq(followUps.leadId, leads.id))
    .where(
      and(
        eq(followUps.organizationId, organizationId),
        eq(followUps.assignedToUserId, currentUserId),
        eq(followUps.status, "pending"),
        eq(followUps.dueDate, todayStr),
        isNull(followUps.archivedAt)
      )
    )
    .orderBy(asc(followUps.dueTime), asc(followUps.createdAt))
    .limit(5);

  const followUpsDueToday = dueTodayRows.map((r) => ({
    id: r.id,
    title: r.title,
    dueDate: r.dueDate,
    dueTime: r.dueTime,
    leadId: r.leadId!,
    leadName: `${r.leadFirstName} ${r.leadLastName || ""}`.trim(),
  }));

  const overdueRows = await dbInstance
    .select({
      id: followUps.id,
      title: followUps.title,
      dueDate: followUps.dueDate,
      dueTime: followUps.dueTime,
      leadId: followUps.leadId,
      leadFirstName: leads.firstName,
      leadLastName: leads.lastName,
    })
    .from(followUps)
    .innerJoin(leads, eq(followUps.leadId, leads.id))
    .where(
      and(
        eq(followUps.organizationId, organizationId),
        eq(followUps.assignedToUserId, currentUserId),
        eq(followUps.status, "pending"),
        lt(followUps.dueDate, todayStr),
        isNull(followUps.archivedAt)
      )
    )
    .orderBy(asc(followUps.dueDate), asc(followUps.dueTime))
    .limit(5);

  const overdueFollowUps = overdueRows.map((r) => ({
    id: r.id,
    title: r.title,
    dueDate: r.dueDate,
    dueTime: r.dueTime,
    leadId: r.leadId!,
    leadName: `${r.leadFirstName} ${r.leadLastName || ""}`.trim(),
  }));

  // 4. Recently assigned leads for current user
  const recentLeadsRows = await dbInstance
    .select({
      id: leads.id,
      firstName: leads.firstName,
      lastName: leads.lastName,
      email: leads.email,
      status: leads.status,
      createdAt: leads.createdAt,
    })
    .from(leads)
    .where(
      and(
        eq(leads.organizationId, organizationId),
        eq(leads.assignedToUserId, currentUserId),
        isNull(leads.archivedAt)
      )
    )
    .orderBy(desc(leads.createdAt))
    .limit(5);

  const recentAssignedLeads = recentLeadsRows.map((l) => ({
    id: l.id,
    name: `${l.firstName} ${l.lastName || ""}`.trim(),
    email: l.email,
    status: l.status as LeadStatus,
    createdAt: l.createdAt,
  }));

  // 5. Recent activities assigned to or created by current user
  const recentActRows = await dbInstance
    .select({
      id: activities.id,
      type: activities.type,
      title: activities.title,
      entityType: activities.entityType,
      entityId: activities.entityId,
      createdAt: activities.createdAt,
    })
    .from(activities)
    .where(
      and(
        eq(activities.organizationId, organizationId),
        sql`(${activities.assignedToUserId} = ${currentUserId} or ${activities.createdByUserId} = ${currentUserId})`,
        isNull(activities.archivedAt)
      )
    )
    .orderBy(desc(activities.createdAt))
    .limit(5);

  const recentActivities = recentActRows.map((a) => ({
    id: a.id,
    type: a.type as ActivityType,
    title: a.title,
    entityType: a.entityType,
    entityId: a.entityId,
    createdAt: a.createdAt,
  }));

  return {
    assignedLeadsCount,
    pendingFollowUpsCount,
    overdueFollowUpsCount,
    completedFollowUpsCount,
    overdueFollowUps,
    followUpsDueToday,
    recentAssignedLeads,
    recentActivities,
  };
}

/**
 * Deterministic Needs Attention Items
 */
export async function getNeedsAttentionItems(
  organizationId: string,
  arg1?: string | DashboardQueryOptions | DbClient,
  arg2?: DbClient
): Promise<NeedsAttentionItem[]> {
  let dbInstance: DbClient = db as DbClient;
  let assigneeIdFilter: string | undefined = undefined;

  if (isDbClient(arg2)) dbInstance = arg2;
  else if (isDbClient(arg1)) dbInstance = arg1;

  if (typeof arg1 === "string") {
    assigneeIdFilter = arg1;
  } else if (typeof arg1 === "object" && arg1 !== null && !isDbClient(arg1)) {
    const obj = arg1 as Record<string, unknown>;
    if (typeof obj.assigneeId === "string") assigneeIdFilter = obj.assigneeId;
  }

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const items: NeedsAttentionItem[] = [];

  // 1. Overdue follow-ups
  const fuConditions = [
    eq(followUps.organizationId, organizationId),
    eq(followUps.status, "pending"),
    lt(followUps.dueDate, todayStr),
    isNull(followUps.archivedAt),
  ];

  if (assigneeIdFilter) {
    fuConditions.push(eq(followUps.assignedToUserId, assigneeIdFilter));
  }

  const overdueFollowUps = await dbInstance
    .select({
      id: followUps.id,
      title: followUps.title,
      dueDate: followUps.dueDate,
      dueTime: followUps.dueTime,
      leadId: followUps.leadId,
      leadFirstName: leads.firstName,
      leadLastName: leads.lastName,
    })
    .from(followUps)
    .innerJoin(leads, eq(followUps.leadId, leads.id))
    .where(and(...fuConditions))
    .orderBy(asc(followUps.dueDate))
    .limit(6);

  for (const fu of overdueFollowUps) {
    items.push({
      id: `overdue_fu_${fu.id}`,
      category: "overdue_follow_up",
      title: `Overdue Follow-up: ${fu.title}`,
      description: `Due on ${fu.dueDate}${fu.dueTime ? ` at ${fu.dueTime}` : ""}`,
      entityType: "lead",
      entityId: fu.leadId!,
      entityName: `${fu.leadFirstName} ${fu.leadLastName || ""}`.trim(),
      urgency: "high",
      timestamp: fu.dueDate,
      link: `/leads/${fu.leadId!}`,
    });
  }

  // 2. Pending activities past due
  const actConditions = [
    eq(activities.organizationId, organizationId),
    eq(activities.status, "pending"),
    lt(activities.dueAt, now),
    isNull(activities.archivedAt),
  ];

  if (assigneeIdFilter) {
    actConditions.push(
      sql`(${activities.assignedToUserId} = ${assigneeIdFilter} or ${activities.createdByUserId} = ${assigneeIdFilter})`
    );
  }

  const pastDueActivities = await dbInstance
    .select({
      id: activities.id,
      title: activities.title,
      type: activities.type,
      dueAt: activities.dueAt,
      entityType: activities.entityType,
      entityId: activities.entityId,
    })
    .from(activities)
    .where(and(...actConditions))
    .orderBy(asc(activities.dueAt))
    .limit(6);

  for (const act of pastDueActivities) {
    const route =
      act.entityType === "contact"
        ? `/contacts/${act.entityId}`
        : act.entityType === "company"
        ? `/companies/${act.entityId}`
        : `/leads/${act.entityId}`;

    items.push({
      id: `past_due_act_${act.id}`,
      category: "past_due_activity",
      title: `Overdue Activity: ${act.title}`,
      description: `Task past due date`,
      entityType: act.entityType as "lead" | "contact" | "company",
      entityId: act.entityId,
      entityName: `${act.entityType.toUpperCase()} ${act.entityId.slice(0, 8)}`,
      urgency: "high",
      timestamp: act.dueAt || now,
      link: route,
    });
  }

  // 3. Active Leads with no pending follow-up (Needs Next Action)
  const leadConditions = [
    eq(leads.organizationId, organizationId),
    isNull(leads.archivedAt),
    sql`${leads.status} NOT IN ('converted', 'lost')`,
  ];

  if (assigneeIdFilter) {
    leadConditions.push(eq(leads.assignedToUserId, assigneeIdFilter));
  }

  // Active leads without pending follow-up
  const leadsWithoutAction = await dbInstance
    .select({
      id: leads.id,
      firstName: leads.firstName,
      lastName: leads.lastName,
      status: leads.status,
      updatedAt: leads.updatedAt,
    })
    .from(leads)
    .where(
      and(
        ...leadConditions,
        sql`NOT EXISTS (
          SELECT 1 FROM ${followUps}
          WHERE ${followUps.leadId} = ${leads.id}
            AND ${followUps.status} = 'pending'
            AND ${followUps.archivedAt} IS NULL
        )`
      )
    )
    .orderBy(desc(leads.updatedAt))
    .limit(6);

  for (const l of leadsWithoutAction) {
    items.push({
      id: `no_action_lead_${l.id}`,
      category: "no_next_action",
      title: `No Next Action: ${l.firstName} ${l.lastName || ""}`.trim(),
      description: `Status: ${l.status}. No follow-up scheduled.`,
      entityType: "lead",
      entityId: l.id,
      entityName: `${l.firstName} ${l.lastName || ""}`.trim(),
      urgency: "medium",
      timestamp: l.updatedAt,
      link: `/leads/${l.id}`,
    });
  }

  return items;
}

/**
 * Unified Dashboard Service
 */
export async function getDashboardData(
  organizationId: string,
  currentUserId: string,
  rawFilters?: Partial<DashboardFilters> & { preset?: string; from?: string | Date; to?: string | Date },
  dbInstance: DbClient = db as DbClient
): Promise<DashboardData> {
  // 1. Resolve date range
  const dateRange = resolveDateRange(
    rawFilters?.dateRange?.preset || rawFilters?.preset,
    rawFilters?.dateRange?.from || rawFilters?.from,
    rawFilters?.dateRange?.to || rawFilters?.to
  );

  // 2. Resolve & validate assignee filter
  let resolvedAssigneeId: string | undefined = undefined;
  if (rawFilters?.assigneeId && rawFilters.assigneeId !== "all") {
    if (rawFilters.assigneeId === "me") {
      resolvedAssigneeId = currentUserId;
    } else {
      resolvedAssigneeId = await validateAssignee(organizationId, rawFilters.assigneeId, dbInstance);
    }
  }

  // 3. Resolve & validate pipeline filter
  let resolvedPipelineId: string | undefined = undefined;
  if (rawFilters?.pipelineId && rawFilters.pipelineId !== "all") {
    resolvedPipelineId = await validatePipeline(organizationId, rawFilters.pipelineId, dbInstance);
  }

  // 4. Execute all analytics queries in parallel
  const [
    leadsMetrics,
    sourcesMetrics,
    pipelineMetrics,
    followUpsMetrics,
    activityMetrics,
    conversionMetrics,
    myWorkMetrics,
    needsAttentionItems,
  ] = await Promise.all([
    getLeadMetrics(organizationId, { dateRange, assigneeId: resolvedAssigneeId, pipelineId: resolvedPipelineId }, dbInstance),
    getLeadSourceMetrics(organizationId, { dateRange, assigneeId: resolvedAssigneeId, pipelineId: resolvedPipelineId }, dbInstance),
    getPipelineStageMetrics(organizationId, { pipelineId: resolvedPipelineId, assigneeId: resolvedAssigneeId }, dbInstance),
    getFollowUpMetrics(organizationId, currentUserId, { dateRange, assigneeId: resolvedAssigneeId, pipelineId: resolvedPipelineId }, dbInstance),
    getActivityMetrics(organizationId, { dateRange, assigneeId: resolvedAssigneeId }, dbInstance),
    getConversionMetrics(organizationId, { dateRange, assigneeId: resolvedAssigneeId, pipelineId: resolvedPipelineId }, dbInstance),
    getMyWorkMetrics(organizationId, currentUserId, { dateRange }, dbInstance),
    getNeedsAttentionItems(organizationId, { assigneeId: resolvedAssigneeId }, dbInstance),
  ]);

  return {
    dateRange: {
      from: dateRange.from.toISOString(),
      to: dateRange.to.toISOString(),
      preset: dateRange.preset || "last_30_days",
    },
    leads: leadsMetrics,
    sources: sourcesMetrics,
    pipelines: pipelineMetrics,
    followUps: followUpsMetrics,
    activities: activityMetrics,
    conversion: conversionMetrics,
    myWork: myWorkMetrics,
    needsAttention: needsAttentionItems,
  };
}
