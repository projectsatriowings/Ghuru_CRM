import { IntegrationError } from "../integration-errors";

export interface SafeUrlValidationResult {
  safe: boolean;
  reason?: string;
  url?: URL;
}

export interface SafeFetchOptions extends RequestInit {
  timeoutMs?: number;
  maxResponseSizeBytes?: number;
  allowHttpInDev?: boolean;
}

/**
 * Checks if an IPv4 address belongs to a private, loopback, or link-local range.
 */
function isPrivateOrLocalIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return false;
  }

  // 0.0.0.0/8 (Current network)
  if (parts[0] === 0) return true;

  // 10.0.0.0/8 (Private network)
  if (parts[0] === 10) return true;

  // 127.0.0.0/8 (Loopback)
  if (parts[0] === 127) return true;

  // 169.254.0.0/16 (Link-local, AWS/GCP/Azure metadata 169.254.169.254)
  if (parts[0] === 169 && parts[1] === 254) return true;

  // 172.16.0.0/12 (Private network: 172.16.0.0 - 172.31.255.255)
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;

  // 192.168.0.0/16 (Private network)
  if (parts[0] === 192 && parts[1] === 168) return true;

  // 100.64.0.0/10 (Carrier-grade NAT)
  if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true;

  return false;
}

/**
 * Checks if an IPv6 address is loopback, link-local, or unique local.
 */
function isPrivateOrLocalIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  if (normalized === "::1" || normalized === "::") return true;
  if (normalized.startsWith("fe80:") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb")) return true;
  if (normalized.startsWith("fc00:") || normalized.startsWith("fd")) return true;
  return false;
}

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata.google.internal",
  "instance-data",
  "169.254.169.254",
]);

/**
 * Validates a target URL against SSRF vulnerabilities.
 */
export function validateTargetUrl(
  urlString: string,
  options: { allowHttpInDev?: boolean } = {}
): SafeUrlValidationResult {
  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    return { safe: false, reason: "Malformed URL syntax." };
  }

  const isHttp = parsed.protocol === "http:";
  const isHttps = parsed.protocol === "https:";

  if (!isHttps && !isHttp) {
    return {
      safe: false,
      reason: `Unsupported URL protocol '${parsed.protocol}'. Only HTTPS is permitted.`,
    };
  }

  // Reject HTTP unless specifically allowed in dev/test
  const isDev = process.env.NODE_ENV !== "production";
  if (isHttp && !(isDev && options.allowHttpInDev)) {
    return {
      safe: false,
      reason: "Insecure HTTP protocol is not permitted. Only HTTPS is allowed.",
    };
  }

  const hostname = parsed.hostname.toLowerCase();

  // Reject explicitly blocked hostnames
  if (BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith(".localhost") || hostname.endsWith(".local") || hostname.endsWith(".internal")) {
    return {
      safe: false,
      reason: `Access to internal host '${hostname}' is blocked for security reasons.`,
    };
  }

  // Check IPv4 literal
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(hostname)) {
    if (isPrivateOrLocalIPv4(hostname)) {
      return {
        safe: false,
        reason: `Access to private/local IP range '${hostname}' is prohibited.`,
      };
    }
  }

  // Check IPv6 literal
  if (hostname.startsWith("[") && hostname.endsWith("]")) {
    const rawIp = hostname.slice(1, -1);
    if (isPrivateOrLocalIPv6(rawIp)) {
      return {
        safe: false,
        reason: `Access to private/local IPv6 range '${rawIp}' is prohibited.`,
      };
    }
  }

  return { safe: true, url: parsed };
}

/**
 * Performs a safe outbound HTTP request protected against SSRF, hanging sockets,
 * and oversized responses.
 */
export async function safeFetch(
  url: string,
  options: SafeFetchOptions = {}
): Promise<Response> {
  const {
    timeoutMs = 8000,
    maxResponseSizeBytes = 512 * 1024, // 512 KB
    allowHttpInDev = false,
    ...fetchOptions
  } = options;

  // 1. SSRF validation
  const validation = validateTargetUrl(url, { allowHttpInDev });
  if (!validation.safe) {
    throw new IntegrationError(
      "SSRF_BLOCKED",
      `Outbound HTTP request blocked: ${validation.reason}`
    );
  }

  // 2. Bound timeout
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const contentLength = response.headers.get("content-length");
    if (contentLength && Number(contentLength) > maxResponseSizeBytes) {
      throw new IntegrationError(
        "INVALID_PROVIDER_RESPONSE",
        `Response size ${contentLength} exceeds maximum allowed size ${maxResponseSizeBytes} bytes.`
      );
    }

    return response;
  } catch (err: unknown) {
    clearTimeout(timeout);
    if (err instanceof IntegrationError) throw err;

    if (err instanceof Error && err.name === "AbortError") {
      throw new IntegrationError(
        "TIMEOUT",
        `Outbound HTTP request timed out after ${timeoutMs}ms.`
      );
    }

    const message = err instanceof Error ? err.message : "Network error";
    throw new IntegrationError(
      "PROVIDER_UNAVAILABLE",
      `Outbound request failed: ${message}`
    );
  }
}
