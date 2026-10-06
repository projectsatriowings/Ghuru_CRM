import { type LeadSource, type LeadStatus } from "./leads";

/**
 * Monetary totals grouped strictly by currency code (e.g. { "USD": 25000, "INR": 500000 }).
 * Prevents dangerous cross-currency arithmetic without real-time exchange rates.
 */
export type CurrencyAmountMap = Record<string, number>;

/**
 * Breakdown of leads in each existing lead status.
 */
export interface LeadFunnelStageBreakdown {
  status: LeadStatus;
  label: string;
  count: number;
  percentage: number;
}

/**
 * Deterministic transition and conversion rates through the funnel.
 */
export interface FunnelTransitionRates {
  leadToContactedRate: number;
  contactedToQualifiedRate: number;
  qualifiedToConvertedRate: number;
  convertedToDealRate: number;
  dealToWonRate: number;
  overallLeadToWonRate: number;
}

/**
 * Lead Funnel Intelligence metrics.
 */
export interface LeadFunnelMetrics {
  totalLeads: number;
  newCount: number;
  contactedCount: number;
  qualifiedCount: number;
  unqualifiedCount: number;
  convertedCount: number;
  lostCount: number;
  qualificationRate: number;
  conversionRate: number;
  stages: LeadFunnelStageBreakdown[];
  transitions: FunnelTransitionRates;
  historicalDataNote: string;
}

/**
 * Performance metrics per acquisition source.
 */
export interface SourcePerformanceItem {
  source: LeadSource;
  label: string;
  leadCount: number;
  qualifiedCount: number;
  convertedCount: number;
  lostCount: number;
  dealsCreatedCount: number;
  dealsWonCount: number;
  dealsLostCount: number;
  qualificationRate: number;
  conversionRate: number;
  winRate: number;
  wonValueByCurrency: CurrencyAmountMap;
}

/**
 * Stage-level intelligence within a pipeline.
 */
export interface StageIntelligenceItem {
  stageId: string;
  stageName: string;
  displayOrder: number;
  dealCount: number;
  openDealCount: number;
  wonDealCount: number;
  lostDealCount: number;
  openValueByCurrency: CurrencyAmountMap;
  wonValueByCurrency: CurrencyAmountMap;
  lostValueByCurrency: CurrencyAmountMap;
  averageDealValueByCurrency: CurrencyAmountMap;
  staleDealCount: number;
  isBottleneck: boolean;
  bottleneckReason: string | null;
  stageAgeDays: number | null; // Omitted to avoid fabricated dwell time
}

/**
 * Pipeline intelligence with multi-currency values and win/loss rates.
 */
export interface PipelineIntelligenceItem {
  pipelineId: string;
  pipelineName: string;
  isDefault: boolean;
  totalDeals: number;
  openDealCount: number;
  wonDealCount: number;
  lostDealCount: number;
  openValueByCurrency: CurrencyAmountMap;
  wonValueByCurrency: CurrencyAmountMap;
  lostValueByCurrency: CurrencyAmountMap;
  totalValueByCurrency: CurrencyAmountMap;
  averageDealValueByCurrency: CurrencyAmountMap;
  winRate: number; // Won / (Won + Lost) * 100
  lossRate: number; // Lost / (Won + Lost) * 100
  stages: StageIntelligenceItem[];
}

/**
 * Explainable pipeline bottleneck detection item.
 */
export interface PipelineBottleneckItem {
  pipelineId: string;
  pipelineName: string;
  stageId: string;
  stageName: string;
  openDealCount: number;
  openValueByCurrency: CurrencyAmountMap;
  staleDealCount: number;
  reason: string;
  recommendation: string;
}

/**
 * Metric comparison between current period and previous equivalent period.
 */
export interface MetricComparisonItem {
  current: number;
  previous: number;
  changePercentage: number | null;
  isPositive: boolean;
}

/**
 * Currency comparison between current period and previous equivalent period.
 */
export interface CurrencyComparisonItem {
  currency: string;
  current: number;
  previous: number;
  changePercentage: number | null;
}

/**
 * Period-over-period comparison data.
 */
export interface PeriodComparisonData {
  currentPeriod: { from: string; to: string };
  previousPeriod: { from: string; to: string };
  leads: MetricComparisonItem;
  qualifiedLeads: MetricComparisonItem;
  convertedLeads: MetricComparisonItem;
  dealsCreated: MetricComparisonItem;
  dealsWon: MetricComparisonItem;
  wonValue: CurrencyComparisonItem[];
}

/**
 * Aggregate pipeline & conversion intelligence payload.
 */
export interface PipelineAndConversionIntelligence {
  funnel: LeadFunnelMetrics;
  sources: SourcePerformanceItem[];
  pipelines: PipelineIntelligenceItem[];
  bottlenecks: PipelineBottleneckItem[];
  periodComparison: PeriodComparisonData;
}
