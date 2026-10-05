import {
  AutomationCondition,
  AutomationConditionGroup,
  AutomationConditionOperator,
} from "@/lib/types/automations";

/**
 * Pure safe operator evaluation. No eval(), Function(), or arbitrary dynamic execution.
 */
export function evaluateOperator(
  operator: AutomationConditionOperator,
  actual: unknown,
  expected: unknown
): boolean {
  switch (operator) {
    case "is_empty":
      return (
        actual === null ||
        actual === undefined ||
        (typeof actual === "string" && actual.trim() === "") ||
        (Array.isArray(actual) && actual.length === 0)
      );

    case "is_not_empty":
      return !evaluateOperator("is_empty", actual, expected);

    case "equals": {
      if (actual === null || actual === undefined) {
        return (
          expected === null ||
          expected === undefined ||
          (typeof expected === "string" && expected === "")
        );
      }
      if (typeof actual === "number" || typeof expected === "number") {
        const numActual = Number(actual);
        const numExpected = Number(expected);
        if (!isNaN(numActual) && !isNaN(numExpected)) {
          return numActual === numExpected;
        }
      }
      if (typeof actual === "boolean" || typeof expected === "boolean") {
        return Boolean(actual) === (expected === true || expected === "true");
      }
      if (actual instanceof Date || expected instanceof Date) {
        const dateActual = new Date(actual as string | number | Date).getTime();
        const dateExpected = new Date(
          expected as string | number | Date
        ).getTime();
        return !isNaN(dateActual) && !isNaN(dateExpected)
          ? dateActual === dateExpected
          : false;
      }
      return (
        String(actual).trim().toLowerCase() ===
        String(expected).trim().toLowerCase()
      );
    }

    case "not_equals":
      return !evaluateOperator("equals", actual, expected);

    case "contains": {
      if (actual === null || actual === undefined) return false;
      if (Array.isArray(actual)) {
        return actual.some((item) => evaluateOperator("equals", item, expected));
      }
      return String(actual)
        .toLowerCase()
        .includes(String(expected ?? "").toLowerCase());
    }

    case "not_contains":
      return !evaluateOperator("contains", actual, expected);

    case "starts_with": {
      if (actual === null || actual === undefined) return false;
      return String(actual)
        .toLowerCase()
        .startsWith(String(expected ?? "").toLowerCase());
    }

    case "ends_with": {
      if (actual === null || actual === undefined) return false;
      return String(actual)
        .toLowerCase()
        .endsWith(String(expected ?? "").toLowerCase());
    }

    case "greater_than": {
      const numA = Number(actual);
      const numB = Number(expected);
      if (!isNaN(numA) && !isNaN(numB)) return numA > numB;
      const dateA = new Date(actual as string | number | Date).getTime();
      const dateB = new Date(expected as string | number | Date).getTime();
      if (!isNaN(dateA) && !isNaN(dateB)) return dateA > dateB;
      return false;
    }

    case "greater_than_or_equal": {
      const numA = Number(actual);
      const numB = Number(expected);
      if (!isNaN(numA) && !isNaN(numB)) return numA >= numB;
      const dateA = new Date(actual as string | number | Date).getTime();
      const dateB = new Date(expected as string | number | Date).getTime();
      if (!isNaN(dateA) && !isNaN(dateB)) return dateA >= dateB;
      return false;
    }

    case "less_than": {
      const numA = Number(actual);
      const numB = Number(expected);
      if (!isNaN(numA) && !isNaN(numB)) return numA < numB;
      const dateA = new Date(actual as string | number | Date).getTime();
      const dateB = new Date(expected as string | number | Date).getTime();
      if (!isNaN(dateA) && !isNaN(dateB)) return dateA < dateB;
      return false;
    }

    case "less_than_or_equal": {
      const numA = Number(actual);
      const numB = Number(expected);
      if (!isNaN(numA) && !isNaN(numB)) return numA <= numB;
      const dateA = new Date(actual as string | number | Date).getTime();
      const dateB = new Date(expected as string | number | Date).getTime();
      if (!isNaN(dateA) && !isNaN(dateB)) return dateA <= dateB;
      return false;
    }

    default:
      return false;
  }
}

/**
 * Resolves the value of a field from entity data.
 * Supports standard fields, nested fields (e.g. stage.name), and custom fields (e.g. cf_industry or customFields.industry).
 */
export function resolveEntityFieldValue(
  entityData: Record<string, unknown>,
  fieldPath: string
): unknown {
  if (!entityData || !fieldPath) return undefined;

  // Direct lookup
  if (fieldPath in entityData) {
    return entityData[fieldPath];
  }

  // Handle custom fields format: cf_xxx or customFields.xxx
  if (fieldPath.startsWith("cf_")) {
    const cfKey = fieldPath.slice(3);
    const customFields = entityData.customFields as
      | Record<string, unknown>
      | undefined;
    if (customFields && cfKey in customFields) {
      return customFields[cfKey];
    }
  }

  // Dot notation lookup: e.g. "stage.id", "stage.name", "pipeline.id"
  if (fieldPath.includes(".")) {
    const parts = fieldPath.split(".");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let curr: any = entityData;
    for (const part of parts) {
      if (curr === null || curr === undefined) return undefined;
      curr = curr[part];
    }
    return curr;
  }

  return undefined;
}

export interface SingleConditionEvaluationResult {
  field: string;
  operator: AutomationConditionOperator;
  expected: unknown;
  actual: unknown;
  matched: boolean;
}

export interface ConditionGroupEvaluationResult {
  groupIndex: number;
  passed: boolean;
  results: SingleConditionEvaluationResult[];
}

export interface ConditionEvaluationReport {
  passed: boolean;
  groupResults: ConditionGroupEvaluationResult[];
}

/**
 * Evaluates a single condition against entity data.
 */
export function evaluateCondition(
  condition: AutomationCondition,
  entityData: Record<string, unknown>
): SingleConditionEvaluationResult {
  const actual = resolveEntityFieldValue(entityData, condition.field);
  const matched = evaluateOperator(condition.operator, actual, condition.value);

  return {
    field: condition.field,
    operator: condition.operator,
    expected: condition.value,
    actual,
    matched,
  };
}

/**
 * Evaluates all condition groups.
 * If there are no groups, returns passed: true (unconditional).
 * Groups are OR'ed together: at least one group must pass.
 * Conditions within a group are AND'ed together: all conditions in that group must pass.
 */
export function evaluateConditionGroups(
  groups: AutomationConditionGroup[],
  entityData: Record<string, unknown>
): ConditionEvaluationReport {
  if (!groups || groups.length === 0) {
    return {
      passed: true,
      groupResults: [],
    };
  }

  const groupResults: ConditionGroupEvaluationResult[] = [];
  let overallPassed = false;

  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    const conditionResults: SingleConditionEvaluationResult[] = [];
    let groupPassed = true;

    for (const cond of group.conditions) {
      const res = evaluateCondition(cond, entityData);
      conditionResults.push(res);
      if (!res.matched) {
        groupPassed = false;
      }
    }

    groupResults.push({
      groupIndex: i,
      passed: groupPassed,
      results: conditionResults,
    });

    if (groupPassed) {
      overallPassed = true;
    }
  }

  return {
    passed: overallPassed,
    groupResults,
  };
}
