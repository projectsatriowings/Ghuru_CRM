import { AppError } from "@/lib/errors";

export const INTEGRATION_ERROR_CODES = [
  "INVALID_CONFIGURATION",
  "AUTHENTICATION_FAILED",
  "AUTHORIZATION_FAILED",
  "SIGNATURE_INVALID",
  "SIGNATURE_EXPIRED",
  "PROVIDER_UNAVAILABLE",
  "RATE_LIMITED",
  "INVALID_PROVIDER_RESPONSE",
  "DUPLICATE_EVENT",
  "UNSUPPORTED_EVENT",
  "UNSUPPORTED_CAPABILITY",
  "TIMEOUT",
  "SSRF_BLOCKED",
  "INTERNAL_ERROR",
] as const;

export type IntegrationErrorCode = (typeof INTEGRATION_ERROR_CODES)[number];

const ERROR_STATUS_MAP: Record<IntegrationErrorCode, number> = {
  INVALID_CONFIGURATION: 400,
  AUTHENTICATION_FAILED: 401,
  AUTHORIZATION_FAILED: 403,
  SIGNATURE_INVALID: 400,
  SIGNATURE_EXPIRED: 400,
  DUPLICATE_EVENT: 409,
  UNSUPPORTED_EVENT: 400,
  UNSUPPORTED_CAPABILITY: 400,
  SSRF_BLOCKED: 400,
  RATE_LIMITED: 429,
  PROVIDER_UNAVAILABLE: 502,
  INVALID_PROVIDER_RESPONSE: 502,
  TIMEOUT: 504,
  INTERNAL_ERROR: 500,
};

/**
 * Strips potentially sensitive tokens or secret substrings from error messages.
 */
function sanitizeErrorMessage(msg: string): string {
  return msg
    .replace(/(bearer\s+)[a-zA-Z0-9_\-\.]+/gi, "$1[REDACTED]")
    .replace(/(key[=:\s]+)[a-zA-Z0-9_\-\.]+/gi, "$1[REDACTED]")
    .replace(/(secret[=:\s]+)[a-zA-Z0-9_\-\.]+/gi, "$1[REDACTED]")
    .replace(/(token[=:\s]+)[a-zA-Z0-9_\-\.]+/gi, "$1[REDACTED]");
}

/**
 * Normalized integration error with safe diagnostic categorization.
 */
export class IntegrationError extends AppError {
  public readonly integrationCode: IntegrationErrorCode;
  public readonly providerKey?: string;
  public readonly safeDetails?: Record<string, unknown>;

  constructor(
    code: IntegrationErrorCode,
    message: string,
    options: {
      providerKey?: string;
      statusCode?: number;
      safeDetails?: Record<string, unknown>;
    } = {}
  ) {
    const status = options.statusCode ?? ERROR_STATUS_MAP[code] ?? 500;
    const cleanMessage = sanitizeErrorMessage(message);
    super(cleanMessage, status, code);
    this.name = "IntegrationError";
    this.integrationCode = code;
    this.providerKey = options.providerKey;
    this.safeDetails = options.safeDetails;
  }
}
