import { z } from "zod";
import { AIError } from "./ai-errors";

/**
 * Validated AI provider configuration schema.
 */
export const aiConfigSchema = z.object({
  enabled: z.boolean().default(true),
  providerType: z.enum(["mock", "openai-compatible"]).default("mock"),
  model: z.string().min(1, "Model must be specified").default("gpt-4o-mini"),
  baseUrl: z
    .string()
    .url("Base URL must be a valid URL")
    .default("https://api.openai.com/v1/chat/completions"),
  apiKey: z.string().optional(),
  timeoutMs: z
    .number()
    .int()
    .min(1000, "Timeout must be at least 1000ms")
    .max(120000, "Timeout must not exceed 120s")
    .default(25000),
  maxTokens: z.number().int().min(50).max(8000).default(2000),
  temperature: z.number().min(0).max(1).default(0.1),
});

export type AIConfig = z.infer<typeof aiConfigSchema>;

export interface SafePublicAIConfig {
  enabled: boolean;
  providerType: "mock" | "openai-compatible";
  model: string;
  isConfigured: boolean;
}

/**
 * Reads and validates server-side AI configuration from environment variables.
 * Never exposes the apiKey to client-side code or public responses.
 */
export function loadAIConfig(): AIConfig {
  const isTest = process.env.NODE_ENV === "test" || Boolean(process.env.VITEST);
  const rawEnabled = process.env.AI_ENABLED;
  const enabled = rawEnabled === undefined ? true : rawEnabled !== "false" && rawEnabled !== "0";

  const rawProvider = process.env.AI_PROVIDER;
  const rawApiKey = process.env.AI_API_KEY?.trim();

  // Determine provider type: default to openai-compatible if key exists in non-test mode, otherwise mock
  let providerType: "mock" | "openai-compatible" = "mock";
  if (rawProvider === "openai-compatible" || rawProvider === "mock") {
    providerType = rawProvider;
  } else if (rawApiKey && !isTest) {
    providerType = "openai-compatible";
  }

  const rawTimeout = process.env.AI_TIMEOUT_MS
    ? parseInt(process.env.AI_TIMEOUT_MS, 10)
    : 25000;

  const rawConfig = {
    enabled,
    providerType,
    model: process.env.AI_MODEL || "gpt-4o-mini",
    baseUrl: process.env.AI_API_URL || "https://api.openai.com/v1/chat/completions",
    apiKey: rawApiKey || undefined,
    timeoutMs: isNaN(rawTimeout) ? 25000 : rawTimeout,
    maxTokens: 2000,
    temperature: 0.1,
  };

  const parsed = aiConfigSchema.safeParse(rawConfig);
  if (!parsed.success) {
    throw new AIError(
      "PROVIDER_NOT_CONFIGURED",
      "Invalid AI configuration. Check server environment variables."
    );
  }

  return parsed.data;
}

/**
 * Returns a sanitized configuration object safe for returning to API callers or logging.
 * NEVER includes API key or internal URLs.
 */
export function getSafePublicAIConfig(): SafePublicAIConfig {
  const config = loadAIConfig();
  return {
    enabled: config.enabled,
    providerType: config.providerType,
    model: config.model,
    isConfigured:
      config.enabled &&
      (config.providerType === "mock" || Boolean(config.apiKey && config.apiKey.length > 0)),
  };
}
