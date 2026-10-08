import {
  pgTable,
  text,
  timestamp,
  index,
  boolean,
  integer,
  jsonb,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations } from "./organizations";
import { users } from "./users";

// --- PROVIDER REGISTRY ---

export const INTEGRATION_CATEGORIES = [
  "communication",
  "marketing",
  "productivity",
  "payments",
  "analytics",
  "custom",
] as const;
export type IntegrationCategory = (typeof INTEGRATION_CATEGORIES)[number];

export const INTEGRATION_AUTH_TYPES = [
  "oauth2",
  "api_key",
  "hmac",
  "none",
] as const;
export type IntegrationAuthType = (typeof INTEGRATION_AUTH_TYPES)[number];

export const INTEGRATION_CAPABILITIES = [
  "webhook_outbound",
  "webhook_inbound",
  "api_read",
  "api_write",
  "oauth",
  "api_key",
  "sync",
  "event_push",
  "event_pull",
  "message_send",
  "inbound_webhook",
  "outbound_api",
] as const;
export type IntegrationCapability = (typeof INTEGRATION_CAPABILITIES)[number];

export const PROVIDER_STATUSES = [
  "active",
  "beta",
  "deprecated",
  "disabled",
] as const;
export type ProviderStatus = (typeof PROVIDER_STATUSES)[number];

export const integrationProviders = pgTable(
  "integration_providers",
  {
    id: text("id").primaryKey(),
    key: text("key").notNull().unique(),
    name: text("name").notNull(),
    description: text("description"),
    category: text("category").notNull().default("custom"),
    authType: text("auth_type").notNull().default("none"),
    capabilities: jsonb("capabilities")
      .$type<string[]>()
      .notNull()
      .default([]),
    status: text("status").notNull().default("active"),
    configSchema: jsonb("config_schema").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("integration_providers_key_idx").on(table.key),
    index("integration_providers_status_idx").on(table.status),
    index("integration_providers_category_idx").on(table.category),
  ]
);

// --- ORGANIZATION INTEGRATION CONNECTIONS ---

export const INTEGRATION_STATUSES = [
  "disconnected",
  "pending",
  "connected",
  "error",
  "disabled",
] as const;
export type IntegrationStatus = (typeof INTEGRATION_STATUSES)[number];

export const organizationIntegrations = pgTable(
  "organization_integrations",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    providerId: text("provider_id")
      .notNull()
      .references(() => integrationProviders.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    status: text("status").notNull().default("disconnected"),
    config: jsonb("config")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    connectedByUserId: text("connected_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
    lastErrorAt: timestamp("last_error_at", { withTimezone: true }),
    lastErrorCode: text("last_error_code"),
    lastErrorMessage: text("last_error_message"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("org_integrations_org_idx").on(table.organizationId),
    index("org_integrations_provider_idx").on(
      table.organizationId,
      table.providerId
    ),
    index("org_integrations_status_idx").on(
      table.organizationId,
      table.status
    ),
    index("org_integrations_created_idx").on(table.createdAt),
  ]
);

// --- SECURE CREDENTIAL ABSTRACTION ---

export const CREDENTIAL_TYPES = [
  "api_key",
  "oauth_tokens",
  "signing_secret",
  "custom",
] as const;
export type CredentialType = (typeof CREDENTIAL_TYPES)[number];

export const integrationCredentials = pgTable(
  "integration_credentials",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    integrationId: text("integration_id")
      .notNull()
      .references(() => organizationIntegrations.id, { onDelete: "cascade" }),
    credentialType: text("credential_type").notNull().default("api_key"),
    encryptedData: text("encrypted_data").notNull(),
    maskedValue: text("masked_value"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("integration_creds_org_idx").on(table.organizationId),
    index("integration_creds_integration_idx").on(
      table.organizationId,
      table.integrationId
    ),
  ]
);

// --- OUTBOUND WEBHOOK FOUNDATION ---

export const organizationWebhooks = pgTable(
  "organization_webhooks",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    url: text("url").notNull(),
    secret: text("secret").notNull(), // HMAC secret
    subscribedEvents: jsonb("subscribed_events")
      .$type<string[]>()
      .notNull()
      .default([]),
    active: boolean("active").notNull().default(true),
    createdById: text("created_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("org_webhooks_org_idx").on(table.organizationId),
    index("org_webhooks_active_idx").on(
      table.organizationId,
      table.active
    ),
    index("org_webhooks_created_idx").on(table.createdAt),
  ]
);

// --- WEBHOOK DELIVERIES ---

export const WEBHOOK_DELIVERY_STATUSES = [
  "pending",
  "delivering",
  "delivered",
  "failed",
] as const;
export type WebhookDeliveryStatus = (typeof WEBHOOK_DELIVERY_STATUSES)[number];

export const webhookDeliveries = pgTable(
  "webhook_deliveries",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    webhookId: text("webhook_id")
      .notNull()
      .references(() => organizationWebhooks.id, { onDelete: "cascade" }),
    eventId: text("event_id").notNull(),
    eventType: text("event_type").notNull(),
    payload: jsonb("payload").notNull(),
    status: text("status").notNull().default("pending"),
    attemptCount: integer("attempt_count").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(3),
    responseStatus: integer("response_status"),
    responseBody: text("response_body"),
    failureReason: text("failure_reason"),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("webhook_deliveries_org_idx").on(table.organizationId),
    index("webhook_deliveries_webhook_idx").on(
      table.organizationId,
      table.webhookId
    ),
    index("webhook_deliveries_event_idx").on(
      table.organizationId,
      table.eventId
    ),
    index("webhook_deliveries_status_idx").on(
      table.organizationId,
      table.status
    ),
    index("webhook_deliveries_created_idx").on(table.createdAt),
  ]
);

// --- API KEYS ---

export const apiKeys = pgTable(
  "api_keys",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    keyPrefix: text("key_prefix").notNull(),
    keyHash: text("key_hash").notNull(),
    scopes: jsonb("scopes").$type<string[]>().notNull().default([]),
    createdById: text("created_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("api_keys_org_idx").on(table.organizationId),
    index("api_keys_hash_idx").on(table.keyHash),
    index("api_keys_org_revoked_idx").on(
      table.organizationId,
      table.revokedAt
    ),
    index("api_keys_created_idx").on(table.createdAt),
  ]
);

// --- INBOUND INTEGRATION EVENTS (IDEMPOTENCY & AUDIT) ---

export const INBOUND_EVENT_STATUSES = [
  "received",
  "verified",
  "normalized",
  "processed",
  "duplicate",
  "processing_failed",
] as const;
export type InboundEventStatus = (typeof INBOUND_EVENT_STATUSES)[number];

export const integrationInboundEvents = pgTable(
  "integration_inbound_events",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    integrationId: text("integration_id")
      .notNull()
      .references(() => organizationIntegrations.id, { onDelete: "cascade" }),
    providerKey: text("provider_key").notNull(),
    externalEventId: text("external_event_id").notNull(),
    eventType: text("event_type").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    status: text("status").notNull().default("received"),
    attemptCount: integer("attempt_count").notNull().default(1),
    error: text("error"),
    receivedAt: timestamp("received_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("inbound_events_org_idx").on(table.organizationId),
    index("inbound_events_integration_idx").on(
      table.organizationId,
      table.integrationId
    ),
    index("inbound_events_status_idx").on(table.organizationId, table.status),
    index("inbound_events_idempotency_idx").on(
      table.organizationId,
      table.providerKey,
      table.externalEventId
    ),
    index("inbound_events_created_idx").on(table.createdAt),
  ]
);

// --- OAUTH2 STATES (CSRF & SECURITY) ---

export const integrationOAuthStates = pgTable(
  "integration_oauth_states",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    integrationId: text("integration_id")
      .notNull()
      .references(() => organizationIntegrations.id, { onDelete: "cascade" }),
    providerKey: text("provider_key").notNull(),
    state: text("state").notNull().unique(),
    redirectUri: text("redirect_uri"),
    codeVerifier: text("code_verifier"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("oauth_states_state_idx").on(table.state),
    index("oauth_states_org_idx").on(table.organizationId),
    index("oauth_states_integration_idx").on(
      table.organizationId,
      table.integrationId
    ),
    index("oauth_states_expires_idx").on(table.expiresAt),
  ]
);

// --- RELATIONS ---

export const integrationProvidersRelations = relations(
  integrationProviders,
  ({ many }) => ({
    integrations: many(organizationIntegrations),
  })
);

export const organizationIntegrationsRelations = relations(
  organizationIntegrations,
  ({ one, many }) => ({
    organization: one(organizations, {
      fields: [organizationIntegrations.organizationId],
      references: [organizations.id],
    }),
    provider: one(integrationProviders, {
      fields: [organizationIntegrations.providerId],
      references: [integrationProviders.id],
    }),
    connectedByUser: one(users, {
      fields: [organizationIntegrations.connectedByUserId],
      references: [users.id],
    }),
    credentials: many(integrationCredentials),
    inboundEvents: many(integrationInboundEvents),
    oauthStates: many(integrationOAuthStates),
  })
);

export const integrationCredentialsRelations = relations(
  integrationCredentials,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [integrationCredentials.organizationId],
      references: [organizations.id],
    }),
    integration: one(organizationIntegrations, {
      fields: [integrationCredentials.integrationId],
      references: [organizationIntegrations.id],
    }),
  })
);

export const organizationWebhooksRelations = relations(
  organizationWebhooks,
  ({ one, many }) => ({
    organization: one(organizations, {
      fields: [organizationWebhooks.organizationId],
      references: [organizations.id],
    }),
    createdByUser: one(users, {
      fields: [organizationWebhooks.createdById],
      references: [users.id],
    }),
    deliveries: many(webhookDeliveries),
  })
);

export const webhookDeliveriesRelations = relations(
  webhookDeliveries,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [webhookDeliveries.organizationId],
      references: [organizations.id],
    }),
    webhook: one(organizationWebhooks, {
      fields: [webhookDeliveries.webhookId],
      references: [organizationWebhooks.id],
    }),
  })
);

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  organization: one(organizations, {
    fields: [apiKeys.organizationId],
    references: [organizations.id],
  }),
  createdByUser: one(users, {
    fields: [apiKeys.createdById],
    references: [users.id],
  }),
}));

export const integrationInboundEventsRelations = relations(
  integrationInboundEvents,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [integrationInboundEvents.organizationId],
      references: [organizations.id],
    }),
    integration: one(organizationIntegrations, {
      fields: [integrationInboundEvents.integrationId],
      references: [organizationIntegrations.id],
    }),
  })
);

export const integrationOAuthStatesRelations = relations(
  integrationOAuthStates,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [integrationOAuthStates.organizationId],
      references: [organizations.id],
    }),
    integration: one(organizationIntegrations, {
      fields: [integrationOAuthStates.integrationId],
      references: [organizationIntegrations.id],
    }),
  })
);
