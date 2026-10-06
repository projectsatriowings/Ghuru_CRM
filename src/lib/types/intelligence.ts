/**
 * Milestone 2.10A: CRM Health, Aging & Needs-Attention Intelligence Types
 */

export const INTELLIGENCE_SEVERITIES = [
  "low",
  "medium",
  "high",
  "critical",
] as const;

export type IntelligenceSeverity = (typeof INTELLIGENCE_SEVERITIES)[number];

export const HEALTH_STATES = ["healthy", "needs_attention", "at_risk"] as const;
export type HealthState = (typeof HEALTH_STATES)[number];

export const INTELLIGENCE_ENTITY_TYPES = ["lead", "deal"] as const;
export type IntelligenceEntityType = (typeof INTELLIGENCE_ENTITY_TYPES)[number];

export const SIGNAL_TYPES = [
  // Lead Signals
  "new_lead_no_contact",
  "qualified_lead_no_next_action",
  "overdue_lead_follow_up",
  "stale_lead",
  "lead_stuck_in_stage",
  // Deal Signals
  "deal_no_next_action",
  "overdue_deal_follow_up",
  "stale_deal",
  "high_value_stale_deal",
  "approaching_expected_close",
  "expected_close_without_next_action",
] as const;

export type SignalType = (typeof SIGNAL_TYPES)[number];

/**
 * Normalized user-facing Attention Item representing an actionable operational bottleneck.
 */
export interface AttentionItem {
  id: string; // Deterministic identifier (e.g. `${entityType}_${entityId}_${signalType}`)
  organizationId: string;
  entityType: IntelligenceEntityType;
  entityId: string;
  entityName: string;
  signalType: SignalType;
  severity: IntelligenceSeverity;
  title: string;
  description: string; // Plain-English explanation of WHY this item needs attention
  recommendedAction: string; // Deterministic next action recommendation
  detectedAt: Date;
  metadata: Record<string, unknown>; // Structured diagnostic data for future extensibility/AI
  link: string; // Deep-link to entity in Ghuru CRM
  value?: number | null;
  currency?: string | null;
  stageName?: string | null;
  ownerName?: string | null;
}

/**
 * Comprehensive health assessment of a single CRM entity.
 */
export interface EntityHealthResult {
  entityType: IntelligenceEntityType;
  entityId: string;
  entityName: string;
  healthState: HealthState;
  highestSeverity: IntelligenceSeverity | null;
  signals: AttentionItem[];
  lastActivityAt: Date | null;
  daysSinceLastActivity: number | null;
  nextAction: {
    followUpId: string;
    title: string;
    dueDate: string;
    dueTime?: string | null;
    isOverdue: boolean;
  } | null;
  summary: string;
  recommendedAction: string | null;
}

/**
 * High-level intelligence summary of attention bottlenecks across the organization.
 */
export interface OrganizationAttentionSummary {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  byCategory: {
    overdueFollowUps: number;
    noNextAction: number;
    staleLeads: number;
    staleDeals: number;
    approachingClose: number;
    highValueStale: number;
  };
}

/**
 * Filter and pagination options for organization attention items.
 */
export interface AttentionQueryOptions {
  entityType?: IntelligenceEntityType | "all";
  severity?: IntelligenceSeverity | "high_and_critical" | "all";
  assigneeId?: string;
  page?: number;
  pageSize?: number;
}
