"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/context/organization-context";
import {
  createCustomField,
  updateCustomField,
  archiveCustomField,
  reorderCustomFields,
} from "@/lib/services/custom-field.service";
import {
  createCustomFieldSchema,
  updateCustomFieldSchema,
  reorderCustomFieldsSchema,
  type CreateCustomFieldInput,
  type UpdateCustomFieldInput,
  type ReorderCustomFieldsInput,
} from "@/lib/validations/custom-field";
import { AppError } from "@/lib/errors";

export async function createCustomFieldAction(input: CreateCustomFieldInput) {
  try {
    const ctx = await requirePermission("custom_fields.create");
    const validated = createCustomFieldSchema.parse(input);

    const field = await createCustomField(ctx.organization.id, validated);

    revalidatePath("/settings/custom-fields");
    return {
      success: true as const,
      field,
    };
  } catch (err: unknown) {
    const message =
      err instanceof AppError
        ? err.message
        : err instanceof Error
        ? err.message
        : "Failed to create custom field";
    return {
      success: false as const,
      error: message,
    };
  }
}

export async function updateCustomFieldAction(
  fieldId: string,
  input: UpdateCustomFieldInput
) {
  try {
    const ctx = await requirePermission("custom_fields.update");
    const validated = updateCustomFieldSchema.parse(input);

    const field = await updateCustomField(
      ctx.organization.id,
      fieldId,
      validated
    );

    revalidatePath("/settings/custom-fields");
    return {
      success: true as const,
      field,
    };
  } catch (err: unknown) {
    const message =
      err instanceof AppError
        ? err.message
        : err instanceof Error
        ? err.message
        : "Failed to update custom field";
    return {
      success: false as const,
      error: message,
    };
  }
}

export async function archiveCustomFieldAction(fieldId: string) {
  try {
    const ctx = await requirePermission("custom_fields.delete");

    const field = await archiveCustomField(ctx.organization.id, fieldId);

    revalidatePath("/settings/custom-fields");
    return {
      success: true as const,
      field,
    };
  } catch (err: unknown) {
    const message =
      err instanceof AppError
        ? err.message
        : err instanceof Error
        ? err.message
        : "Failed to archive custom field";
    return {
      success: false as const,
      error: message,
    };
  }
}

export async function reorderCustomFieldsAction(input: ReorderCustomFieldsInput) {
  try {
    const ctx = await requirePermission("custom_fields.update");
    const validated = reorderCustomFieldsSchema.parse(input);

    const fields = await reorderCustomFields(
      ctx.organization.id,
      validated.entityType,
      validated.orderedFieldIds
    );

    revalidatePath("/settings/custom-fields");
    return {
      success: true as const,
      fields,
    };
  } catch (err: unknown) {
    const message =
      err instanceof AppError
        ? err.message
        : err instanceof Error
        ? err.message
        : "Failed to reorder custom fields";
    return {
      success: false as const,
      error: message,
    };
  }
}
