import { type AIRequestObservabilityLog } from "./ai-types";

// Fixed-size circular buffer for AI request observability in-memory
const MAX_LOG_SIZE = 200;
const observabilityLogs: AIRequestObservabilityLog[] = [];

/**
 * Records an AI request's operational metadata (no sensitive prompts or customer data).
 */
export function recordAIObservabilityLog(
  log: Omit<AIRequestObservabilityLog, "id" | "timestamp">
): AIRequestObservabilityLog {
  const entry: AIRequestObservabilityLog = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    ...log,
  };

  observabilityLogs.unshift(entry);
  if (observabilityLogs.length > MAX_LOG_SIZE) {
    observabilityLogs.pop();
  }

  return entry;
}

/**
 * Returns observability logs filtered by organization.
 */
export function getAIObservabilityLogs(
  organizationId?: string,
  limit = 50
): AIRequestObservabilityLog[] {
  if (!organizationId) {
    return observabilityLogs.slice(0, limit);
  }
  return observabilityLogs
    .filter((l) => l.organizationId === organizationId)
    .slice(0, limit);
}

/**
 * Clears observability logs (useful for unit testing).
 */
export function clearAIObservabilityLogs(): void {
  observabilityLogs.length = 0;
}
