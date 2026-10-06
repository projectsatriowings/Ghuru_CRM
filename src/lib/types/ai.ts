import {
  type OrganizationAttentionSummary,
  type AttentionItem,
  type EntityHealthResult,
} from "./intelligence";
import {
  type LeadFunnelMetrics,
  type SourcePerformanceItem,
  type PipelineIntelligenceItem,
  type PipelineBottleneckItem,
  type PeriodComparisonData,
} from "./pipeline-intelligence";
import {
  type OwnerIntelligenceItem,
  type TeamIntelligenceItem,
  type UnassignedWorkload,
  type WorkloadConcentrationIndicators,
} from "./team-owner-intelligence";

export type AIConfidence = "high" | "medium" | "low";

/**
 * Normalized internal context gathered deterministically from CRM services.
 */
export interface CRMIntelligenceContext {
  organizationSummary: {
    id: string;
    name: string;
  };
  dateRange: {
    from: string;
    to: string;
    preset?: string;
  };
  userPermissions: string[];
  healthSummary: OrganizationAttentionSummary | null;
  attentionItems: AttentionItem[];
  funnel: LeadFunnelMetrics | null;
  leadSources: SourcePerformanceItem[];
  pipelines: PipelineIntelligenceItem[];
  bottlenecks: PipelineBottleneckItem[];
  periodComparison: PeriodComparisonData | null;
  owners: OwnerIntelligenceItem[];
  teams: TeamIntelligenceItem[];
  unassignedWorkload: UnassignedWorkload | null;
  workloadIndicators: WorkloadConcentrationIndicators | null;
  recentActivities: Array<{
    id: string;
    type: string;
    title: string;
    entityType: string;
    createdAt: string;
  }>;
  automationsSummary: {
    total: number;
    active: number;
    recentExecutionsCount: number;
  } | null;
}

/**
 * Targeted context for entity-specific CRM questions.
 */
export interface EntityIntelligenceContext {
  entityType: "lead" | "deal" | "pipeline" | "owner" | "team" | "company" | "contact";
  entityId: string;
  entityName: string;
  details: Record<string, unknown>;
  health?: EntityHealthResult | null;
  signals?: AttentionItem[];
}

/**
 * Structured AI Daily Briefing output
 */
export interface AIBriefingPriority {
  rank: number;
  title: string;
  category: string;
  explanation: string;
  evidence: string[];
}

export interface AIBriefingRisk {
  id: string;
  title: string;
  severity: "low" | "medium" | "high" | "critical";
  explanation: string;
  evidence: string[];
  recommendedAction: string;
}

export interface AIRecommendedAction {
  id: string;
  title: string;
  reason: string;
  entityType?: "lead" | "deal" | "pipeline" | "owner" | "team" | "follow_up" | "company" | "contact";
  entityId?: string;
  priority: "high" | "medium" | "low";
  confidence: AIConfidence;
  evidence: string[];
}

export interface AIBriefingResult {
  summary: string;
  priorities: AIBriefingPriority[];
  risks: AIBriefingRisk[];
  recommendedActions: AIRecommendedAction[];
  limitations: string[];
  generatedAt: string;
}

export interface AINextActionsResult {
  actions: AIRecommendedAction[];
  summary: string;
  generatedAt: string;
}

export interface AIExplanationResult {
  metric: string;
  fact: string;
  interpretation: string;
  contributingFactors: string[];
  recommendations: string[];
  limitations: string[];
  confidence: AIConfidence;
  generatedAt: string;
}

export interface AIQuestionResult {
  question: string;
  answer: string;
  groundedFacts: string[];
  interpretation: string;
  recommendedActions: string[];
  evidence: string[];
  limitations: string[];
  confidence: AIConfidence;
  entityContextSummary?: string;
  generatedAt: string;
}

export interface AIRequestObservabilityLog {
  id: string;
  organizationId: string;
  userId: string;
  requestType: "briefing" | "next_actions" | "explain" | "ask";
  timestamp: string;
  durationMs: number;
  success: boolean;
  model: string;
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  errorMessage?: string;
}
