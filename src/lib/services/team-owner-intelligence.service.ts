import { db } from "@/db";
import { DbClient } from "@/db/types";
import {
  leads,
  deals,
  followUps,
  activities,
  users,
  organizationMembers,
  teams,
  teamMembers,
} from "@/db/schema";
import {
  type DashboardQueryOptions,
  type DashboardDateRange,
  type DashboardDateRangePreset,
} from "@/lib/types/dashboard";
import {
  type TeamAndOwnerIntelligenceData,
  type OwnerIntelligenceItem,
  type TeamIntelligenceItem,
  type UnassignedWorkload,
  type WorkloadConcentrationIndicators,
  type CurrencyAmountMap,
} from "@/lib/types/team-owner-intelligence";
import { resolveDateRange } from "@/lib/utils/date-range-utils";
import { eq, and, isNull, gte, lte, asc, sql } from "drizzle-orm";

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

  if (isDbClient(arg4)) dbInstance = arg4;
  else if (isDbClient(arg3)) dbInstance = arg3;
  else if (isDbClient(arg2)) dbInstance = arg2;
  else if (isDbClient(arg1)) dbInstance = arg1;

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

  if (typeof arg2 === "string") assigneeId = arg2;
  if (typeof arg3 === "string") pipelineId = arg3;

  return { dateRange, assigneeId, pipelineId, dbInstance };
}

/**
 * 1. Owner Intelligence
 * Calculates deterministic workload and performance metrics per owner.
 */
export async function getOwnerIntelligence(
  organizationId: string,
  options?: DashboardQueryOptions | DashboardDateRange,
  assigneeFilterArg?: string,
  pipelineFilterArg?: string,
  dbClientArg?: DbClient
): Promise<OwnerIntelligenceItem[]> {
  const { dateRange, assigneeId, pipelineId, dbInstance } = resolveQueryContext(
    options,
    assigneeFilterArg,
    pipelineFilterArg,
    dbClientArg
  );

  const todayStr = new Date().toISOString().split("T")[0];

  // 1. Fetch all distinct owners in organization (members + assigned users)
  const memberRows = await dbInstance
    .select({
      userId: users.id,
      name: users.name,
      email: users.email,
    })
    .from(organizationMembers)
    .innerJoin(users, eq(organizationMembers.userId, users.id))
    .where(eq(organizationMembers.organizationId, organizationId));

  const userMap = new Map<string, { userId: string; name: string; email: string }>();
  for (const m of memberRows) {
    userMap.set(m.userId, m);
  }

  // 2. Fetch team memberships for users in this organization
  const teamMemberRows = await dbInstance
    .select({
      userId: teamMembers.userId,
      teamId: teams.id,
      teamName: teams.name,
    })
    .from(teamMembers)
    .innerJoin(teams, eq(teamMembers.teamId, teams.id))
    .where(
      and(
        eq(teamMembers.organizationId, organizationId),
        isNull(teams.archivedAt)
      )
    );

  const userTeamsMap = new Map<string, Array<{ id: string; name: string }>>();
  for (const row of teamMemberRows) {
    const list = userTeamsMap.get(row.userId) || [];
    list.push({ id: row.teamId, name: row.teamName });
    userTeamsMap.set(row.userId, list);
  }

  // Filter conditions for leads
  const leadConditions = [
    eq(leads.organizationId, organizationId),
    isNull(leads.archivedAt),
    gte(leads.createdAt, dateRange.from),
    lte(leads.createdAt, dateRange.to),
  ];
  if (pipelineId && pipelineId !== "all") {
    leadConditions.push(eq(leads.pipelineId, pipelineId));
  }

  // 3. Lead workload aggregated by assignedToUserId
  const leadAggRows = await dbInstance
    .select({
      assignedToUserId: leads.assignedToUserId,
      totalLeads: sql<number>`cast(count(${leads.id}) as int)`,
      newLeads: sql<number>`cast(count(case when ${leads.status} = 'new' then 1 end) as int)`,
      contactedLeads: sql<number>`cast(count(case when ${leads.status} = 'contacted' then 1 end) as int)`,
      qualifiedLeads: sql<number>`cast(count(case when ${leads.status} = 'qualified' then 1 end) as int)`,
      unqualifiedLeads: sql<number>`cast(count(case when ${leads.status} = 'unqualified' then 1 end) as int)`,
      convertedLeads: sql<number>`cast(count(case when ${leads.status} = 'converted' then 1 end) as int)`,
      lostLeads: sql<number>`cast(count(case when ${leads.status} = 'lost' then 1 end) as int)`,
    })
    .from(leads)
    .where(and(...leadConditions))
    .groupBy(leads.assignedToUserId);

  // Filter conditions for deals
  const dealConditions = [
    eq(deals.organizationId, organizationId),
    isNull(deals.archivedAt),
    gte(deals.createdAt, dateRange.from),
    lte(deals.createdAt, dateRange.to),
  ];
  if (pipelineId && pipelineId !== "all") {
    dealConditions.push(eq(deals.pipelineId, pipelineId));
  }

  // 4. Deal workload aggregated by ownerUserId
  const dealAggRows = await dbInstance
    .select({
      ownerUserId: deals.ownerUserId,
      totalDeals: sql<number>`cast(count(${deals.id}) as int)`,
      openDeals: sql<number>`cast(count(case when ${deals.status} = 'open' then 1 end) as int)`,
      wonDeals: sql<number>`cast(count(case when ${deals.status} = 'won' then 1 end) as int)`,
      lostDeals: sql<number>`cast(count(case when ${deals.status} = 'lost' then 1 end) as int)`,
    })
    .from(deals)
    .where(and(...dealConditions))
    .groupBy(deals.ownerUserId);

  // 5. Deal financial values grouped by ownerUserId, currency, and status
  const dealValueRows = await dbInstance
    .select({
      ownerUserId: deals.ownerUserId,
      currency: deals.currency,
      status: deals.status,
      totalValue: sql<string>`coalesce(sum(${deals.value}), 0)`,
    })
    .from(deals)
    .where(and(...dealConditions))
    .groupBy(deals.ownerUserId, deals.currency, deals.status);

  // 6. Follow-up workload aggregated by assignedToUserId
  const followUpConditions = [
    eq(followUps.organizationId, organizationId),
    isNull(followUps.archivedAt),
    gte(followUps.createdAt, dateRange.from),
    lte(followUps.createdAt, dateRange.to),
  ];

  const followUpAggRows = await dbInstance
    .select({
      assignedToUserId: followUps.assignedToUserId,
      totalFollowUps: sql<number>`cast(count(${followUps.id}) as int)`,
      pendingFollowUps: sql<number>`cast(count(case when ${followUps.status} = 'pending' then 1 end) as int)`,
      completedFollowUps: sql<number>`cast(count(case when ${followUps.status} = 'completed' then 1 end) as int)`,
      overdueFollowUps: sql<number>`cast(count(case when ${followUps.status} = 'pending' and ${followUps.dueDate} < ${todayStr} then 1 end) as int)`,
      dueTodayFollowUps: sql<number>`cast(count(case when ${followUps.status} = 'pending' and ${followUps.dueDate} = ${todayStr} then 1 end) as int)`,
      upcomingFollowUps: sql<number>`cast(count(case when ${followUps.status} = 'pending' and ${followUps.dueDate} > ${todayStr} then 1 end) as int)`,
    })
    .from(followUps)
    .where(and(...followUpConditions))
    .groupBy(followUps.assignedToUserId);

  // 7. Operational activities aggregated by assignedToUserId
  const activityConditions = [
    eq(activities.organizationId, organizationId),
    isNull(activities.archivedAt),
    gte(activities.createdAt, dateRange.from),
    lte(activities.createdAt, dateRange.to),
  ];

  const activityAggRows = await dbInstance
    .select({
      assignedToUserId: activities.assignedToUserId,
      type: activities.type,
      status: activities.status,
      count: sql<number>`cast(count(${activities.id}) as int)`,
    })
    .from(activities)
    .where(and(...activityConditions))
    .groupBy(activities.assignedToUserId, activities.type, activities.status);

  // Calculate Organization-level totals for workload concentration
  let orgTotalLeads = 0;
  let orgOpenDeals = 0;

  const leadDataByOwner = new Map<string, typeof leadAggRows[0]>();
  for (const r of leadAggRows) {
    if (r.assignedToUserId) {
      leadDataByOwner.set(r.assignedToUserId, r);
      orgTotalLeads += r.totalLeads;
    }
  }

  const dealDataByOwner = new Map<string, typeof dealAggRows[0]>();
  for (const r of dealAggRows) {
    if (r.ownerUserId) {
      dealDataByOwner.set(r.ownerUserId, r);
      orgOpenDeals += r.openDeals;
    }
  }

  const dealValuesByOwner = new Map<
    string,
    {
      open: CurrencyAmountMap;
      won: CurrencyAmountMap;
      lost: CurrencyAmountMap;
      closed: CurrencyAmountMap;
    }
  >();

  for (const r of dealValueRows) {
    if (!r.ownerUserId) continue;
    const curr = r.currency || "USD";
    const val = parseFloat(r.totalValue) || 0;

    let ownerVals = dealValuesByOwner.get(r.ownerUserId);
    if (!ownerVals) {
      ownerVals = { open: {}, won: {}, lost: {}, closed: {} };
      dealValuesByOwner.set(r.ownerUserId, ownerVals);
    }

    if (r.status === "open") {
      ownerVals.open[curr] = (ownerVals.open[curr] || 0) + val;
    } else if (r.status === "won") {
      ownerVals.won[curr] = (ownerVals.won[curr] || 0) + val;
      ownerVals.closed[curr] = (ownerVals.closed[curr] || 0) + val;
    } else if (r.status === "lost") {
      ownerVals.lost[curr] = (ownerVals.lost[curr] || 0) + val;
      ownerVals.closed[curr] = (ownerVals.closed[curr] || 0) + val;
    }
  }

  const followUpDataByOwner = new Map<string, typeof followUpAggRows[0]>();
  for (const r of followUpAggRows) {
    if (r.assignedToUserId) {
      followUpDataByOwner.set(r.assignedToUserId, r);
    }
  }

  const activityDataByOwner = new Map<
    string,
    { total: number; completed: number; pending: number; byType: Record<string, number> }
  >();

  for (const r of activityAggRows) {
    if (!r.assignedToUserId) continue;
    let curr = activityDataByOwner.get(r.assignedToUserId);
    if (!curr) {
      curr = { total: 0, completed: 0, pending: 0, byType: {} };
      activityDataByOwner.set(r.assignedToUserId, curr);
    }
    curr.total += r.count;
    if (r.status === "completed") curr.completed += r.count;
    if (r.status === "pending") curr.pending += r.count;
    curr.byType[r.type] = (curr.byType[r.type] || 0) + r.count;
  }

  // Construct Owner Items
  const items: OwnerIntelligenceItem[] = [];

  for (const [userId, userInfo] of userMap.entries()) {
    // If assigneeFilter is set and not "all", include only this user
    if (assigneeId && assigneeId !== "all" && userId !== assigneeId) {
      continue;
    }

    const leadInfo = leadDataByOwner.get(userId) || {
      assignedToUserId: userId,
      totalLeads: 0,
      newLeads: 0,
      contactedLeads: 0,
      qualifiedLeads: 0,
      unqualifiedLeads: 0,
      convertedLeads: 0,
      lostLeads: 0,
    };

    const totalLeads = leadInfo.totalLeads;
    const qualificationRate =
      totalLeads > 0
        ? Number((((leadInfo.qualifiedLeads + leadInfo.convertedLeads) / totalLeads) * 100).toFixed(1))
        : 0;
    const conversionRate =
      totalLeads > 0
        ? Number(((leadInfo.convertedLeads / totalLeads) * 100).toFixed(1))
        : 0;
    const lostRate =
      totalLeads > 0
        ? Number(((leadInfo.lostLeads / totalLeads) * 100).toFixed(1))
        : 0;

    const dealInfo = dealDataByOwner.get(userId) || {
      ownerUserId: userId,
      totalDeals: 0,
      openDeals: 0,
      wonDeals: 0,
      lostDeals: 0,
    };

    const closedDeals = dealInfo.wonDeals + dealInfo.lostDeals;
    const winRate =
      closedDeals > 0
        ? Number(((dealInfo.wonDeals / closedDeals) * 100).toFixed(1))
        : 0;
    const hasSufficientClosedDeals = closedDeals >= 3;

    const dealVals = dealValuesByOwner.get(userId) || {
      open: {},
      won: {},
      lost: {},
      closed: {},
    };

    const fuInfo = followUpDataByOwner.get(userId) || {
      assignedToUserId: userId,
      totalFollowUps: 0,
      pendingFollowUps: 0,
      completedFollowUps: 0,
      overdueFollowUps: 0,
      dueTodayFollowUps: 0,
      upcomingFollowUps: 0,
    };

    const actInfo = activityDataByOwner.get(userId) || {
      total: 0,
      completed: 0,
      pending: 0,
      byType: {},
    };

    const leadSharePercentage =
      orgTotalLeads > 0
        ? Number(((totalLeads / orgTotalLeads) * 100).toFixed(1))
        : 0;

    const openDealSharePercentage =
      orgOpenDeals > 0
        ? Number(((dealInfo.openDeals / orgOpenDeals) * 100).toFixed(1))
        : 0;

    items.push({
      userId,
      name: userInfo.name,
      email: userInfo.email,
      teams: userTeamsMap.get(userId) || [],
      leads: {
        totalLeads,
        newLeads: leadInfo.newLeads,
        contactedLeads: leadInfo.contactedLeads,
        qualifiedLeads: leadInfo.qualifiedLeads,
        unqualifiedLeads: leadInfo.unqualifiedLeads,
        convertedLeads: leadInfo.convertedLeads,
        lostLeads: leadInfo.lostLeads,
      },
      leadPerformance: {
        qualificationRate,
        conversionRate,
        lostRate,
      },
      deals: {
        totalDeals: dealInfo.totalDeals,
        openDeals: dealInfo.openDeals,
        wonDeals: dealInfo.wonDeals,
        lostDeals: dealInfo.lostDeals,
        closedDeals,
        winRate,
        hasSufficientClosedDeals,
      },
      dealValue: {
        openValueByCurrency: dealVals.open,
        wonValueByCurrency: dealVals.won,
        lostValueByCurrency: dealVals.lost,
        totalClosedValueByCurrency: dealVals.closed,
      },
      followUps: {
        totalFollowUps: fuInfo.totalFollowUps,
        pendingFollowUps: fuInfo.pendingFollowUps,
        completedFollowUps: fuInfo.completedFollowUps,
        overdueFollowUps: fuInfo.overdueFollowUps,
        dueTodayFollowUps: fuInfo.dueTodayFollowUps,
        upcomingFollowUps: fuInfo.upcomingFollowUps,
      },
      activities: {
        totalActivities: actInfo.total,
        completedActivities: actInfo.completed,
        pendingActivities: actInfo.pending,
        byType: actInfo.byType,
      },
      concentration: {
        leadSharePercentage,
        openDealSharePercentage,
      },
    });
  }

  // Sort descending by total assigned leads, then name
  return items.sort((a, b) => b.leads.totalLeads - a.leads.totalLeads || a.name.localeCompare(b.name));
}

/**
 * 2. Unassigned Workload
 * Evaluates records without an assigned owner or deal owner.
 */
export async function getUnassignedWorkload(
  organizationId: string,
  options?: DashboardQueryOptions | DashboardDateRange,
  assigneeFilterArg?: string,
  pipelineFilterArg?: string,
  dbClientArg?: DbClient
): Promise<UnassignedWorkload> {
  const { dateRange, pipelineId, dbInstance } = resolveQueryContext(
    options,
    assigneeFilterArg,
    pipelineFilterArg,
    dbClientArg
  );

  // 1. Unassigned leads
  const leadConditions = [
    eq(leads.organizationId, organizationId),
    isNull(leads.archivedAt),
    isNull(leads.assignedToUserId),
    gte(leads.createdAt, dateRange.from),
    lte(leads.createdAt, dateRange.to),
  ];
  if (pipelineId && pipelineId !== "all") {
    leadConditions.push(eq(leads.pipelineId, pipelineId));
  }

  const [leadRow] = await dbInstance
    .select({ count: sql<number>`cast(count(${leads.id}) as int)` })
    .from(leads)
    .where(and(...leadConditions));

  const unassignedLeads = leadRow?.count || 0;

  // 2. Unassigned deals
  const dealConditions = [
    eq(deals.organizationId, organizationId),
    isNull(deals.archivedAt),
    isNull(deals.ownerUserId),
    gte(deals.createdAt, dateRange.from),
    lte(deals.createdAt, dateRange.to),
  ];
  if (pipelineId && pipelineId !== "all") {
    dealConditions.push(eq(deals.pipelineId, pipelineId));
  }

  const dealAggRows = await dbInstance
    .select({
      status: deals.status,
      count: sql<number>`cast(count(${deals.id}) as int)`,
    })
    .from(deals)
    .where(and(...dealConditions))
    .groupBy(deals.status);

  let openDeals = 0;
  let wonDeals = 0;
  let lostDeals = 0;

  for (const r of dealAggRows) {
    if (r.status === "open") openDeals = r.count;
    else if (r.status === "won") wonDeals = r.count;
    else if (r.status === "lost") lostDeals = r.count;
  }

  // Unassigned open deal value grouped by currency
  const dealValueRows = await dbInstance
    .select({
      currency: deals.currency,
      totalValue: sql<string>`coalesce(sum(${deals.value}), 0)`,
    })
    .from(deals)
    .where(and(...dealConditions, eq(deals.status, "open")))
    .groupBy(deals.currency);

  const openValueMap: CurrencyAmountMap = {};
  for (const r of dealValueRows) {
    const curr = r.currency || "USD";
    openValueMap[curr] = parseFloat(r.totalValue) || 0;
  }

  // 3. Unassigned follow-ups
  const fuConditions = [
    eq(followUps.organizationId, organizationId),
    isNull(followUps.archivedAt),
    isNull(followUps.assignedToUserId),
    gte(followUps.createdAt, dateRange.from),
    lte(followUps.createdAt, dateRange.to),
  ];

  const [fuRow] = await dbInstance
    .select({ count: sql<number>`cast(count(${followUps.id}) as int)` })
    .from(followUps)
    .where(and(...fuConditions));

  const unassignedFollowUps = fuRow?.count || 0;

  return {
    unassignedLeads,
    unassignedOpenDeals: openDeals,
    unassignedFollowUps,
    unassignedDealsByStatus: {
      open: openDeals,
      won: wonDeals,
      lost: lostDeals,
    },
    unassignedOpenDealValueByCurrency: openValueMap,
  };
}

/**
 * 3. Team Intelligence
 * Aggregates owner intelligence across teams.
 */
export async function getTeamIntelligence(
  organizationId: string,
  options?: DashboardQueryOptions | DashboardDateRange,
  assigneeFilterArg?: string,
  pipelineFilterArg?: string,
  dbClientArg?: DbClient
): Promise<TeamIntelligenceItem[]> {
  const { dbInstance } = resolveQueryContext(
    options,
    assigneeFilterArg,
    pipelineFilterArg,
    dbClientArg
  );

  // 1. Fetch active teams in the organization
  const teamRows = await dbInstance
    .select()
    .from(teams)
    .where(
      and(
        eq(teams.organizationId, organizationId),
        isNull(teams.archivedAt)
      )
    )
    .orderBy(asc(teams.name));

  if (teamRows.length === 0) {
    return [];
  }

  // 2. Fetch team memberships
  const memberRows = await dbInstance
    .select({
      teamId: teamMembers.teamId,
      userId: teamMembers.userId,
    })
    .from(teamMembers)
    .where(eq(teamMembers.organizationId, organizationId));

  const teamMembersMap = new Map<string, string[]>();
  for (const r of memberRows) {
    const list = teamMembersMap.get(r.teamId) || [];
    list.push(r.userId);
    teamMembersMap.set(r.teamId, list);
  }

  // 3. Fetch owner intelligence to aggregate
  const ownerItems = await getOwnerIntelligence(
    organizationId,
    options,
    assigneeFilterArg,
    pipelineFilterArg,
    dbInstance
  );

  const ownerMap = new Map<string, OwnerIntelligenceItem>();
  for (const o of ownerItems) {
    ownerMap.set(o.userId, o);
  }

  // 4. Aggregate metrics for each team
  const result: TeamIntelligenceItem[] = [];

  for (const t of teamRows) {
    const memberUserIds = teamMembersMap.get(t.id) || [];

    let totalLeads = 0;
    let qualifiedLeads = 0;
    let convertedLeads = 0;
    let openDeals = 0;
    let wonDeals = 0;
    let lostDeals = 0;
    let overdueFollowUps = 0;
    let completedFollowUps = 0;
    let activityVolume = 0;
    const openValueByCurrency: CurrencyAmountMap = {};
    const wonValueByCurrency: CurrencyAmountMap = {};

    for (const userId of memberUserIds) {
      const owner = ownerMap.get(userId);
      if (!owner) continue;

      totalLeads += owner.leads.totalLeads;
      qualifiedLeads += owner.leads.qualifiedLeads;
      convertedLeads += owner.leads.convertedLeads;
      openDeals += owner.deals.openDeals;
      wonDeals += owner.deals.wonDeals;
      lostDeals += owner.deals.lostDeals;
      overdueFollowUps += owner.followUps.overdueFollowUps;
      completedFollowUps += owner.followUps.completedFollowUps;
      activityVolume += owner.activities.totalActivities;

      for (const [curr, amt] of Object.entries(owner.dealValue.openValueByCurrency)) {
        openValueByCurrency[curr] = (openValueByCurrency[curr] || 0) + amt;
      }
      for (const [curr, amt] of Object.entries(owner.dealValue.wonValueByCurrency)) {
        wonValueByCurrency[curr] = (wonValueByCurrency[curr] || 0) + amt;
      }
    }

    const closedDeals = wonDeals + lostDeals;
    const winRate =
      closedDeals > 0
        ? Number(((wonDeals / closedDeals) * 100).toFixed(1))
        : 0;
    const hasSufficientClosedDeals = closedDeals >= 3;

    result.push({
      teamId: t.id,
      name: t.name,
      description: t.description,
      memberCount: memberUserIds.length,
      memberUserIds,
      totalLeads,
      qualifiedLeads,
      convertedLeads,
      openDeals,
      wonDeals,
      lostDeals,
      closedDeals,
      winRate,
      hasSufficientClosedDeals,
      overdueFollowUps,
      completedFollowUps,
      activityVolume,
      openValueByCurrency,
      wonValueByCurrency,
    });
  }

  return result.sort((a, b) => b.totalLeads - a.totalLeads || a.name.localeCompare(b.name));
}

/**
 * 4. Consolidated Team & Owner Intelligence
 */
export async function getTeamAndOwnerIntelligence(
  organizationId: string,
  options?: DashboardQueryOptions | DashboardDateRange,
  assigneeFilterArg?: string,
  pipelineFilterArg?: string,
  dbClientArg?: DbClient
): Promise<TeamAndOwnerIntelligenceData> {
  const { dbInstance } = resolveQueryContext(
    options,
    assigneeFilterArg,
    pipelineFilterArg,
    dbClientArg
  );

  const [owners, teamsList, unassigned] = await Promise.all([
    getOwnerIntelligence(organizationId, options, assigneeFilterArg, pipelineFilterArg, dbInstance),
    getTeamIntelligence(organizationId, options, assigneeFilterArg, pipelineFilterArg, dbInstance),
    getUnassignedWorkload(organizationId, options, assigneeFilterArg, pipelineFilterArg, dbInstance),
  ]);

  // Compute workload concentration indicators using neutral, objective metrics
  let highestLeadWorkload: { userId: string; name: string; count: number } | null = null;
  let highestOpenDealWorkload: { userId: string; name: string; count: number } | null = null;
  let highestOverdueFollowUps: { userId: string; name: string; count: number } | null = null;
  let highestActivityVolume: { userId: string; name: string; count: number } | null = null;

  for (const o of owners) {
    if (o.leads.totalLeads > 0) {
      if (!highestLeadWorkload || o.leads.totalLeads > highestLeadWorkload.count) {
        highestLeadWorkload = { userId: o.userId, name: o.name, count: o.leads.totalLeads };
      }
    }
    if (o.deals.openDeals > 0) {
      if (!highestOpenDealWorkload || o.deals.openDeals > highestOpenDealWorkload.count) {
        highestOpenDealWorkload = { userId: o.userId, name: o.name, count: o.deals.openDeals };
      }
    }
    if (o.followUps.overdueFollowUps > 0) {
      if (!highestOverdueFollowUps || o.followUps.overdueFollowUps > highestOverdueFollowUps.count) {
        highestOverdueFollowUps = { userId: o.userId, name: o.name, count: o.followUps.overdueFollowUps };
      }
    }
    if (o.activities.totalActivities > 0) {
      if (!highestActivityVolume || o.activities.totalActivities > highestActivityVolume.count) {
        highestActivityVolume = { userId: o.userId, name: o.name, count: o.activities.totalActivities };
      }
    }
  }

  const indicators: WorkloadConcentrationIndicators = {
    highestLeadWorkload,
    highestOpenDealWorkload,
    highestOverdueFollowUps,
    highestActivityVolume,
  };

  return {
    owners,
    teams: teamsList,
    unassigned,
    indicators,
    totalOrgOwners: owners.length,
    totalOrgTeams: teamsList.length,
  };
}
