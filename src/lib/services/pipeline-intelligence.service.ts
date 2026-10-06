import { db } from "@/db";
import { DbClient } from "@/db/types";
import {
  leads,
  deals,
  pipelines,
  pipelineStages,
} from "@/db/schema";
import {
  type DashboardQueryOptions,
  type DashboardDateRange,
  type DashboardDateRangePreset,
} from "@/lib/types/dashboard";
import {
  type CurrencyAmountMap,
  type LeadFunnelMetrics,
  type LeadFunnelStageBreakdown,
  type FunnelTransitionRates,
  type SourcePerformanceItem,
  type StageIntelligenceItem,
  type PipelineIntelligenceItem,
  type PipelineBottleneckItem,
  type PeriodComparisonData,
  type MetricComparisonItem,
  type CurrencyComparisonItem,
  type PipelineAndConversionIntelligence,
} from "@/lib/types/pipeline-intelligence";
import {
  LEAD_SOURCE_LABELS,
  LEAD_STATUSES,
  LEAD_STATUS_LABELS,
  type LeadSource,
  type LeadStatus,
} from "@/lib/types/leads";
import {
  resolveDateRange,
  getPreviousEquivalentDateRange,
} from "@/lib/utils/date-range-utils";
import { eq, and, isNull, inArray, gte, lte, asc, sql } from "drizzle-orm";

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
 * 1. Lead Funnel Intelligence
 * Analyzes lead progression across statuses and stage-to-stage transition rates.
 */
export async function getLeadFunnelIntelligence(
  organizationId: string,
  arg1?: DashboardQueryOptions | DashboardDateRange | DbClient,
  arg2?: string | DbClient,
  arg3?: string | DbClient,
  arg4?: DbClient
): Promise<LeadFunnelMetrics> {
  const { dateRange, assigneeId, pipelineId, dbInstance } = resolveQueryContext(
    arg1,
    arg2,
    arg3,
    arg4
  );

  const baseLeadConditions = [
    eq(leads.organizationId, organizationId),
    isNull(leads.archivedAt),
    gte(leads.createdAt, dateRange.from),
    lte(leads.createdAt, dateRange.to),
  ];

  if (assigneeId) {
    baseLeadConditions.push(eq(leads.assignedToUserId, assigneeId));
  }
  if (pipelineId) {
    baseLeadConditions.push(eq(leads.pipelineId, pipelineId));
  }

  // Aggregate lead counts by status
  const [counts] = await dbInstance
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
    .where(and(...baseLeadConditions));

  const totalLeads = Number(counts?.total || 0);
  const newCount = Number(counts?.newCount || 0);
  const contactedCount = Number(counts?.contactedCount || 0);
  const qualifiedCount = Number(counts?.qualifiedCount || 0);
  const unqualifiedCount = Number(counts?.unqualifiedCount || 0);
  const convertedCount = Number(counts?.convertedCount || 0);
  const lostCount = Number(counts?.lostCount || 0);

  // In CRM funnels, both qualified status and converted status reflect qualified leads
  const qualifiedTotal = qualifiedCount + convertedCount;
  const qualificationRate =
    totalLeads > 0 ? Number(((qualifiedTotal / totalLeads) * 100).toFixed(1)) : 0;
  const conversionRate =
    totalLeads > 0 ? Number(((convertedCount / totalLeads) * 100).toFixed(1)) : 0;

  // Deals created from leads in this cohort
  const dealConditions = [
    eq(deals.organizationId, organizationId),
    eq(leads.organizationId, organizationId),
    isNull(deals.archivedAt),
    isNull(leads.archivedAt),
    gte(leads.createdAt, dateRange.from),
    lte(leads.createdAt, dateRange.to),
  ];

  if (assigneeId) {
    dealConditions.push(eq(deals.ownerUserId, assigneeId));
  }
  if (pipelineId) {
    dealConditions.push(eq(deals.pipelineId, pipelineId));
  }

  const [dealCounts] = await dbInstance
    .select({
      dealsCreated: sql<number>`count(distinct ${deals.id})::int`,
      dealsWon: sql<number>`count(distinct case when ${deals.status} = 'won' then ${deals.id} end)::int`,
      dealsLost: sql<number>`count(distinct case when ${deals.status} = 'lost' then ${deals.id} end)::int`,
    })
    .from(deals)
    .innerJoin(leads, eq(deals.leadId, leads.id))
    .where(and(...dealConditions));

  const dealsCreated = Number(dealCounts?.dealsCreated || 0);
  const dealsWon = Number(dealCounts?.dealsWon || 0);
  const dealsLost = Number(dealCounts?.dealsLost || 0);

  // Transition Rates:
  // 1. Lead -> Contacted (leads progressing beyond new: contacted, qualified, converted, unqualified, lost)
  const contactedOrBeyond = totalLeads - newCount;
  const leadToContactedRate =
    totalLeads > 0 ? Number(((contactedOrBeyond / totalLeads) * 100).toFixed(1)) : 0;

  // 2. Contacted -> Qualified
  const contactedToQualifiedRate =
    contactedOrBeyond > 0
      ? Number(((qualifiedTotal / contactedOrBeyond) * 100).toFixed(1))
      : 0;

  // 3. Qualified -> Converted
  const qualifiedToConvertedRate =
    qualifiedTotal > 0
      ? Number(((convertedCount / qualifiedTotal) * 100).toFixed(1))
      : 0;

  // 4. Converted -> Deal
  const convertedToDealRate =
    convertedCount > 0
      ? Math.min(100, Number(((dealsCreated / convertedCount) * 100).toFixed(1)))
      : (totalLeads > 0 && dealsCreated > 0
          ? Number(((dealsCreated / totalLeads) * 100).toFixed(1))
          : 0);

  // 5. Deal -> Won
  const closedDeals = dealsWon + dealsLost;
  const dealToWonRate =
    closedDeals > 0
      ? Number(((dealsWon / closedDeals) * 100).toFixed(1))
      : (dealsCreated > 0
          ? Number(((dealsWon / dealsCreated) * 100).toFixed(1))
          : 0);

  // 6. Lead -> Won overall
  const overallLeadToWonRate =
    totalLeads > 0 ? Number(((dealsWon / totalLeads) * 100).toFixed(1)) : 0;

  const transitions: FunnelTransitionRates = {
    leadToContactedRate,
    contactedToQualifiedRate,
    qualifiedToConvertedRate,
    convertedToDealRate,
    dealToWonRate,
    overallLeadToWonRate,
  };

  const statusMap: Record<LeadStatus, number> = {
    new: newCount,
    contacted: contactedCount,
    qualified: qualifiedCount,
    unqualified: unqualifiedCount,
    converted: convertedCount,
    lost: lostCount,
  };

  const stages: LeadFunnelStageBreakdown[] = LEAD_STATUSES.map((status) => {
    const count = statusMap[status] || 0;
    const percentage =
      totalLeads > 0 ? Number(((count / totalLeads) * 100).toFixed(1)) : 0;
    return {
      status,
      label: LEAD_STATUS_LABELS[status] || status,
      count,
      percentage,
    };
  });

  return {
    totalLeads,
    newCount,
    contactedCount,
    qualifiedCount,
    unqualifiedCount,
    convertedCount,
    lostCount,
    qualificationRate,
    conversionRate,
    stages,
    transitions,
    historicalDataNote:
      "Transition rates reflect current record status and deal linkage for leads created within the selected time period. Stage dwell times are omitted because stage transition history is not stored.",
  };
}

/**
 * 2. Lead Source Performance
 * Analyzes acquisition sources for volume, qualification, conversion, and attributable deals/wins.
 */
export async function getLeadSourcePerformance(
  organizationId: string,
  arg1?: DashboardQueryOptions | DashboardDateRange | DbClient,
  arg2?: string | DbClient,
  arg3?: string | DbClient,
  arg4?: DbClient
): Promise<SourcePerformanceItem[]> {
  const { dateRange, assigneeId, pipelineId, dbInstance } = resolveQueryContext(
    arg1,
    arg2,
    arg3,
    arg4
  );

  const baseLeadConditions = [
    eq(leads.organizationId, organizationId),
    isNull(leads.archivedAt),
    gte(leads.createdAt, dateRange.from),
    lte(leads.createdAt, dateRange.to),
  ];

  if (assigneeId) {
    baseLeadConditions.push(eq(leads.assignedToUserId, assigneeId));
  }
  if (pipelineId) {
    baseLeadConditions.push(eq(leads.pipelineId, pipelineId));
  }

  // 1. Group leads by source
  const leadSourceRows = await dbInstance
    .select({
      source: leads.source,
      total: sql<number>`count(*)::int`,
      qualifiedCount: sql<number>`count(case when ${leads.status} in ('qualified', 'converted') then 1 end)::int`,
      convertedCount: sql<number>`count(case when ${leads.status} = 'converted' then 1 end)::int`,
      lostCount: sql<number>`count(case when ${leads.status} = 'lost' then 1 end)::int`,
    })
    .from(leads)
    .where(and(...baseLeadConditions))
    .groupBy(leads.source);

  // 2. Deals linked to leads by source, grouped by currency and deal status
  const dealConditions = [
    eq(deals.organizationId, organizationId),
    eq(leads.organizationId, organizationId),
    isNull(deals.archivedAt),
    isNull(leads.archivedAt),
    gte(leads.createdAt, dateRange.from),
    lte(leads.createdAt, dateRange.to),
  ];

  if (assigneeId) {
    dealConditions.push(eq(deals.ownerUserId, assigneeId));
  }
  if (pipelineId) {
    dealConditions.push(eq(deals.pipelineId, pipelineId));
  }

  const dealSourceRows = await dbInstance
    .select({
      source: leads.source,
      currency: deals.currency,
      status: deals.status,
      dealsCount: sql<number>`count(distinct ${deals.id})::int`,
      totalValue: sql<number>`coalesce(sum(${deals.value}), 0)::numeric`,
    })
    .from(deals)
    .innerJoin(leads, eq(deals.leadId, leads.id))
    .where(and(...dealConditions))
    .groupBy(leads.source, deals.currency, deals.status);

  // Process attributable deal metrics by source
  interface SourceDealAgg {
    dealsCreated: number;
    dealsWon: number;
    dealsLost: number;
    wonValueByCurrency: CurrencyAmountMap;
  }
  const sourceDealsMap = new Map<string, SourceDealAgg>();

  dealSourceRows.forEach((row) => {
    const s = row.source;
    if (!sourceDealsMap.has(s)) {
      sourceDealsMap.set(s, {
        dealsCreated: 0,
        dealsWon: 0,
        dealsLost: 0,
        wonValueByCurrency: {},
      });
    }
    const agg = sourceDealsMap.get(s)!;
    const count = Number(row.dealsCount || 0);
    const val = Number(row.totalValue || 0);
    agg.dealsCreated += count;

    if (row.status === "won") {
      agg.dealsWon += count;
      const curr = row.currency || "USD";
      agg.wonValueByCurrency[curr] = Number(
        ((agg.wonValueByCurrency[curr] || 0) + val).toFixed(2)
      );
    } else if (row.status === "lost") {
      agg.dealsLost += count;
    }
  });

  const leadRowsMap = new Map<string, typeof leadSourceRows[number]>();
  leadSourceRows.forEach((r) => leadRowsMap.set(r.source, r));

  const allActiveSources = new Set<string>([
    ...leadSourceRows.map((r) => r.source),
    ...dealSourceRows.map((r) => r.source),
  ]);

  const results: SourcePerformanceItem[] = [];

  allActiveSources.forEach((sourceKey) => {
    const leadRow = leadRowsMap.get(sourceKey);
    const dealAgg = sourceDealsMap.get(sourceKey) || {
      dealsCreated: 0,
      dealsWon: 0,
      dealsLost: 0,
      wonValueByCurrency: {},
    };

    const leadCount = Number(leadRow?.total || 0);
    const qualifiedCount = Number(leadRow?.qualifiedCount || 0);
    const convertedCount = Number(leadRow?.convertedCount || 0);
    const lostCount = Number(leadRow?.lostCount || 0);

    const qualificationRate =
      leadCount > 0 ? Number(((qualifiedCount / leadCount) * 100).toFixed(1)) : 0;
    const conversionRate =
      leadCount > 0 ? Number(((convertedCount / leadCount) * 100).toFixed(1)) : 0;

    const closedDeals = dealAgg.dealsWon + dealAgg.dealsLost;
    const winRate =
      closedDeals > 0
        ? Number(((dealAgg.dealsWon / closedDeals) * 100).toFixed(1))
        : (dealAgg.dealsCreated > 0
            ? Number(((dealAgg.dealsWon / dealAgg.dealsCreated) * 100).toFixed(1))
            : 0);

    results.push({
      source: sourceKey as LeadSource,
      label: LEAD_SOURCE_LABELS[sourceKey as LeadSource] || sourceKey,
      leadCount,
      qualifiedCount,
      convertedCount,
      lostCount,
      dealsCreatedCount: dealAgg.dealsCreated,
      dealsWonCount: dealAgg.dealsWon,
      dealsLostCount: dealAgg.dealsLost,
      qualificationRate,
      conversionRate,
      winRate,
      wonValueByCurrency: dealAgg.wonValueByCurrency,
    });
  });

  // Sort primarily by lead volume, secondary by qualification rate
  return results.sort((a, b) => {
    if (b.leadCount !== a.leadCount) return b.leadCount - a.leadCount;
    return b.qualificationRate - a.qualificationRate;
  });
}

/**
 * Helper to accumulate currency values
 */
function addCurrencyValue(
  map: CurrencyAmountMap,
  currency: string,
  amount: number
): void {
  const curr = currency || "USD";
  map[curr] = Number(((map[curr] || 0) + amount).toFixed(2));
}

/**
 * 3. Deal Pipeline Intelligence & Stage Analysis
 * Calculates deals, multi-currency values, win/loss rates, and stage distribution.
 */
export async function getDealPipelineIntelligence(
  organizationId: string,
  arg1?: DashboardQueryOptions | DashboardDateRange | DbClient,
  arg2?: string | DbClient,
  arg3?: string | DbClient,
  arg4?: DbClient
): Promise<PipelineIntelligenceItem[]> {
  const { dateRange, assigneeId, pipelineId, dbInstance } = resolveQueryContext(
    arg1,
    arg2,
    arg3,
    arg4
  );

  // 1. Fetch active pipelines
  const pipeConditions = [
    eq(pipelines.organizationId, organizationId),
    isNull(pipelines.archivedAt),
    eq(pipelines.active, true),
  ];

  if (pipelineId) {
    pipeConditions.push(eq(pipelines.id, pipelineId));
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

  // 2. Fetch active stages for these pipelines
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

  // 3. Stale deal threshold: deals un-updated for 14+ days
  const staleThreshold = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  // 4. Group deals by pipeline, stage, currency, and status
  const dealConditions = [
    eq(deals.organizationId, organizationId),
    isNull(deals.archivedAt),
    inArray(deals.pipelineId, pipelineIds),
    gte(deals.createdAt, dateRange.from),
    lte(deals.createdAt, dateRange.to),
  ];

  if (assigneeId) {
    dealConditions.push(eq(deals.ownerUserId, assigneeId));
  }

  const dealRows = await dbInstance
    .select({
      pipelineId: deals.pipelineId,
      stageId: deals.pipelineStageId,
      currency: deals.currency,
      status: deals.status,
      count: sql<number>`count(*)::int`,
      totalValue: sql<number>`coalesce(sum(${deals.value}), 0)::numeric`,
      staleCount: sql<number>`count(case when ${deals.status} = 'open' and ${deals.updatedAt} < ${staleThreshold} then 1 end)::int`,
    })
    .from(deals)
    .where(and(...dealConditions))
    .groupBy(
      deals.pipelineId,
      deals.pipelineStageId,
      deals.currency,
      deals.status
    );

  // Index deal metrics by pipelineId and stageId
  interface StageAgg {
    dealCount: number;
    openDealCount: number;
    wonDealCount: number;
    lostDealCount: number;
    staleDealCount: number;
    openValueByCurrency: CurrencyAmountMap;
    wonValueByCurrency: CurrencyAmountMap;
    lostValueByCurrency: CurrencyAmountMap;
    totalValueByCurrency: CurrencyAmountMap;
  }

  const stageAggMap = new Map<string, StageAgg>();

  dealRows.forEach((r) => {
    const key = `${r.pipelineId}:${r.stageId}`;
    if (!stageAggMap.has(key)) {
      stageAggMap.set(key, {
        dealCount: 0,
        openDealCount: 0,
        wonDealCount: 0,
        lostDealCount: 0,
        staleDealCount: 0,
        openValueByCurrency: {},
        wonValueByCurrency: {},
        lostValueByCurrency: {},
        totalValueByCurrency: {},
      });
    }
    const agg = stageAggMap.get(key)!;
    const count = Number(r.count || 0);
    const val = Number(r.totalValue || 0);
    const stale = Number(r.staleCount || 0);
    const curr = r.currency || "USD";

    agg.dealCount += count;
    agg.staleDealCount += stale;
    addCurrencyValue(agg.totalValueByCurrency, curr, val);

    if (r.status === "open") {
      agg.openDealCount += count;
      addCurrencyValue(agg.openValueByCurrency, curr, val);
    } else if (r.status === "won") {
      agg.wonDealCount += count;
      addCurrencyValue(agg.wonValueByCurrency, curr, val);
    } else if (r.status === "lost") {
      agg.lostDealCount += count;
      addCurrencyValue(agg.lostValueByCurrency, curr, val);
    }
  });

  // Build structured pipeline intelligence items
  return activePipelines.map((pipe) => {
    const pipeStages = stages.filter((s) => s.pipelineId === pipe.id);

    let pipeTotalDeals = 0;
    let pipeOpenDeals = 0;
    let pipeWonDeals = 0;
    let pipeLostDeals = 0;
    const pipeOpenValue: CurrencyAmountMap = {};
    const pipeWonValue: CurrencyAmountMap = {};
    const pipeLostValue: CurrencyAmountMap = {};
    const pipeTotalValue: CurrencyAmountMap = {};

    // 1st pass: compute totals for the pipeline
    pipeStages.forEach((st) => {
      const agg = stageAggMap.get(`${pipe.id}:${st.id}`);
      if (agg) {
        pipeTotalDeals += agg.dealCount;
        pipeOpenDeals += agg.openDealCount;
        pipeWonDeals += agg.wonDealCount;
        pipeLostDeals += agg.lostDealCount;

        Object.entries(agg.openValueByCurrency).forEach(([curr, v]) =>
          addCurrencyValue(pipeOpenValue, curr, v)
        );
        Object.entries(agg.wonValueByCurrency).forEach(([curr, v]) =>
          addCurrencyValue(pipeWonValue, curr, v)
        );
        Object.entries(agg.lostValueByCurrency).forEach(([curr, v]) =>
          addCurrencyValue(pipeLostValue, curr, v)
        );
        Object.entries(agg.totalValueByCurrency).forEach(([curr, v]) =>
          addCurrencyValue(pipeTotalValue, curr, v)
        );
      }
    });

    // Compute average deal value by currency
    const pipeAvgDealValue: CurrencyAmountMap = {};
    if (pipeTotalDeals > 0) {
      Object.entries(pipeTotalValue).forEach(([curr, v]) => {
        pipeAvgDealValue[curr] = Number((v / pipeTotalDeals).toFixed(2));
      });
    }

    // Win Rate: Won / (Won + Lost) * 100
    const pipeClosedDeals = pipeWonDeals + pipeLostDeals;
    const winRate =
      pipeClosedDeals > 0
        ? Number(((pipeWonDeals / pipeClosedDeals) * 100).toFixed(1))
        : 0;
    const lossRate =
      pipeClosedDeals > 0
        ? Number(((pipeLostDeals / pipeClosedDeals) * 100).toFixed(1))
        : 0;

    // 2nd pass: evaluate stage bottleneck logic deterministically
    const mappedStages: StageIntelligenceItem[] = pipeStages.map((st) => {
      const agg = stageAggMap.get(`${pipe.id}:${st.id}`) || {
        dealCount: 0,
        openDealCount: 0,
        wonDealCount: 0,
        lostDealCount: 0,
        staleDealCount: 0,
        openValueByCurrency: {},
        wonValueByCurrency: {},
        lostValueByCurrency: {},
        totalValueByCurrency: {},
      };

      const avgOpenValue: CurrencyAmountMap = {};
      if (agg.openDealCount > 0) {
        Object.entries(agg.openValueByCurrency).forEach(([curr, v]) => {
          avgOpenValue[curr] = Number((v / agg.openDealCount).toFixed(2));
        });
      }

      // Bottleneck evaluation rules:
      // Condition A: High open deal concentration (>= 40% of pipeline open deals when pipeline has >= 3 open deals and >= 2 stages)
      const hasHighConcentration =
        pipeOpenDeals >= 3 &&
        pipeStages.length >= 2 &&
        agg.openDealCount / pipeOpenDeals >= 0.4;

      // Condition B: Stale deal concentration (>= 50% of deals in stage are stale, with at least 2 stale deals)
      const hasHighStaleRatio =
        agg.openDealCount >= 2 &&
        agg.staleDealCount >= 2 &&
        agg.staleDealCount / agg.openDealCount >= 0.5;

      let isBottleneck = false;
      let bottleneckReason: string | null = null;

      if (hasHighConcentration && hasHighStaleRatio) {
        isBottleneck = true;
        const concPercent = Math.round((agg.openDealCount / pipeOpenDeals) * 100);
        bottleneckReason = `Severe congestion: contains ${agg.openDealCount} open deals (${concPercent}% of pipeline) with ${agg.staleDealCount} deals stagnant for over 14 days.`;
      } else if (hasHighConcentration) {
        isBottleneck = true;
        const concPercent = Math.round((agg.openDealCount / pipeOpenDeals) * 100);
        bottleneckReason = `High deal concentration: contains ${agg.openDealCount} open deals (${concPercent}% of pipeline open deals).`;
      } else if (hasHighStaleRatio) {
        isBottleneck = true;
        const stalePercent = Math.round((agg.staleDealCount / agg.openDealCount) * 100);
        bottleneckReason = `High deal stagnation: ${agg.staleDealCount} of ${agg.openDealCount} open deals (${stalePercent}%) have had no updates in over 14 days.`;
      }

      return {
        stageId: st.id,
        stageName: st.name,
        displayOrder: st.displayOrder,
        dealCount: agg.dealCount,
        openDealCount: agg.openDealCount,
        wonDealCount: agg.wonDealCount,
        lostDealCount: agg.lostDealCount,
        openValueByCurrency: agg.openValueByCurrency,
        wonValueByCurrency: agg.wonValueByCurrency,
        lostValueByCurrency: agg.lostValueByCurrency,
        averageDealValueByCurrency: avgOpenValue,
        staleDealCount: agg.staleDealCount,
        isBottleneck,
        bottleneckReason,
        stageAgeDays: null, // Note: Stage-entry history is not tracked; omitting dwell time to avoid fabricated metrics.
      };
    });

    return {
      pipelineId: pipe.id,
      pipelineName: pipe.name,
      isDefault: pipe.isDefault,
      totalDeals: pipeTotalDeals,
      openDealCount: pipeOpenDeals,
      wonDealCount: pipeWonDeals,
      lostDealCount: pipeLostDeals,
      openValueByCurrency: pipeOpenValue,
      wonValueByCurrency: pipeWonValue,
      lostValueByCurrency: pipeLostValue,
      totalValueByCurrency: pipeTotalValue,
      averageDealValueByCurrency: pipeAvgDealValue,
      winRate,
      lossRate,
      stages: mappedStages,
    };
  });
}

/**
 * 4. Pipeline Bottleneck Evaluator
 * Identifies stages creating pipeline friction and provides actionable explanations.
 */
export async function getPipelineBottlenecks(
  organizationId: string,
  arg1?: DashboardQueryOptions | DashboardDateRange | DbClient,
  arg2?: string | DbClient,
  arg3?: string | DbClient,
  arg4?: DbClient
): Promise<PipelineBottleneckItem[]> {
  const pipelinesData = await getDealPipelineIntelligence(
    organizationId,
    arg1,
    arg2,
    arg3,
    arg4
  );

  const bottlenecks: PipelineBottleneckItem[] = [];

  pipelinesData.forEach((pipe) => {
    pipe.stages.forEach((st) => {
      if (st.isBottleneck && st.bottleneckReason) {
        let recommendation = "Review deals in this stage and schedule follow-ups to progress opportunities.";
        if (st.staleDealCount > 0) {
          recommendation = `Follow up on the ${st.staleDealCount} stale deals to re-engage prospects or qualify out inactive deals.`;
        }

        bottlenecks.push({
          pipelineId: pipe.pipelineId,
          pipelineName: pipe.pipelineName,
          stageId: st.stageId,
          stageName: st.stageName,
          openDealCount: st.openDealCount,
          openValueByCurrency: st.openValueByCurrency,
          staleDealCount: st.staleDealCount,
          reason: st.bottleneckReason,
          recommendation,
        });
      }
    });
  });

  return bottlenecks;
}

/**
 * 5. Period Comparison
 * Compares volume and conversion metrics between current period and previous equivalent period.
 */
export async function getPeriodComparisonMetrics(
  organizationId: string,
  arg1?: DashboardQueryOptions | DashboardDateRange | DbClient,
  arg2?: string | DbClient,
  arg3?: string | DbClient,
  arg4?: DbClient
): Promise<PeriodComparisonData> {
  const { dateRange, assigneeId, pipelineId, dbInstance } = resolveQueryContext(
    arg1,
    arg2,
    arg3,
    arg4
  );

  const prevRange = getPreviousEquivalentDateRange(dateRange);

  // Helper to compute comparison stats
  function calcComparison(current: number, previous: number, isPositive = true): MetricComparisonItem {
    let changePercentage: number | null = null;
    if (previous === 0 && current === 0) {
      changePercentage = 0;
    } else if (previous === 0) {
      changePercentage = 100;
    } else {
      changePercentage = Number((((current - previous) / previous) * 100).toFixed(1));
    }

    return {
      current,
      previous,
      changePercentage,
      isPositive: changePercentage >= 0 ? isPositive : !isPositive,
    };
  }

  // 1. Current period leads & deals
  const currentLeadConditions = [
    eq(leads.organizationId, organizationId),
    isNull(leads.archivedAt),
    gte(leads.createdAt, dateRange.from),
    lte(leads.createdAt, dateRange.to),
  ];
  if (assigneeId) currentLeadConditions.push(eq(leads.assignedToUserId, assigneeId));
  if (pipelineId) currentLeadConditions.push(eq(leads.pipelineId, pipelineId));

  const previousLeadConditions = [
    eq(leads.organizationId, organizationId),
    isNull(leads.archivedAt),
    gte(leads.createdAt, prevRange.from),
    lte(leads.createdAt, prevRange.to),
  ];
  if (assigneeId) previousLeadConditions.push(eq(leads.assignedToUserId, assigneeId));
  if (pipelineId) previousLeadConditions.push(eq(leads.pipelineId, pipelineId));

  const currentDealConditions = [
    eq(deals.organizationId, organizationId),
    isNull(deals.archivedAt),
    gte(deals.createdAt, dateRange.from),
    lte(deals.createdAt, dateRange.to),
  ];
  if (assigneeId) currentDealConditions.push(eq(deals.ownerUserId, assigneeId));
  if (pipelineId) currentDealConditions.push(eq(deals.pipelineId, pipelineId));

  const previousDealConditions = [
    eq(deals.organizationId, organizationId),
    isNull(deals.archivedAt),
    gte(deals.createdAt, prevRange.from),
    lte(deals.createdAt, prevRange.to),
  ];
  if (assigneeId) previousDealConditions.push(eq(deals.ownerUserId, assigneeId));
  if (pipelineId) previousDealConditions.push(eq(deals.pipelineId, pipelineId));

  const [
    [curLeads],
    [prevLeads],
    [curDeals],
    [prevDeals],
    curWonValues,
    prevWonValues,
  ] = await Promise.all([
    dbInstance
      .select({
        total: sql<number>`count(*)::int`,
        qualified: sql<number>`count(case when ${leads.status} in ('qualified', 'converted') then 1 end)::int`,
        converted: sql<number>`count(case when ${leads.status} = 'converted' then 1 end)::int`,
      })
      .from(leads)
      .where(and(...currentLeadConditions)),

    dbInstance
      .select({
        total: sql<number>`count(*)::int`,
        qualified: sql<number>`count(case when ${leads.status} in ('qualified', 'converted') then 1 end)::int`,
        converted: sql<number>`count(case when ${leads.status} = 'converted' then 1 end)::int`,
      })
      .from(leads)
      .where(and(...previousLeadConditions)),

    dbInstance
      .select({
        created: sql<number>`count(*)::int`,
        won: sql<number>`count(case when ${deals.status} = 'won' then 1 end)::int`,
      })
      .from(deals)
      .where(and(...currentDealConditions)),

    dbInstance
      .select({
        created: sql<number>`count(*)::int`,
        won: sql<number>`count(case when ${deals.status} = 'won' then 1 end)::int`,
      })
      .from(deals)
      .where(and(...previousDealConditions)),

    dbInstance
      .select({
        currency: deals.currency,
        value: sql<number>`coalesce(sum(${deals.value}), 0)::numeric`,
      })
      .from(deals)
      .where(and(...currentDealConditions, eq(deals.status, "won")))
      .groupBy(deals.currency),

    dbInstance
      .select({
        currency: deals.currency,
        value: sql<number>`coalesce(sum(${deals.value}), 0)::numeric`,
      })
      .from(deals)
      .where(and(...previousDealConditions, eq(deals.status, "won")))
      .groupBy(deals.currency),
  ]);

  const leadsComparison = calcComparison(
    Number(curLeads?.total || 0),
    Number(prevLeads?.total || 0)
  );
  const qualifiedComparison = calcComparison(
    Number(curLeads?.qualified || 0),
    Number(prevLeads?.qualified || 0)
  );
  const convertedComparison = calcComparison(
    Number(curLeads?.converted || 0),
    Number(prevLeads?.converted || 0)
  );
  const dealsCreatedComparison = calcComparison(
    Number(curDeals?.created || 0),
    Number(prevDeals?.created || 0)
  );
  const dealsWonComparison = calcComparison(
    Number(curDeals?.won || 0),
    Number(prevDeals?.won || 0)
  );

  // Group won values by currency
  const curWonMap = new Map<string, number>();
  curWonValues.forEach((v) => curWonMap.set(v.currency, Number(v.value || 0)));

  const prevWonMap = new Map<string, number>();
  prevWonValues.forEach((v) => prevWonMap.set(v.currency, Number(v.value || 0)));

  const allCurrencies = new Set<string>([
    ...curWonValues.map((v) => v.currency),
    ...prevWonValues.map((v) => v.currency),
  ]);

  const wonValueComparisons: CurrencyComparisonItem[] = [];
  allCurrencies.forEach((curr) => {
    const c = curWonMap.get(curr) || 0;
    const p = prevWonMap.get(curr) || 0;
    let changePercentage: number | null = null;
    if (p === 0 && c === 0) {
      changePercentage = 0;
    } else if (p === 0) {
      changePercentage = 100;
    } else {
      changePercentage = Number((((c - p) / p) * 100).toFixed(1));
    }
    wonValueComparisons.push({
      currency: curr,
      current: Number(c.toFixed(2)),
      previous: Number(p.toFixed(2)),
      changePercentage,
    });
  });

  return {
    currentPeriod: {
      from: dateRange.from.toISOString(),
      to: dateRange.to.toISOString(),
    },
    previousPeriod: {
      from: prevRange.from.toISOString(),
      to: prevRange.to.toISOString(),
    },
    leads: leadsComparison,
    qualifiedLeads: qualifiedComparison,
    convertedLeads: convertedComparison,
    dealsCreated: dealsCreatedComparison,
    dealsWon: dealsWonComparison,
    wonValue: wonValueComparisons,
  };
}

/**
 * 6. Combined Pipeline & Conversion Intelligence
 */
export async function getPipelineAndConversionIntelligence(
  organizationId: string,
  options?: DashboardQueryOptions | DashboardDateRange | DbClient,
  assigneeId?: string | DbClient,
  pipelineId?: string | DbClient,
  dbInstance?: DbClient
): Promise<PipelineAndConversionIntelligence> {
  const [funnel, sources, pipelinesData, bottlenecks, periodComparison] =
    await Promise.all([
      getLeadFunnelIntelligence(organizationId, options, assigneeId, pipelineId, dbInstance),
      getLeadSourcePerformance(organizationId, options, assigneeId, pipelineId, dbInstance),
      getDealPipelineIntelligence(organizationId, options, assigneeId, pipelineId, dbInstance),
      getPipelineBottlenecks(organizationId, options, assigneeId, pipelineId, dbInstance),
      getPeriodComparisonMetrics(organizationId, options, assigneeId, pipelineId, dbInstance),
    ]);

  return {
    funnel,
    sources,
    pipelines: pipelinesData,
    bottlenecks,
    periodComparison,
  };
}
