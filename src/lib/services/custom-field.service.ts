import { db } from "@/db";
import { DbClient } from "@/db/types";
import {
  customFieldDefinitions,
  customFieldValues,
} from "@/db/schema/custom-fields";
import { eq, and, asc, max } from "drizzle-orm";
import {
  createCustomFieldSchema,
  updateCustomFieldSchema,
  validateCustomFieldValue,
  type CreateCustomFieldInput,
  type UpdateCustomFieldInput,
} from "@/lib/validations/custom-field";
import {
  type EntityType,
  type CustomFieldDefinition,
  type CustomFieldValue,
} from "@/lib/types/custom-fields";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";

export interface CustomFieldFilters {
  entityType?: EntityType;
  active?: boolean;
}

export async function createCustomField(
  organizationId: string,
  input: CreateCustomFieldInput,
  dbInstance: DbClient = db as DbClient
): Promise<CustomFieldDefinition> {
  const validated = createCustomFieldSchema.parse(input);

  // 1. Check uniqueness of (organizationId, entityType, key)
  const existing = await dbInstance
    .select({ id: customFieldDefinitions.id })
    .from(customFieldDefinitions)
    .where(
      and(
        eq(customFieldDefinitions.organizationId, organizationId),
        eq(customFieldDefinitions.entityType, validated.entityType),
        eq(customFieldDefinitions.key, validated.key)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    throw new ConflictError(
      "A custom field with this key already exists for this entity."
    );
  }

  // 2. Compute displayOrder if not provided
  let displayOrder = validated.displayOrder;
  if (displayOrder === undefined) {
    const [maxOrderRes] = await dbInstance
      .select({ maxOrder: max(customFieldDefinitions.displayOrder) })
      .from(customFieldDefinitions)
      .where(
        and(
          eq(customFieldDefinitions.organizationId, organizationId),
          eq(customFieldDefinitions.entityType, validated.entityType)
        )
      );

    displayOrder = (maxOrderRes?.maxOrder ?? -1) + 1;
  }

  const id = crypto.randomUUID();

  try {
    const [created] = await dbInstance
      .insert(customFieldDefinitions)
      .values({
        id,
        organizationId,
        entityType: validated.entityType,
        key: validated.key,
        label: validated.label,
        description: validated.description ?? null,
        fieldType: validated.fieldType,
        required: validated.required ?? false,
        active: validated.active ?? true,
        displayOrder,
        config: validated.config ?? {},
      })
      .returning();

    return created as CustomFieldDefinition;
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    if (
      errorMsg.includes("unique") ||
      errorMsg.includes("23505") ||
      errorMsg.includes("custom_fields_org_entity_key_idx")
    ) {
      throw new ConflictError(
        "A custom field with this key already exists for this entity."
      );
    }
    throw err;
  }
}

export async function getCustomFields(
  organizationId: string,
  filters?: CustomFieldFilters,
  dbInstance: DbClient = db as DbClient
): Promise<CustomFieldDefinition[]> {
  const conditions = [eq(customFieldDefinitions.organizationId, organizationId)];

  if (filters?.entityType) {
    conditions.push(eq(customFieldDefinitions.entityType, filters.entityType));
  }

  if (filters?.active !== undefined) {
    conditions.push(eq(customFieldDefinitions.active, filters.active));
  }

  const results = await dbInstance
    .select()
    .from(customFieldDefinitions)
    .where(and(...conditions))
    .orderBy(
      asc(customFieldDefinitions.displayOrder),
      asc(customFieldDefinitions.createdAt)
    );

  return results as CustomFieldDefinition[];
}

export async function getCustomFieldById(
  organizationId: string,
  fieldId: string,
  dbInstance: DbClient = db as DbClient
): Promise<CustomFieldDefinition> {
  const [field] = await dbInstance
    .select()
    .from(customFieldDefinitions)
    .where(
      and(
        eq(customFieldDefinitions.organizationId, organizationId),
        eq(customFieldDefinitions.id, fieldId)
      )
    )
    .limit(1);

  if (!field) {
    throw new NotFoundError("Custom field not found.");
  }

  return field as CustomFieldDefinition;
}

export async function updateCustomField(
  organizationId: string,
  fieldId: string,
  input: UpdateCustomFieldInput,
  dbInstance: DbClient = db as DbClient
): Promise<CustomFieldDefinition> {
  const existing = await getCustomFieldById(organizationId, fieldId, dbInstance);

  const validated = updateCustomFieldSchema.parse(input);

  // If changing key, ensure uniqueness within same org and entityType
  if (validated.key && validated.key !== existing.key) {
    const keyInUse = await dbInstance
      .select({ id: customFieldDefinitions.id })
      .from(customFieldDefinitions)
      .where(
        and(
          eq(customFieldDefinitions.organizationId, organizationId),
          eq(customFieldDefinitions.entityType, existing.entityType),
          eq(customFieldDefinitions.key, validated.key)
        )
      )
      .limit(1);

    if (keyInUse.length > 0) {
      throw new ConflictError(
        "A custom field with this key already exists for this entity."
      );
    }
  }

  try {
    const [updated] = await dbInstance
      .update(customFieldDefinitions)
      .set({
        ...(validated.label !== undefined ? { label: validated.label } : {}),
        ...(validated.key !== undefined ? { key: validated.key } : {}),
        ...(validated.description !== undefined
          ? { description: validated.description }
          : {}),
        ...(validated.required !== undefined
          ? { required: validated.required }
          : {}),
        ...(validated.active !== undefined ? { active: validated.active } : {}),
        ...(validated.displayOrder !== undefined
          ? { displayOrder: validated.displayOrder }
          : {}),
        ...(validated.config !== undefined ? { config: validated.config } : {}),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(customFieldDefinitions.organizationId, organizationId),
          eq(customFieldDefinitions.id, fieldId)
        )
      )
      .returning();

    return updated as CustomFieldDefinition;
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    if (
      errorMsg.includes("unique") ||
      errorMsg.includes("23505") ||
      errorMsg.includes("custom_fields_org_entity_key_idx")
    ) {
      throw new ConflictError(
        "A custom field with this key already exists for this entity."
      );
    }
    throw err;
  }
}

export async function archiveCustomField(
  organizationId: string,
  fieldId: string,
  dbInstance: DbClient = db as DbClient
): Promise<CustomFieldDefinition> {
  // Ensure field exists and belongs to organization
  await getCustomFieldById(organizationId, fieldId, dbInstance);

  const [archived] = await dbInstance
    .update(customFieldDefinitions)
    .set({
      active: false,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(customFieldDefinitions.organizationId, organizationId),
        eq(customFieldDefinitions.id, fieldId)
      )
    )
    .returning();

  return archived as CustomFieldDefinition;
}

export async function reorderCustomFields(
  organizationId: string,
  entityType: EntityType,
  orderedFieldIds: string[],
  dbInstance: DbClient = db as DbClient
): Promise<CustomFieldDefinition[]> {
  for (let index = 0; index < orderedFieldIds.length; index++) {
    const id = orderedFieldIds[index];
    await dbInstance
      .update(customFieldDefinitions)
      .set({
        displayOrder: index,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(customFieldDefinitions.organizationId, organizationId),
          eq(customFieldDefinitions.entityType, entityType),
          eq(customFieldDefinitions.id, id)
        )
      );
  }

  return getCustomFields(organizationId, { entityType }, dbInstance);
}

// ---------------------------------------------------------------------------
// Custom Field Values Foundation (for future entity storage & validation)
// ---------------------------------------------------------------------------

export async function setCustomFieldValue(
  organizationId: string,
  entityType: EntityType,
  entityId: string,
  fieldDefinitionId: string,
  rawValue: unknown,
  dbInstance: DbClient = db as DbClient
): Promise<CustomFieldValue> {
  const definition = await getCustomFieldById(
    organizationId,
    fieldDefinitionId,
    dbInstance
  );

  if (definition.entityType !== entityType) {
    throw new ValidationError(
      `Field "${definition.label}" belongs to ${definition.entityType}, not ${entityType}.`
    );
  }

  const validation = validateCustomFieldValue(definition, rawValue);
  if (!validation.isValid) {
    throw new ValidationError(validation.error || "Invalid custom field value.");
  }

  const existingValue = await dbInstance
    .select({ id: customFieldValues.id })
    .from(customFieldValues)
    .where(
      and(
        eq(customFieldValues.organizationId, organizationId),
        eq(customFieldValues.entityType, entityType),
        eq(customFieldValues.entityId, entityId),
        eq(customFieldValues.fieldDefinitionId, fieldDefinitionId)
      )
    )
    .limit(1);

  if (existingValue.length > 0) {
    const [updated] = await dbInstance
      .update(customFieldValues)
      .set({
        value: validation.normalizedValue,
        updatedAt: new Date(),
      })
      .where(eq(customFieldValues.id, existingValue[0].id))
      .returning();

    return updated as CustomFieldValue;
  }

  const id = crypto.randomUUID();
  const [created] = await dbInstance
    .insert(customFieldValues)
    .values({
      id,
      organizationId,
      entityType,
      entityId,
      fieldDefinitionId,
      value: validation.normalizedValue,
    })
    .returning();

  return created as CustomFieldValue;
}

export async function getCustomFieldValuesForEntity(
  organizationId: string,
  entityType: EntityType,
  entityId: string,
  dbInstance: DbClient = db as DbClient
): Promise<Array<{ field: CustomFieldDefinition; value: unknown }>> {
  const rows = await dbInstance
    .select({
      field: customFieldDefinitions,
      fieldValue: customFieldValues.value,
    })
    .from(customFieldDefinitions)
    .leftJoin(
      customFieldValues,
      and(
        eq(customFieldValues.fieldDefinitionId, customFieldDefinitions.id),
        eq(customFieldValues.entityType, entityType),
        eq(customFieldValues.entityId, entityId),
        eq(customFieldValues.organizationId, organizationId)
      )
    )
    .where(
      and(
        eq(customFieldDefinitions.organizationId, organizationId),
        eq(customFieldDefinitions.entityType, entityType)
      )
    )
    .orderBy(asc(customFieldDefinitions.displayOrder));

  return rows.map((r) => ({
    field: r.field as CustomFieldDefinition,
    value: r.fieldValue ?? null,
  }));
}
