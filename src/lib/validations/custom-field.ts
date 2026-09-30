import { z } from "zod";
import {
  ENTITY_TYPES,
  FIELD_TYPES,
  type CustomFieldDefinition,
} from "@/lib/types/custom-fields";

export const entityTypeSchema = z.enum(ENTITY_TYPES);

export const fieldTypeSchema = z.enum(FIELD_TYPES);

// Machine readable key: lowercase, starts with letter, only letters, numbers, underscores
export const fieldKeySchema = z
  .string()
  .trim()
  .min(2, "Field key must be at least 2 characters")
  .max(50, "Field key must be at most 50 characters")
  .regex(
    /^[a-z][a-z0-9_]*$/,
    "Field key must be lowercase, start with a letter, and contain only letters, numbers, and underscores"
  );

export const selectOptionSchema = z.object({
  value: z.string().trim().min(1, "Option value cannot be empty"),
  label: z.string().trim().min(1, "Option label cannot be empty"),
});

export const fieldConfigSchema = z
  .object({
    options: z.array(selectOptionSchema).optional(),
    currencySymbol: z.string().max(10).optional(),
    placeholder: z.string().max(100).optional(),
  })
  .passthrough();

export const createCustomFieldSchema = z
  .object({
    entityType: entityTypeSchema,
    label: z.string().trim().min(1, "Field label is required").max(100),
    key: fieldKeySchema,
    description: z.string().trim().max(500).optional().nullable(),
    fieldType: fieldTypeSchema,
    required: z.boolean().default(false),
    active: z.boolean().default(true),
    displayOrder: z.number().int().min(0).optional(),
    config: fieldConfigSchema.optional().default({}),
  })
  .superRefine((data, ctx) => {
    if (data.fieldType === "select" || data.fieldType === "multiselect") {
      const options = data.config?.options;
      if (!options || !Array.isArray(options) || options.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${
            data.fieldType === "select" ? "Dropdown" : "Multi-select"
          } fields require at least one option.`,
          path: ["config", "options"],
        });
        return;
      }

      const values = new Set<string>();
      for (let i = 0; i < options.length; i++) {
        const val = options[i].value.trim();
        if (values.has(val)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Duplicate option value: "${val}"`,
            path: ["config", "options", i, "value"],
          });
        }
        values.add(val);
      }
    }
  });

export const updateCustomFieldSchema = z
  .object({
    label: z.string().trim().min(1, "Field label cannot be empty").max(100).optional(),
    key: fieldKeySchema.optional(),
    description: z.string().trim().max(500).optional().nullable(),
    required: z.boolean().optional(),
    active: z.boolean().optional(),
    displayOrder: z.number().int().min(0).optional(),
    config: fieldConfigSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (data.config?.options) {
      const options = data.config.options;
      if (!Array.isArray(options) || options.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Select/Multi-select options list cannot be empty.",
          path: ["config", "options"],
        });
        return;
      }
      const values = new Set<string>();
      for (let i = 0; i < options.length; i++) {
        const val = options[i].value.trim();
        if (values.has(val)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Duplicate option value: "${val}"`,
            path: ["config", "options", i, "value"],
          });
        }
        values.add(val);
      }
    }
  });

export const reorderCustomFieldsSchema = z.object({
  entityType: entityTypeSchema,
  orderedFieldIds: z.array(z.string().min(1)),
});

export type CreateCustomFieldInput = z.input<typeof createCustomFieldSchema>;
export type UpdateCustomFieldInput = z.input<typeof updateCustomFieldSchema>;
export type ReorderCustomFieldsInput = z.input<typeof reorderCustomFieldsSchema>;

export interface ValueValidationResult {
  isValid: boolean;
  error?: string;
  normalizedValue?: unknown;
}

/**
 * Validates a value against a custom field definition.
 * Used when future entities store or update custom field values.
 */
export function validateCustomFieldValue(
  field: Pick<CustomFieldDefinition, "fieldType" | "required" | "config" | "label">,
  value: unknown
): ValueValidationResult {
  const isValueEmpty =
    value === undefined ||
    value === null ||
    (typeof value === "string" && value.trim() === "") ||
    (Array.isArray(value) && value.length === 0);

  if (isValueEmpty) {
    if (field.required) {
      return {
        isValid: false,
        error: `${field.label} is required.`,
      };
    }
    return { isValid: true, normalizedValue: null };
  }

  switch (field.fieldType) {
    case "text":
    case "textarea": {
      if (typeof value !== "string") {
        return { isValid: false, error: `${field.label} must be a text string.` };
      }
      const trimmed = value.trim();
      const minLength =
        typeof field.config?.minLength === "number"
          ? field.config.minLength
          : undefined;
      const maxLength =
        typeof field.config?.maxLength === "number"
          ? field.config.maxLength
          : undefined;

      if (minLength !== undefined && trimmed.length < minLength) {
        return {
          isValid: false,
          error: `${field.label} must be at least ${minLength} characters.`,
        };
      }
      if (maxLength !== undefined && trimmed.length > maxLength) {
        return {
          isValid: false,
          error: `${field.label} must not exceed ${maxLength} characters.`,
        };
      }
      return { isValid: true, normalizedValue: trimmed };
    }

    case "number": {
      let num: number;
      if (typeof value === "number") {
        num = value;
      } else if (typeof value === "string" && value.trim() !== "") {
        num = Number(value);
      } else {
        return { isValid: false, error: `${field.label} must be a valid number.` };
      }

      if (isNaN(num)) {
        return { isValid: false, error: `${field.label} must be a valid number.` };
      }

      const min =
        typeof field.config?.min === "number" ? field.config.min : undefined;
      const max =
        typeof field.config?.max === "number" ? field.config.max : undefined;

      if (min !== undefined && num < min) {
        return { isValid: false, error: `${field.label} must be at least ${min}.` };
      }
      if (max !== undefined && num > max) {
        return { isValid: false, error: `${field.label} must not exceed ${max}.` };
      }

      return { isValid: true, normalizedValue: num };
    }

    case "currency": {
      let amount: number;
      let currency =
        typeof field.config?.currency === "string"
          ? field.config.currency
          : "USD";

      if (typeof value === "number") {
        amount = value;
      } else if (
        typeof value === "object" &&
        value !== null &&
        "amount" in value
      ) {
        const valObj = value as { amount: unknown; currency?: unknown };
        if (typeof valObj.amount !== "number" || isNaN(valObj.amount)) {
          return {
            isValid: false,
            error: `${field.label} amount must be a number.`,
          };
        }
        amount = valObj.amount;
        if (typeof valObj.currency === "string") {
          currency = valObj.currency;
        }
      } else if (typeof value === "string" && value.trim() !== "") {
        amount = Number(value);
      } else {
        return {
          isValid: false,
          error: `${field.label} must be a valid currency amount.`,
        };
      }

      if (isNaN(amount)) {
        return {
          isValid: false,
          error: `${field.label} must be a valid currency amount.`,
        };
      }

      const min =
        typeof field.config?.min === "number" ? field.config.min : undefined;
      const max =
        typeof field.config?.max === "number" ? field.config.max : undefined;

      if (min !== undefined && amount < min) {
        return {
          isValid: false,
          error: `${field.label} must be at least ${min}.`,
        };
      }
      if (max !== undefined && amount > max) {
        return {
          isValid: false,
          error: `${field.label} must not exceed ${max}.`,
        };
      }

      const rounded = Math.round(amount * 100) / 100;
      return {
        isValid: true,
        normalizedValue:
          typeof value === "object" && value !== null && "amount" in value
            ? { amount: rounded, currency }
            : rounded,
      };
    }

    case "boolean": {
      if (typeof value === "boolean") {
        return { isValid: true, normalizedValue: value };
      }
      return {
        isValid: false,
        error: `${field.label} must be a boolean (true or false).`,
      };
    }

    case "date": {
      const str = String(value).trim();
      // Date must match YYYY-MM-DD
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(str)) {
        return {
          isValid: false,
          error: `${field.label} must be a valid date in YYYY-MM-DD format.`,
        };
      }
      const d = new Date(str);
      if (isNaN(d.getTime())) {
        return {
          isValid: false,
          error: `${field.label} contains an invalid calendar date.`,
        };
      }
      return { isValid: true, normalizedValue: str };
    }

    case "datetime": {
      const d = new Date(String(value));
      if (isNaN(d.getTime())) {
        return {
          isValid: false,
          error: `${field.label} must be a valid ISO date/time.`,
        };
      }
      return { isValid: true, normalizedValue: d.toISOString() };
    }

    case "select": {
      const strVal = String(value).trim();
      const validOptions = (field.config?.options || []).map((o) => o.value);
      if (!validOptions.includes(strVal)) {
        return {
          isValid: false,
          error: `"${strVal}" is not a valid option for ${field.label}.`,
        };
      }
      return { isValid: true, normalizedValue: strVal };
    }

    case "multiselect": {
      if (!Array.isArray(value)) {
        return {
          isValid: false,
          error: `${field.label} must be an array of selected options.`,
        };
      }
      const validOptions = new Set(
        (field.config?.options || []).map((o) => o.value)
      );
      const normalizedArr: string[] = [];
      for (const item of value) {
        const itemStr = String(item).trim();
        if (!validOptions.has(itemStr)) {
          return {
            isValid: false,
            error: `"${itemStr}" is not a valid option for ${field.label}.`,
          };
        }
        if (!normalizedArr.includes(itemStr)) {
          normalizedArr.push(itemStr);
        }
      }
      return { isValid: true, normalizedValue: normalizedArr };
    }

    case "email": {
      const email = String(value).trim();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return {
          isValid: false,
          error: `${field.label} must be a valid email address.`,
        };
      }
      return { isValid: true, normalizedValue: email.toLowerCase() };
    }

    case "phone": {
      if (typeof value !== "string") {
        return {
          isValid: false,
          error: `${field.label} must be a valid phone number.`,
        };
      }
      const phone = value.trim();
      const phoneFormatRegex = /^[+]?[\d\s\-()./]+$/;
      const digitsOnly = phone.replace(/\D/g, "");
      if (
        !phoneFormatRegex.test(phone) ||
        digitsOnly.length < 7 ||
        digitsOnly.length > 15
      ) {
        return {
          isValid: false,
          error: `${field.label} must be a valid phone number.`,
        };
      }
      return { isValid: true, normalizedValue: phone };
    }

    case "url": {
      if (typeof value !== "string") {
        return {
          isValid: false,
          error: `${field.label} must be a valid URL string.`,
        };
      }
      const urlStr = value.trim();
      try {
        const parsed = new URL(urlStr);
        if (!["http:", "https:"].includes(parsed.protocol)) {
          return {
            isValid: false,
            error: `${field.label} must have an http or https protocol.`,
          };
        }
        return { isValid: true, normalizedValue: parsed.toString() };
      } catch {
        return { isValid: false, error: `${field.label} must be a valid URL.` };
      }
    }

    default:
      return { isValid: true, normalizedValue: value };
  }
}
