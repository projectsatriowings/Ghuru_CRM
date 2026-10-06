import {
  SignalType,
  IntelligenceSeverity,
  IntelligenceEntityType,
} from "@/lib/types/intelligence";

export interface SignalDefinition {
  key: SignalType;
  label: string;
  supportedEntities: IntelligenceEntityType[];
  defaultSeverity: IntelligenceSeverity;
  rankPriority: number; // Lower number = higher priority for tie-breakers
  buildDescription: (ctx: Record<string, unknown>) => string;
  buildRecommendedAction: (ctx: Record<string, unknown>) => string;
}

export const SIGNAL_CATALOG: Record<SignalType, SignalDefinition> = {
  // --- LEAD SIGNALS ---
  new_lead_no_contact: {
    key: "new_lead_no_contact",
    label: "New Lead Without Contact",
    supportedEntities: ["lead"],
    defaultSeverity: "low",
    rankPriority: 60,
    buildDescription: (ctx) => {
      const hours = ctx.hoursSinceCreation ?? 24;
      return `New lead received ${hours}h ago has had no meaningful activity or contact.`;
    },
    buildRecommendedAction: () =>
      "Initiate first contact via call or email to qualify this prospect.",
  },

  qualified_lead_no_next_action: {
    key: "qualified_lead_no_next_action",
    label: "Qualified Lead Missing Next Action",
    supportedEntities: ["lead"],
    defaultSeverity: "medium",
    rankPriority: 40,
    buildDescription: () =>
      "Lead is marked as Qualified but has no upcoming follow-up or next action scheduled.",
    buildRecommendedAction: () =>
      "Schedule a follow-up with the lead owner to progress the opportunity.",
  },

  overdue_lead_follow_up: {
    key: "overdue_lead_follow_up",
    label: "Overdue Lead Follow-up",
    supportedEntities: ["lead"],
    defaultSeverity: "high",
    rankPriority: 10,
    buildDescription: (ctx) => {
      const title = ctx.followUpTitle ? `"${ctx.followUpTitle}"` : "Scheduled task";
      const days = ctx.daysOverdue ?? 1;
      const dateStr = ctx.dueDate ? ` (due ${ctx.dueDate})` : "";
      return `Follow-up ${title} is overdue by ${days} day${days === 1 ? "" : "s"}${dateStr}.`;
    },
    buildRecommendedAction: () =>
      "Complete or reschedule the overdue follow-up immediately.",
  },

  stale_lead: {
    key: "stale_lead",
    label: "Stale Lead (No Activity)",
    supportedEntities: ["lead"],
    defaultSeverity: "medium",
    rankPriority: 30,
    buildDescription: (ctx) => {
      const days = ctx.daysInactive ?? 7;
      return `No meaningful activity recorded in the last ${days} days.`;
    },
    buildRecommendedAction: () =>
      "Re-engage the lead and schedule a follow-up.",
  },

  lead_stuck_in_stage: {
    key: "lead_stuck_in_stage",
    label: "Lead Stalled in Pipeline Stage",
    supportedEntities: ["lead"],
    defaultSeverity: "medium",
    rankPriority: 50,
    buildDescription: (ctx) => {
      const stage = ctx.stageName ? ` "${ctx.stageName}"` : "";
      const days = ctx.daysInStage ?? 14;
      return `Lead has remained in stage${stage} for ${days} days without progression.`;
    },
    buildRecommendedAction: () =>
      "Review lead qualification and move forward or disqualify.",
  },

  // --- DEAL SIGNALS ---
  deal_no_next_action: {
    key: "deal_no_next_action",
    label: "Deal Missing Next Action",
    supportedEntities: ["deal"],
    defaultSeverity: "medium",
    rankPriority: 45,
    buildDescription: (ctx) => {
      const stage = ctx.stageName ? ` in "${ctx.stageName}"` : "";
      return `Open deal${stage} has no upcoming follow-up or scheduled next action.`;
    },
    buildRecommendedAction: () =>
      "Schedule a follow-up with the deal owner to advance the pipeline.",
  },

  overdue_deal_follow_up: {
    key: "overdue_deal_follow_up",
    label: "Overdue Deal Follow-up",
    supportedEntities: ["deal"],
    defaultSeverity: "high",
    rankPriority: 8,
    buildDescription: (ctx) => {
      const title = ctx.followUpTitle ? `"${ctx.followUpTitle}"` : "Scheduled task";
      const days = ctx.daysOverdue ?? 1;
      const dateStr = ctx.dueDate ? ` (due ${ctx.dueDate})` : "";
      return `Follow-up ${title} is overdue by ${days} day${days === 1 ? "" : "s"}${dateStr}.`;
    },
    buildRecommendedAction: () =>
      "Complete or reschedule the overdue follow-up immediately.",
  },

  stale_deal: {
    key: "stale_deal",
    label: "Stale Deal (No Activity)",
    supportedEntities: ["deal"],
    defaultSeverity: "medium",
    rankPriority: 35,
    buildDescription: (ctx) => {
      const days = ctx.daysInactive ?? 7;
      const stage = ctx.stageName ? ` in "${ctx.stageName}"` : "";
      return `No meaningful activity recorded in the last ${days} days while open${stage}.`;
    },
    buildRecommendedAction: () =>
      "Contact the deal owner and schedule a follow-up.",
  },

  high_value_stale_deal: {
    key: "high_value_stale_deal",
    label: "High-Value Stale Deal at Risk",
    supportedEntities: ["deal"],
    defaultSeverity: "high",
    rankPriority: 15,
    buildDescription: (ctx) => {
      const days = ctx.daysInactive ?? 7;
      const formattedVal = ctx.formattedValue ?? "High-value";
      const stage = ctx.stageName ? ` in "${ctx.stageName}"` : "";
      return `High-value deal (${formattedVal}) has had no activity in ${days} days${stage}.`;
    },
    buildRecommendedAction: () =>
      "Prioritize executive or owner check-in and schedule an urgent follow-up.",
  },

  approaching_expected_close: {
    key: "approaching_expected_close",
    label: "Approaching Expected Close Date",
    supportedEntities: ["deal"],
    defaultSeverity: "medium",
    rankPriority: 25,
    buildDescription: (ctx) => {
      const days = ctx.daysUntilClose;
      const dateStr = ctx.closeDateStr ? ` (${ctx.closeDateStr})` : "";
      if (typeof days === "number" && days < 0) {
        return `Expected close date passed ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago${dateStr}.`;
      }
      if (days === 0) {
        return `Expected close date is today${dateStr}.`;
      }
      return `Expected close date is approaching in ${days} day${days === 1 ? "" : "s"}${dateStr}.`;
    },
    buildRecommendedAction: () =>
      "Review deal status and confirm final closing steps with the prospect.",
  },

  expected_close_without_next_action: {
    key: "expected_close_without_next_action",
    label: "Expected Close Approaching Without Next Action",
    supportedEntities: ["deal"],
    defaultSeverity: "high",
    rankPriority: 5,
    buildDescription: (ctx) => {
      const days = ctx.daysUntilClose;
      const dateStr = ctx.closeDateStr ? ` (${ctx.closeDateStr})` : "";
      const timePhrase =
        typeof days === "number" && days < 0
          ? `passed ${Math.abs(days)} days ago`
          : days === 0
          ? "is today"
          : `in ${days} days`;
      return `Expected close date ${timePhrase}${dateStr} with no upcoming follow-up scheduled.`;
    },
    buildRecommendedAction: () =>
      "Urgent: Schedule a follow-up before the close date to secure agreement.",
  },
};

/**
 * Severity weight mapping for deterministic sorting.
 */
export const SEVERITY_WEIGHTS: Record<IntelligenceSeverity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};
