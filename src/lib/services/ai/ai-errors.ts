import { ForbiddenError } from "@/lib/errors";

export type AIErrorCategory =
  | "PROVIDER_NOT_CONFIGURED"
  | "PROVIDER_TIMEOUT"
  | "PROVIDER_UNAVAILABLE"
  | "PROVIDER_AUTH_ERROR"
  | "PROVIDER_RATE_LIMITED"
  | "INVALID_PROVIDER_RESPONSE"
  | "AI_REQUEST_LIMIT_EXCEEDED"
  | "AI_PERMISSION_DENIED"
  | "AI_CONTEXT_UNAVAILABLE";

const DEFAULT_USER_MESSAGES: Record<AIErrorCategory, string> = {
  PROVIDER_NOT_CONFIGURED:
    "AI intelligence provider is not configured. Your CRM data and standard dashboard remain fully operational.",
  PROVIDER_TIMEOUT:
    "AI request timed out. Standard CRM calculations remain accurate and accessible.",
  PROVIDER_UNAVAILABLE:
    "AI service is temporarily unavailable. Your CRM data is safe and the dashboard is unaffected.",
  PROVIDER_AUTH_ERROR:
    "AI provider authentication failed. Standard CRM intelligence remains available.",
  PROVIDER_RATE_LIMITED:
    "AI provider is currently rate limited. Please try again shortly.",
  INVALID_PROVIDER_RESPONSE:
    "AI provider returned an unparseable response. Standard deterministic CRM metrics remain available.",
  AI_REQUEST_LIMIT_EXCEEDED:
    "AI usage limit exceeded for your organization. Contact your administrator or try again later.",
  AI_PERMISSION_DENIED:
    "You do not have permission to access AI intelligence. Contact your administrator.",
  AI_CONTEXT_UNAVAILABLE:
    "CRM context could not be assembled for AI intelligence. Standard CRM dashboards remain available.",
};

const CATEGORY_STATUS_CODES: Record<AIErrorCategory, number> = {
  PROVIDER_NOT_CONFIGURED: 503,
  PROVIDER_TIMEOUT: 504,
  PROVIDER_UNAVAILABLE: 503,
  PROVIDER_AUTH_ERROR: 502,
  PROVIDER_RATE_LIMITED: 429,
  INVALID_PROVIDER_RESPONSE: 502,
  AI_REQUEST_LIMIT_EXCEEDED: 429,
  AI_PERMISSION_DENIED: 403,
  AI_CONTEXT_UNAVAILABLE: 503,
};

export class AIError extends ForbiddenError {
  public readonly category: AIErrorCategory;
  public readonly correlationId?: string;

  constructor(
    category: AIErrorCategory,
    userMessage?: string,
    statusCode?: number,
    correlationId?: string
  ) {
    const finalMessage = userMessage || DEFAULT_USER_MESSAGES[category];
    const finalStatus = statusCode || CATEGORY_STATUS_CODES[category] || 500;
    super(finalMessage);
    this.statusCode = finalStatus;
    this.code = category;
    this.category = category;
    this.correlationId = correlationId;
    this.name = "AIError";
  }
}

/**
 * Normalizes any caught error into a safe, well-categorized AIError
 * ensuring no credentials, keys, or stack traces leak to the client.
 */
export function normalizeAIError(err: unknown, correlationId?: string): AIError {
  if (err instanceof AIError) {
    return err;
  }

  const rawMessage = err instanceof Error ? err.message : String(err);
  const lower = rawMessage.toLowerCase();

  if (lower.includes("not configured") || lower.includes("missing api key")) {
    return new AIError("PROVIDER_NOT_CONFIGURED", undefined, undefined, correlationId);
  }

  if (lower.includes("timeout") || lower.includes("timed out") || lower.includes("aborterror")) {
    return new AIError("PROVIDER_TIMEOUT", undefined, undefined, correlationId);
  }

  if (lower.includes("rate limit") || lower.includes("429")) {
    return new AIError("PROVIDER_RATE_LIMITED", undefined, undefined, correlationId);
  }

  if (lower.includes("401") || lower.includes("403") || lower.includes("unauthorized")) {
    return new AIError("PROVIDER_AUTH_ERROR", undefined, undefined, correlationId);
  }

  if (lower.includes("limit exceeded") || lower.includes("quota")) {
    return new AIError("AI_REQUEST_LIMIT_EXCEEDED", undefined, undefined, correlationId);
  }

  if (lower.includes("permission") || lower.includes("forbidden")) {
    return new AIError("AI_PERMISSION_DENIED", undefined, undefined, correlationId);
  }

  return new AIError("PROVIDER_UNAVAILABLE", undefined, undefined, correlationId);
}
