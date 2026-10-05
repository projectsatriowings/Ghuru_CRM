import { z } from "zod";
import {
  AUTOMATION_ENTITY_TYPES,
  AUTOMATION_TRIGGER_TYPES,
  AUTOMATION_CONDITION_OPERATORS,
  AUTOMATION_ACTION_TYPES,
  AUTOMATION_EXECUTION_STATUSES,
} from "@/lib/types/automations";
import { ACTIVITY_TYPES } from "@/db/schema/activities";

export const automationConditionSchema = z.object({
  field: z.string().min(1, "Field is required").max(100),
  operator: z.enum(AUTOMATION_CONDITION_OPERATORS),
  value: z.any().optional(),
});

export const automationConditionGroupSchema = z.object({
  id: z.string().optional(),
  conditions: z
    .array(automationConditionSchema)
    .min(1, "At least one condition is required in each group"),
});

export const automationActionSchema = z
  .object({
    id: z.string().optional(),
    type: z.enum(AUTOMATION_ACTION_TYPES),
    params: z.record(z.string(), z.any()),
  })
  .superRefine((action, ctx) => {
    switch (action.type) {
      case "create_activity": {
        const type = action.params.type;
        if (!type || !ACTIVITY_TYPES.includes(type)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Activity type must be one of: ${ACTIVITY_TYPES.join(", ")}`,
            path: ["params", "type"],
          });
        }
        if (
          !action.params.title ||
          typeof action.params.title !== "string" ||
          action.params.title.trim() === ""
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Title is required for create_activity action",
            path: ["params", "title"],
          });
        }
        break;
      }
      case "create_follow_up": {
        if (
          !action.params.title ||
          typeof action.params.title !== "string" ||
          action.params.title.trim() === ""
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Title is required for create_follow_up action",
            path: ["params", "title"],
          });
        }
        if (
          !action.params.dueDate ||
          typeof action.params.dueDate !== "string" ||
          action.params.dueDate.trim() === ""
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Due date is required for create_follow_up action",
            path: ["params", "dueDate"],
          });
        }
        break;
      }
      case "assign_owner": {
        if (
          !action.params.targetUserId ||
          typeof action.params.targetUserId !== "string" ||
          action.params.targetUserId.trim() === ""
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Target user ID is required for assign_owner action",
            path: ["params", "targetUserId"],
          });
        }
        break;
      }
      case "update_field": {
        if (
          !action.params.field ||
          typeof action.params.field !== "string" ||
          action.params.field.trim() === ""
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Field name is required for update_field action",
            path: ["params", "field"],
          });
        }
        if (action.params.value === undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Field value is required for update_field action",
            path: ["params", "value"],
          });
        }
        break;
      }
      case "move_pipeline_stage": {
        if (
          !action.params.pipelineId ||
          typeof action.params.pipelineId !== "string" ||
          action.params.pipelineId.trim() === ""
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Pipeline ID is required for move_pipeline_stage action",
            path: ["params", "pipelineId"],
          });
        }
        if (
          !action.params.stageId ||
          typeof action.params.stageId !== "string" ||
          action.params.stageId.trim() === ""
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Stage ID is required for move_pipeline_stage action",
            path: ["params", "stageId"],
          });
        }
        break;
      }
    }
  });

export const createAutomationSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  description: z.string().max(1000).optional().nullable(),
  active: z.boolean().default(true),
  entityType: z.enum(AUTOMATION_ENTITY_TYPES),
  triggerType: z.enum(AUTOMATION_TRIGGER_TYPES),
  conditions: z.array(automationConditionGroupSchema).default([]),
  actions: z
    .array(automationActionSchema)
    .min(1, "At least one action is required"),
});

export type CreateAutomationInput = z.input<typeof createAutomationSchema>;

export const updateAutomationSchema = z.object({
  name: z.string().min(1, "Name cannot be empty").max(255).optional(),
  description: z.string().max(1000).optional().nullable(),
  active: z.boolean().optional(),
  entityType: z.enum(AUTOMATION_ENTITY_TYPES).optional(),
  triggerType: z.enum(AUTOMATION_TRIGGER_TYPES).optional(),
  conditions: z.array(automationConditionGroupSchema).optional(),
  actions: z
    .array(automationActionSchema)
    .min(1, "At least one action is required")
    .optional(),
});

export type UpdateAutomationInput = z.input<typeof updateAutomationSchema>;

export const automationQuerySchema = z.object({
  search: z.string().optional(),
  entityType: z.enum(AUTOMATION_ENTITY_TYPES).or(z.literal("all")).optional(),
  triggerType: z.enum(AUTOMATION_TRIGGER_TYPES).or(z.literal("all")).optional(),
  status: z.enum(["active", "inactive", "archived", "all"]).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  sort: z
    .enum(["name", "entityType", "triggerType", "createdAt", "updatedAt"])
    .default("createdAt"),
  sortDirection: z.enum(["asc", "desc"]).default("desc"),
});

export type AutomationQueryInput = z.infer<typeof automationQuerySchema>;

export const automationExecutionQuerySchema = z.object({
  automationId: z.string().optional(),
  entityType: z.enum(AUTOMATION_ENTITY_TYPES).optional(),
  entityId: z.string().optional(),
  status: z.enum(AUTOMATION_EXECUTION_STATUSES).or(z.literal("all")).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export type AutomationExecutionQueryInput = z.infer<
  typeof automationExecutionQuerySchema
>;
