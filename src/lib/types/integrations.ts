import {
  INTEGRATION_CATEGORIES,
  INTEGRATION_AUTH_TYPES,
  INTEGRATION_CAPABILITIES,
  PROVIDER_STATUSES,
  INTEGRATION_STATUSES,
  CREDENTIAL_TYPES,
  WEBHOOK_DELIVERY_STATUSES,
  INBOUND_EVENT_STATUSES,
  type InboundEventStatus,
} from "@/db/schema/integrations";

export type {
  IntegrationCategory,
  IntegrationAuthType,
  IntegrationCapability,
  ProviderStatus,
  IntegrationStatus,
  CredentialType,
  WebhookDeliveryStatus,
  InboundEventStatus,
} from "@/db/schema/integrations";

export {
  INTEGRATION_CATEGORIES,
  INTEGRATION_AUTH_TYPES,
  INTEGRATION_CAPABILITIES,
  PROVIDER_STATUSES,
  INTEGRATION_STATUSES,
  CREDENTIAL_TYPES,
  WEBHOOK_DELIVERY_STATUSES,
  INBOUND_EVENT_STATUSES,
};

// --- SUPPORTED API KEY SCOPES ---
export const API_KEY_SCOPES = [
  "leads.read",
  "leads.write",
  "contacts.read",
  "contacts.write",
  "companies.read",
  "companies.write",
  "deals.read",
  "deals.write",
  "activities.read",
  "activities.write",
  "webhooks.read",
  "webhooks.write",
  "integrations.read",
  "integrations.write",
] as const;
export type ApiKeyScope = (typeof API_KEY_SCOPES)[number];

// --- SUPPORTED INTEGRATION EVENT TYPES ---
export const INTEGRATION_EVENT_TYPES = [
  "lead.created",
  "lead.updated",
  "lead.converted",
  "contact.created",
  "contact.updated",
  "company.created",
  "company.updated",
  "deal.created",
  "deal.updated",
  "deal.won",
  "deal.lost",
  "activity.created",
  "follow_up.created",
  "follow_up.completed",
  "*",
] as const;
export type IntegrationEventType = (typeof INTEGRATION_EVENT_TYPES)[number];

// --- INTEGRATION PROVIDER ---
export interface IntegrationProviderItem {
  id: string;
  key: string;
  name: string;
  description: string | null;
  category: string;
  authType: string;
  capabilities: string[];
  status: string;
  configSchema?: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

// --- ORGANIZATION INTEGRATION ---
export interface OrganizationIntegrationItem {
  id: string;
  organizationId: string;
  providerId: string;
  providerKey: string;
  providerName: string;
  name: string;
  status: string;
  config: Record<string, unknown>;
  connectedByUserId: string | null;
  lastSuccessAt: Date | null;
  lastErrorAt: Date | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  hasCredentials: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// --- ORGANIZATION WEBHOOK ---
export interface OrganizationWebhookItem {
  id: string;
  organizationId: string;
  name: string;
  url: string;
  secretMasked: string; // e.g. "whsec_****a1b2"
  subscribedEvents: string[];
  active: boolean;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// --- WEBHOOK DELIVERY ---
export interface WebhookDeliveryItem {
  id: string;
  organizationId: string;
  webhookId: string;
  eventId: string;
  eventType: string;
  payload: Record<string, unknown>;
  status: string;
  attemptCount: number;
  maxAttempts: number;
  responseStatus: number | null;
  responseBody: string | null;
  failureReason: string | null;
  nextAttemptAt: Date | null;
  deliveredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// --- API KEY ITEM ---
export interface ApiKeyItem {
  id: string;
  organizationId: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  createdById: string | null;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatedApiKeyResult {
  key: ApiKeyItem;
  secret: string; // The plaintext token, presented ONCE
}

// --- GENERIC CRM INTEGRATION EVENT ---
export interface IntegrationEvent {
  id: string; // Stable UUID for idempotency
  organizationId: string;
  eventType: string;
  entityType: string;
  entityId: string;
  occurredAt: string;
  payload: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

// --- INBOUND INTEGRATION EVENT ITEM ---
export interface InboundIntegrationEventItem {
  id: string;
  organizationId: string;
  integrationId: string;
  providerKey: string;
  externalEventId: string;
  eventType: string;
  payload: Record<string, unknown>;
  status: InboundEventStatus;
  attemptCount: number;
  error: string | null;
  receivedAt: Date;
  processedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// --- OAUTH STATE ITEM ---
export interface OAuthStateItem {
  id: string;
  organizationId: string;
  integrationId: string;
  providerKey: string;
  state: string;
  redirectUri: string | null;
  codeVerifier: string | null;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}

// --- PROGRAMMATIC API KEY AUTH CONTEXT ---
export interface ApiKeyAuthContext {
  isApiKey: true;
  apiKeyId: string;
  organizationId: string;
  name: string;
  scopes: string[];
  hasScope: (scope: ApiKeyScope | string) => boolean;
}

// --- CONNECTOR FRAMEWORK EXPORTS ---
export * from "./connector";
