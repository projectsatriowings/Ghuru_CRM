import { type DashboardDateRange, type DashboardDateRangePreset } from "@/lib/types/dashboard";

/**
 * Resolves a date range preset or explicit from/to dates into concrete from/to Date boundaries.
 * All computations are deterministic.
 */
export function resolveDateRange(
  preset?: string | null,
  customFrom?: string | Date | null,
  customTo?: string | Date | null
): DashboardDateRange {
  const now = new Date();
  const selectedPreset: DashboardDateRangePreset = (preset as DashboardDateRangePreset) || "last_30_days";

  if (selectedPreset === "custom" && customFrom && customTo) {
    const from = new Date(customFrom);
    const to = new Date(customTo);
    if (!isNaN(from.getTime()) && !isNaN(to.getTime())) {
      from.setHours(0, 0, 0, 0);
      to.setHours(23, 59, 59, 999);
      return { from, to, preset: "custom" };
    }
  }

  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);

  switch (selectedPreset) {
    case "today": {
      return {
        from: startOfToday,
        to: endOfToday,
        preset: "today",
      };
    }

    case "yesterday": {
      const from = new Date(startOfToday);
      from.setDate(from.getDate() - 1);

      const to = new Date(endOfToday);
      to.setDate(to.getDate() - 1);

      return {
        from,
        to,
        preset: "yesterday",
      };
    }

    case "last_7_days": {
      const from = new Date(startOfToday);
      from.setDate(from.getDate() - 6); // Includes today + 6 previous days = 7 days

      return {
        from,
        to: endOfToday,
        preset: "last_7_days",
      };
    }

    case "this_month": {
      const from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const to = endOfToday;

      return {
        from,
        to,
        preset: "this_month",
      };
    }

    case "last_month": {
      // First day of last month
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      // Last day of last month
      const to = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

      return {
        from,
        to,
        preset: "last_month",
      };
    }

    case "last_30_days":
    default: {
      const from = new Date(startOfToday);
      from.setDate(from.getDate() - 29); // 30 days total

      return {
        from,
        to: endOfToday,
        preset: "last_30_days",
      };
    }
  }
}

export const DATE_RANGE_PRESET_LABELS: Record<DashboardDateRangePreset, string> = {
  today: "Today",
  yesterday: "Yesterday",
  last_7_days: "Last 7 Days",
  last_30_days: "Last 30 Days",
  this_month: "This Month",
  last_month: "Last Month",
  custom: "Custom Range",
};

/**
 * Returns the previous equivalent date range for period-over-period comparison.
 * Deterministic and timezone-safe.
 */
export function getPreviousEquivalentDateRange(
  currentRange: DashboardDateRange
): DashboardDateRange {
  const fromMs = currentRange.from.getTime();
  const toMs = currentRange.to.getTime();
  const durationMs = toMs - fromMs;

  const prevTo = new Date(fromMs - 1);
  const prevFrom = new Date(prevTo.getTime() - durationMs);

  return {
    from: prevFrom,
    to: prevTo,
    preset: currentRange.preset,
  };
}

