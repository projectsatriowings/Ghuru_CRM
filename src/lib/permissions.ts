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
    key: "dashboard.view",
    description: "View CRM operational dashboard and intelligence",
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
  {
    key: "contacts.view",
    description: "View organization contacts and contact details",
  },
  {
    key: "contacts.create",
    description: "Create new contacts in the organization",
  },
  {
    key: "contacts.update",
    description: "Update contacts, edit details, and modify assignments",
  },
  {
    key: "contacts.delete",
    description: "Archive or deactivate contacts in the organization",
  },
  {
    key: "companies.view",
    description: "View organization companies and company details",
  },
  {
    key: "companies.create",
    description: "Create new companies in the organization",
  },
  {
    key: "companies.update",
    description: "Update company details and ownership",
  },
  {
    key: "companies.delete",
    description: "Archive or deactivate companies in the organization",
  },
  {
    key: "deals.view",
    description: "View organization deals and opportunity details",
  },
  {
    key: "deals.create",
    description: "Create new deals in the organization",
  },
  {
    key: "deals.update",
    description: "Update deal details, stage, status, and assignment",
  },
  {
    key: "deals.delete",
    description: "Archive or deactivate deals in the organization",
  },
  {
    key: "automations.view",
    description: "View organization automations and execution logs",
  },
  {
    key: "automations.create",
    description: "Create new automations in the organization",
  },
  {
    key: "automations.update",
    description: "Update automations, activate/deactivate, and configure rules",
  },
  {
    key: "automations.delete",
    description: "Archive or delete automations in the organization",
  },
  {
    key: "intelligence.view",
    description: "View organization CRM health, operational risks, and attention intelligence",
  },
  {
    key: "teams.view",
    description: "View organization teams and team memberships",
  },
  {
    key: "teams.create",
    description: "Create new teams in the organization",
  },
  {
    key: "teams.update",
    description: "Update team details and manage team members",
  },
  {
    key: "teams.delete",
    description: "Archive or delete teams in the organization",
  },
  {
    key: "ai.view",
    description: "View AI intelligence briefing, recommendations, metric explanations, and CRM Q&A",
  },
  {
    key: "ai_governance.view",
    description: "View AI usage, audit events, provider status, and governance metrics",
  },
  {
    key: "ai_governance.manage",
    description: "Modify organization-level AI governance settings and quotas",
  },
  {
    key: "integrations.view",
    description: "View organization integrations, providers, webhooks, and API keys",
  },
  {
    key: "integrations.connect",
    description: "Connect and configure external integration providers",
  },
  {
    key: "integrations.update",
    description: "Update integration configuration and toggle active status",
  },
  {
    key: "integrations.disconnect",
    description: "Disconnect or remove external integration connections",
  },
  {
    key: "integrations.test",
    description: "Test integration connectivity and provider status",
  },
  {
    key: "webhooks.manage",
    description: "Create, update, test, and delete outbound webhooks",
  },
  {
    key: "api_keys.manage",
    description: "Create, view, and revoke organization API keys",
  },
] as const;

export type PermissionKey = (typeof INITIAL_PERMISSIONS)[number]["key"];

export const ALL_PERMISSION_KEYS = INITIAL_PERMISSIONS.map((p) => p.key);

export const DEFAULT_ORG_ADMIN_ROLE = "Organization Admin";
export const DEFAULT_ORG_ADMIN_DESCRIPTION =
  "Full administrative access to the organization";
