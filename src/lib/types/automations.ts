import { ActivityType } from "@/db/schema/activities";

export const AUTOMATION_ENTITY_TYPES = [
  "lead",
  "contact",
  "company",
  "deal",
] as const;
export type AutomationEntityType = (typeof AUTOMATION_ENTITY_TYPES)[number];

export const AUTOMATION_TRIGGER_TYPES = [
  "entity_created",
  "entity_updated",
  "entity_status_changed",
  "entity_assigned",
  "pipeline_stage_changed",
] as const;
export type AutomationTriggerType = (typeof AUTOMATION_TRIGGER_TYPES)[number];

export const AUTOMATION_CONDITION_OPERATORS = [
  "equals",
  "not_equals",
  "contains",
  "not_contains",
  "starts_with",
  "ends_with",
  "greater_than",
  "greater_than_or_equal",
  "less_than",
  "less_than_or_equal",
  "is_empty",
  "is_not_empty",
] as const;
export type AutomationConditionOperator =
  (typeof AUTOMATION_CONDITION_OPERATORS)[number];

export interface AutomationCondition {
  field: string;
  operator: AutomationConditionOperator;
  value?: unknown;
}

export interface AutomationConditionGroup {
  id?: string;
  conditions: AutomationCondition[];
}

export const AUTOMATION_ACTION_TYPES = [
  "create_activity",
  "create_follow_up",
  "assign_owner",
  "update_field",
  "move_pipeline_stage",
] as const;
export type AutomationActionType = (typeof AUTOMATION_ACTION_TYPES)[number];

export interface CreateActivityActionParams {
  type: ActivityType;
  title: string;
  description?: string | null;
  assignedToUserId?: string | null;
  dueDate?: string | null;
}

export interface CreateFollowUpActionParams {
  title: string;
  dueDate: string; // e.g., "today", "+1d", "+2d", "+7d", or YYYY-MM-DD
  dueTime?: string | null;
  description?: string | null;
  assignedToUserId?: string | null;
}

export interface AssignOwnerActionParams {
  targetUserId: string;
}

export interface UpdateFieldActionParams {
  field: string;
  value: unknown;
}

export interface MovePipelineStageActionParams {
  pipelineId: string;
  stageId: string;
}

export interface AutomationActionConfig {
  id?: string;
  type: AutomationActionType;
  params: Record<string, unknown>;
}

export const AUTOMATION_EXECUTION_STATUSES = [
  "running",
  "completed",
  "failed",
  "skipped",
] as const;
export type AutomationExecutionStatus =
  (typeof AUTOMATION_EXECUTION_STATUSES)[number];

export interface AutomationWithRelations {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  active: boolean;
  entityType: AutomationEntityType;
  triggerType: AutomationTriggerType;
  conditions: AutomationConditionGroup[];
  actions: AutomationActionConfig[];
  createdByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
  createdByUser?: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  } | null;
  executionStats?: {
    total: number;
    lastExecutedAt: Date | null;
    lastStatus: AutomationExecutionStatus | null;
  };
}

export interface PaginatedAutomationsResult {
  data: AutomationWithRelations[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface AutomationExecutionWithRelations {
  id: string;
  organizationId: string;
  automationId: string;
  eventType: string;
  entityType: string;
  entityId: string;
  status: AutomationExecutionStatus;
  startedAt: Date;
  completedAt: Date | null;
  errorMessage: string | null;
  metadata: {
    conditionsEvaluated?: boolean;
    conditionResults?: Array<{
      groupIndex: number;
      passed: boolean;
      results: Array<{
        field: string;
        operator: string;
        expected: unknown;
        actual: unknown;
        matched: boolean;
      }>;
    }>;
    actionsExecuted?: Array<{
      type: string;
      status: "success" | "failed";
      output?: unknown;
      error?: string;
    }>;
    depth?: number;
    correlationId?: string;
    skippedReason?: string;
    [key: string]: unknown;
  } | null;
  automation?: {
    id: string;
    name: string;
    entityType: string;
    triggerType: string;
  } | null;
}

export interface PaginatedExecutionsResult {
  data: AutomationExecutionWithRelations[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface AutomationEvent {
  organizationId: string;
  entityType: AutomationEntityType;
  entityId: string;
  eventType: AutomationTriggerType;
  occurredAt?: Date;
  actorUserId?: string | null;
  payload?: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    previous?: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    current?: any;
    changedFields?: string[];
    [key: string]: unknown;
  };
}

export interface AutomationExecutionContext {
  correlationId: string;
  depth: number;
  visitedAutomationIds: Set<string>;
}
