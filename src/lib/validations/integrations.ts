import { z } from "zod";
import {
  INTEGRATION_CATEGORIES,
  INTEGRATION_AUTH_TYPES,
  INTEGRATION_CAPABILITIES,
  PROVIDER_STATUSES,
  INTEGRATION_STATUSES,
  API_KEY_SCOPES,
} from "@/lib/types/integrations";

// --- PROVIDER SCHEMAS ---

export const createIntegrationProviderSchema = z.object({
  key: z
    .string()
    .min(2, "Provider key must be at least 2 characters")
    .max(50, "Provider key cannot exceed 50 characters")
    .regex(/^[a-z0-9_]+$/, "Key must contain only lowercase letters, numbers, and underscores"),
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  description: z.string().max(500).optional().nullable(),
  category: z.enum(INTEGRATION_CATEGORIES).default("custom"),
  authType: z.enum(INTEGRATION_AUTH_TYPES).default("none"),
  capabilities: z.array(z.enum(INTEGRATION_CAPABILITIES)).default([]),
  status: z.enum(PROVIDER_STATUSES).default("active"),
  configSchema: z.record(z.string(), z.unknown()).optional(),
});
export type CreateIntegrationProviderInput = z.infer<
  typeof createIntegrationProviderSchema
>;

export const updateIntegrationProviderSchema = createIntegrationProviderSchema
  .partial()
  .omit({ key: true });
export type UpdateIntegrationProviderInput = z.infer<
  typeof updateIntegrationProviderSchema
>;

// --- ORGANIZATION INTEGRATION SCHEMAS ---

export const createOrganizationIntegrationSchema = z.object({
  providerId: z.string().min(1, "Provider ID is required"),
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  config: z.record(z.string(), z.unknown()).optional(),
  credentials: z
    .object({
      credentialType: z
        .enum(["api_key", "oauth_tokens", "signing_secret", "custom"])
        .default("api_key"),
      secret: z.string().min(1, "Secret value is required"),
    })
    .optional(),
});
export type CreateOrganizationIntegrationInput = z.infer<
  typeof createOrganizationIntegrationSchema
>;

export const updateOrganizationIntegrationSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  status: z.enum(INTEGRATION_STATUSES).optional(),
  credentials: z
    .object({
      credentialType: z
        .enum(["api_key", "oauth_tokens", "signing_secret", "custom"])
        .default("api_key"),
      secret: z.string().min(1, "Secret value is required"),
    })
    .optional(),
});
export type UpdateOrganizationIntegrationInput = z.infer<
  typeof updateOrganizationIntegrationSchema
>;

// --- WEBHOOK SCHEMAS ---

export const createWebhookSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  url: z
    .string()
    .url("Invalid webhook destination URL")
    .refine((url) => {
      try {
        const parsed = new URL(url);
        return parsed.protocol === "https:" || parsed.protocol === "http:";
      } catch {
        return false;
      }
    }, "Webhook URL must be HTTP or HTTPS"),
  subscribedEvents: z
    .array(z.string().min(1))
    .min(1, "Must subscribe to at least one event type"),
  active: z.boolean().optional(),
});
export type CreateWebhookInput = z.infer<typeof createWebhookSchema>;

export const updateWebhookSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  url: z
    .string()
    .url("Invalid webhook destination URL")
    .refine((url) => {
      try {
        const parsed = new URL(url);
        return parsed.protocol === "https:" || parsed.protocol === "http:";
      } catch {
        return false;
      }
    }, "Webhook URL must be HTTP or HTTPS")
    .optional(),
  subscribedEvents: z.array(z.string().min(1)).min(1).optional(),
  active: z.boolean().optional(),
});
export type UpdateWebhookInput = z.infer<typeof updateWebhookSchema>;

export const webhookQuerySchema = z.object({
  active: z
    .string()
    .optional()
    .transform((val) => (val === undefined ? undefined : val === "true")),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

// --- API KEY SCHEMAS ---

export const createApiKeySchema = z.object({
  name: z.string().min(2, "Key name must be at least 2 characters").max(100),
  scopes: z
    .array(z.enum(API_KEY_SCOPES))
    .min(1, "At least one scope must be selected"),
  expiresInDays: z
    .number()
    .int()
    .min(1, "Expiration must be at least 1 day")
    .max(365, "Expiration cannot exceed 365 days")
    .optional(),
});
export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;

export const apiKeyQuerySchema = z.object({
  includeRevoked: z
    .string()
    .optional()
    .transform((val) => val === "true"),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

// --- OAUTH2 SCHEMAS ---

export const initiateOAuthSchema = z.object({
  redirectUri: z.string().url("Valid redirect URL is required"),
});
export type InitiateOAuthInput = z.infer<typeof initiateOAuthSchema>;

export const oauthCallbackSchema = z.object({
  state: z.string().min(1, "State is required"),
  code: z.string().min(1, "Code is required"),
  redirectUri: z.string().url().optional(),
});
export type OAuthCallbackInput = z.infer<typeof oauthCallbackSchema>;

// --- INBOUND EVENTS QUERY SCHEMA ---

export const inboundEventsQuerySchema = z.object({
  status: z
    .enum([
      "received",
      "verified",
      "normalized",
      "processed",
      "duplicate",
      "processing_failed",
    ])
    .optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});
export type InboundEventsQueryInput = z.infer<typeof inboundEventsQuerySchema>;
