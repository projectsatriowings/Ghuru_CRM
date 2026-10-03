export const INITIAL_PERMISSIONS = [
  {
    key: "organization.view",
    description: "View organization details and dashboard",
  },
  {
    key: "organization.update",
    description: "Update organization settings and details",
  },
  {
    key: "users.view",
    description: "View organization members and their roles",
  },
  {
    key: "users.create",
    description: "Invite or add new users to the organization",
  },
  {
    key: "users.update",
    description: "Change member roles or update member status",
  },
  {
    key: "users.delete",
    description: "Remove members from the organization",
  },
  {
    key: "roles.view",
    description: "View organization roles and assigned permissions",
  },
  {
    key: "roles.create",
    description: "Create new custom roles in the organization",
  },
  {
    key: "roles.update",
    description: "Edit roles and configure assigned permissions",
  },
  {
    key: "roles.delete",
    description: "Delete custom roles from the organization",
  },
  {
    key: "custom_fields.view",
    description: "View organization custom field definitions",
  },
  {
    key: "custom_fields.create",
    description: "Create custom fields for workspace entities",
  },
  {
    key: "custom_fields.update",
    description: "Update custom field definitions and display order",
  },
  {
    key: "custom_fields.delete",
    description: "Archive or delete custom field definitions",
  },
  {
    key: "leads.view",
    description: "View organization leads and prospect details",
  },
  {
    key: "leads.create",
    description: "Create new leads in the organization",
  },
  {
    key: "leads.update",
    description: "Update lead details, assignment, and status",
  },
  {
    key: "leads.delete",
    description: "Archive or deactivate leads in the organization",
  },
  {
    key: "activities.view",
    description: "View lead activity timeline and activity details",
  },
  {
    key: "activities.create",
    description: "Create new activities for leads",
  },
  {
    key: "activities.update",
    description: "Update lead activity details",
  },
  {
    key: "activities.delete",
    description: "Archive or delete lead activities",
  },
  {
    key: "follow_ups.view",
    description: "View lead follow-ups and next action details",
  },
  {
    key: "follow_ups.create",
    description: "Create new follow-ups and next actions for leads",
  },
  {
    key: "follow_ups.update",
    description: "Update, complete, or cancel follow-ups",
  },
  {
    key: "follow_ups.delete",
    description: "Archive or delete follow-ups",
  },
  {
    key: "pipelines.view",
    description: "View organization pipelines and stage configuration",
  },
  {
    key: "pipelines.create",
    description: "Create new pipelines and pipeline stages",
  },
  {
    key: "pipelines.update",
    description: "Update pipelines, edit stages, and reorder stages",
  },
  {
    key: "pipelines.delete",
    description: "Archive or delete pipelines and pipeline stages",
  },
] as const;

export type PermissionKey = (typeof INITIAL_PERMISSIONS)[number]["key"];

export const ALL_PERMISSION_KEYS = INITIAL_PERMISSIONS.map((p) => p.key);

export const DEFAULT_ORG_ADMIN_ROLE = "Organization Admin";
export const DEFAULT_ORG_ADMIN_DESCRIPTION =
  "Full administrative access to the organization";
