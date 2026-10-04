import { type LeadSource, type LeadStatus } from "./leads";
import { type ActivityType } from "@/db/schema/activities";

export type DashboardDateRangePreset =
  | "today"
  | "yesterday"
  | "last_7_days"
  | "last_30_days"
  | "this_month"
  | "last_month"
  | "custom";

export interface DashboardDateRange {
  from: Date;
  to: Date;
  preset?: DashboardDateRangePreset;
}

export interface DashboardFilters {
  dateRange: DashboardDateRange;
  assigneeId?: string; // "all" | "me" | specific userId
  pipelineId?: string; // "all" | specific pipelineId
}

export interface LeadMetrics {
  total: number;
  totalAllTime: number;
  new: number;
  contacted: number;
  qualified: number;
  unqualified: number;
  converted: number;
  lost: number;
  statusBreakdown: Array<{
    status: LeadStatus;
    label: string;
    count: number;
    percentage: number;
  }>;
}

export interface LeadSourceMetricItem {
  source: LeadSource;
  label: string;
  count: number;
  percentage: number;
}

export interface PipelineStageMetricItem {
  stageId: string;
  stageName: string;
  displayOrder: number;
  count: number;
  percentage: number;
}

export interface PipelineMetricItem {
  pipelineId: string;
  pipelineName: string;
  isDefault: boolean;
  totalLeads: number;
  stages: PipelineStageMetricItem[];
}

export interface FollowUpMetrics {
  pending: number;
  overdue: number;
  dueToday: number;
  dueThisWeek: number;
  completed: number;
  myPending: number;
  myOverdue: number;
}

export interface ActivityMetrics {
  total: number;
  today: number;
  thisWeek: number;
  pending: number;
  completed: number;
  byType: Record<ActivityType, number>;
}

export interface ConversionMetrics {
  convertedLeads: number;
  totalEligibleLeads: number;
  conversionRate: number; // e.g. 24.5 for 24.5%
  bySource: Array<{
    source: LeadSource;
    label: string;
    converted: number;
    total: number;
    rate: number;
  }>;
  byAssignee: Array<{
    userId: string;
    name: string;
    email: string;
    converted: number;
    total: number;
    rate: number;
  }>;
}

export interface MyWorkMetrics {
  assignedLeadsCount: number;
  pendingFollowUpsCount: number;
  overdueFollowUpsCount: number;
  completedFollowUpsCount: number;
  overdueFollowUps: Array<{
    id: string;
    title: string;
    dueDate: string;
    dueTime: string | null;
    leadId: string;
    leadName: string;
  }>;
  followUpsDueToday: Array<{
    id: string;
    title: string;
    dueDate: string;
    dueTime: string | null;
    leadId: string;
    leadName: string;
  }>;
  recentAssignedLeads: Array<{
    id: string;
    name: string;
    email: string | null;
    status: LeadStatus;
    createdAt: Date;
  }>;
  recentActivities: Array<{
    id: string;
    type: ActivityType;
    title: string;
    entityType: string;
    entityId: string;
    createdAt: Date;
  }>;
}

export type NeedsAttentionCategory =
  | "overdue_follow_up"
  | "past_due_activity"
  | "no_next_action"
  | "uncontacted_lead";

export interface NeedsAttentionItem {
  id: string;
  category: NeedsAttentionCategory;
  title: string;
  description: string;
  entityType: "lead" | "contact" | "company";
  entityId: string;
  entityName: string;
  urgency: "high" | "medium";
  timestamp: Date | string;
  link: string;
}

export interface DashboardData {
  dateRange: {
    from: string;
    to: string;
    preset: DashboardDateRangePreset;
  };
  leads: LeadMetrics;
  sources: LeadSourceMetricItem[];
  pipelines: PipelineMetricItem[];
  followUps: FollowUpMetrics;
  activities: ActivityMetrics;
  conversion: ConversionMetrics;
  myWork: MyWorkMetrics;
  needsAttention: NeedsAttentionItem[];
}

export type DashboardWidgetKey =
  | "metrics_overview"
  | "lead_status"
  | "lead_sources"
  | "pipeline_stages"
  | "follow_ups"
  | "activity_summary"
  | "conversion"
  | "conversion_metrics"
  | "my_work"
  | "needs_attention";

export interface DashboardWidgetConfig {
  key: DashboardWidgetKey;
  label: string;
  defaultVisible: boolean;
  adminOnly?: boolean;
  allowedRoles?: string[];
}

export const DASHBOARD_WIDGET_CONFIGS: DashboardWidgetConfig[] = [
  {
    key: "metrics_overview",
    label: "Key Metrics",
    defaultVisible: true,
    allowedRoles: ["Organization Admin", "manager", "counsellor", "sales"],
  },
  {
    key: "my_work",
    label: "My Work",
    defaultVisible: true,
    allowedRoles: ["Organization Admin", "manager", "counsellor", "sales"],
  },
  {
    key: "needs_attention",
    label: "Needs Attention",
    defaultVisible: true,
    allowedRoles: ["Organization Admin", "manager", "counsellor", "sales"],
  },
  {
    key: "pipeline_stages",
    label: "Pipelines & Stages",
    defaultVisible: true,
    allowedRoles: ["Organization Admin", "manager", "counsellor", "sales"],
  },
  {
    key: "follow_ups",
    label: "Follow-ups & Actions",
    defaultVisible: true,
    allowedRoles: ["Organization Admin", "manager", "counsellor", "sales"],
  },
  {
    key: "lead_status",
    label: "Lead Status Distribution",
    defaultVisible: true,
    allowedRoles: ["Organization Admin", "manager", "counsellor", "sales"],
  },
  {
    key: "lead_sources",
    label: "Leads by Source",
    defaultVisible: true,
    allowedRoles: ["Organization Admin", "manager", "sales"],
  },
  {
    key: "conversion",
    label: "Conversion Intelligence",
    defaultVisible: true,
    allowedRoles: ["Organization Admin", "manager"],
  },
  {
    key: "conversion_metrics",
    label: "Conversion Intelligence",
    defaultVisible: true,
    allowedRoles: ["Organization Admin", "manager"],
  },
  {
    key: "activity_summary",
    label: "Operational Activities",
    defaultVisible: true,
    allowedRoles: ["Organization Admin", "manager", "counsellor", "sales"],
  },
];
