/**
 * Milestone 2.10E: Multi-Instance Safe Rate Limiter Abstraction
 *
 * ARCHITECTURAL NOTE ON DISTRIBUTED DEPLOYMENT:
 * Ghuru CRM currently does not include a Redis or distributed cache dependency.
 * To maintain architectural purity and zero unnecessary bloat, this module implements
 * an in-memory sliding window rate limiter as the default while exposing a clean
 * AIRateLimiter interface. When deploying across multi-node clusters, an Upstash/Redis
 * adapter can implement this interface without modifying any application business logic.
 */

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetInSeconds: number;
}

export interface AIRateLimiter {
  checkRateLimit(
    organizationId: string,
    userId: string,
    endpoint?: string,
    maxRequests?: number,
    windowMs?: number
  ): RateLimitResult;
  reset(organizationId?: string, userId?: string): void;
}

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const DEFAULT_WINDOW_MS = 60 * 1000; // 1 minute window
const DEFAULT_MAX_REQUESTS = 30; // 30 requests per minute per user/organization

export class InMemoryAIRateLimiter implements AIRateLimiter {
  private map = new Map<string, RateLimitRecord>();

  private buildKey(organizationId: string, userId: string, endpoint?: string): string {
    return endpoint
      ? `org_${organizationId}_user_${userId}_ep_${endpoint}`
      : `org_${organizationId}_user_${userId}`;
  }

  checkRateLimit(
    organizationId: string,
    userId: string,
    endpoint?: string,
    maxRequests = DEFAULT_MAX_REQUESTS,
    windowMs = DEFAULT_WINDOW_MS
  ): RateLimitResult {
    const key = this.buildKey(organizationId, userId, endpoint);
    const now = Date.now();
    const existing = this.map.get(key);

    if (!existing || now > existing.resetAt) {
      this.map.set(key, { count: 1, resetAt: now + windowMs });
      return {
        allowed: true,
        remaining: maxRequests - 1,
        resetInSeconds: Math.ceil(windowMs / 1000),
      };
    }

    if (existing.count >= maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetInSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
      };
    }

    existing.count += 1;
    return {
      allowed: true,
      remaining: maxRequests - existing.count,
      resetInSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  reset(organizationId?: string, userId?: string): void {
    if (!organizationId && !userId) {
      this.map.clear();
      return;
    }
    const prefix = organizationId && userId
      ? `org_${organizationId}_user_${userId}`
      : organizationId
      ? `org_${organizationId}`
      : "";
    for (const key of this.map.keys()) {
      if (key.startsWith(prefix)) {
        this.map.delete(key);
      }
    }
  }
}

// Global active rate limiter singleton
let _activeRateLimiter: AIRateLimiter = new InMemoryAIRateLimiter();

export function getAIRateLimiter(): AIRateLimiter {
  return _activeRateLimiter;
}

export function setAIRateLimiter(limiter: AIRateLimiter): void {
  _activeRateLimiter = limiter;
}

/**
 * Backward-compatible helper used across services and tests.
 */
export function checkAIRateLimit(
  keyOrOrg: string,
  maxRequests = DEFAULT_MAX_REQUESTS,
  userId?: string
): RateLimitResult {
  // If called with separate org and user:
  if (userId) {
    return _activeRateLimiter.checkRateLimit(keyOrOrg, userId, undefined, maxRequests);
  }
  // Otherwise keyOrOrg is a composite key like `briefing_org123_user456`
  const parts = keyOrOrg.split("_");
  const org = parts[1] || "default_org";
  const user = parts[2] || "default_user";
  const ep = parts[0] || "ai";
  return _activeRateLimiter.checkRateLimit(org, user, ep, maxRequests);
}

/**
 * Resets rate limit counters (useful for unit tests).
 */
export function resetAIRateLimits(): void {
  _activeRateLimiter.reset();
}
