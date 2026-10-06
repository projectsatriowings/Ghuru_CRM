/**
 * Milestone 2.10A: CRM Health & Intelligence Configuration Defaults
 */

export interface CrmHealthThresholds {
  newLeadContactHours: number;
  staleLeadDays: number;
  staleDealDays: number;
  approachingCloseDays: number;
  stuckInStageDays: number;
  overdueCriticalDays: number;
  highValueDealThresholds: Record<string, number>;
}

export const CRM_HEALTH_DEFAULTS: CrmHealthThresholds = {
  newLeadContactHours: 24,
  staleLeadDays: 7,
  staleDealDays: 7,
  approachingCloseDays: 7,
  stuckInStageDays: 14,
  overdueCriticalDays: 3,
  highValueDealThresholds: {
    USD: 50000,
    EUR: 50000,
    GBP: 40000,
    INR: 500000,
    CAD: 60000,
    AUD: 60000,
    default: 50000,
  },
};

/**
 * Returns the currency-aware threshold for high-value deal detection.
 */
export function getHighValueThreshold(
  currency: string = "USD",
  thresholds: CrmHealthThresholds = CRM_HEALTH_DEFAULTS
): number {
  const normalized = currency.toUpperCase();
  return (
    thresholds.highValueDealThresholds[normalized] ??
    thresholds.highValueDealThresholds.default ??
    50000
  );
}

/**
 * Checks whether a given deal value meets or exceeds the high-value threshold for its currency.
 */
export function isHighValueDeal(
  value: number,
  currency: string = "USD",
  thresholds: CrmHealthThresholds = CRM_HEALTH_DEFAULTS
): boolean {
  return value >= getHighValueThreshold(currency, thresholds);
}
