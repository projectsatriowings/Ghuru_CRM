import { db } from "@/db";
import { DbClient } from "@/db/types";
import { leads } from "@/db/schema/leads";
import { users } from "@/db/schema/users";
import { organizationMembers } from "@/db/schema/organizations";
import {
  eq,
  and,
  or,
  ilike,
  isNull,
  isNotNull,
  asc,
  desc,
  count,
} from "drizzle-orm";
import {
  createLeadSchema,
  updateLeadSchema,
  leadQuerySchema,
  type CreateLeadInput,
  type UpdateLeadInput,
  type LeadQueryParams,
} from "@/lib/validations/lead";
import {
  type LeadWithRelations,
  type LeadPagination,
  type LeadSource,
  type LeadStatus,
} from "@/lib/types/leads";
import {
  getCustomFields,
  setCustomFieldValue,
  getCustomFieldValuesForEntity,
} from "@/lib/services/custom-field.service";
import { validateCustomFieldValue } from "@/lib/validations/custom-field";
import { NotFoundError, ValidationError } from "@/lib/errors";

export interface PaginatedLeadsResult {
  data: LeadWithRelations[];
  pagination: LeadPagination;
}

/**
 * Creates a new lead in the specified organization with atomic validation
 * of assignee and custom fields.
 */
export async function createLead(
  organizationId: string,
  input: CreateLeadInput,
  dbInstance: DbClient = db as DbClient
): Promise<LeadWithRelations> {
  const validated = createLeadSchema.parse(input);

  // 1. Verify assigned user belongs to this organization (if provided)
  const assignedUserId =
    validated.assignedToUserId && validated.assignedToUserId.trim() !== ""
      ? validated.assignedToUserId.trim()
      : null;

  if (assignedUserId) {
    const member = await dbInstance
      .select({ id: organizationMembers.id })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, organizationId),
          eq(organizationMembers.userId, assignedUserId)
        )
      )
      .limit(1);

    if (member.length === 0) {
      throw new ValidationError(
        "Assigned user does not belong to this organization."
      );
    }
  }

  // 2. Fetch active custom field definitions for 'lead'
  const activeFields = await getCustomFields(
    organizationId,
    { entityType: "lead", active: true },
    dbInstance
  );

  const customFieldValuesMap: Record<string, unknown> =
    validated.customFields || {};

  // Check required custom fields
  for (const field of activeFields) {
    if (field.required) {
      const submittedValue = customFieldValuesMap[field.key];
      const validation = validateCustomFieldValue(field, submittedValue);
      if (!validation.isValid) {
        throw new ValidationError(
          validation.error || `Custom field "${field.label}" is required.`
        );
      }
    }
  }

  // Validate all submitted custom fields against active definitions
  const validatedCustomFields: Array<{
    fieldDefId: string;
    normalizedValue: unknown;
  }> = [];

  for (const [key, rawValue] of Object.entries(customFieldValuesMap)) {
    const fieldDef = activeFields.find((f) => f.key === key);
    if (!fieldDef) {
      // Ignore or reject undefined fields
      continue;
    }
    const validation = validateCustomFieldValue(fieldDef, rawValue);
    if (!validation.isValid) {
      throw new ValidationError(
        validation.error || `Invalid value for "${fieldDef.label}".`
      );
    }
    if (validation.normalizedValue !== undefined) {
      validatedCustomFields.push({
        fieldDefId: fieldDef.id,
        normalizedValue: validation.normalizedValue,
      });
    }
  }

  // 3. Insert Lead record
  const leadId = crypto.randomUUID();

  await dbInstance.insert(leads).values({
    id: leadId,
    organizationId,
    firstName: validated.firstName,
    lastName: validated.lastName ? validated.lastName.trim() : null,
    email: validated.email ? validated.email.trim() : null,
    phone: validated.phone ? validated.phone.trim() : null,
    source: validated.source,
    status: validated.status,
    assignedToUserId: assignedUserId,
    notes: validated.notes ? validated.notes.trim() : null,
  });

  // 4. Save validated custom field values
  for (const item of validatedCustomFields) {
    await setCustomFieldValue(
      organizationId,
      "lead",
      leadId,
      item.fieldDefId,
      item.normalizedValue,
      dbInstance
    );
  }

  return getLeadById(organizationId, leadId, dbInstance);
}

/**
 * Retrieves leads for an organization with filtering, search, sorting, and pagination.
 */
export async function getLeads(
  organizationId: string,
  queryParams?: LeadQueryParams,
  dbInstance: DbClient = db as DbClient
): Promise<PaginatedLeadsResult> {
  const validated = leadQuerySchema.parse(queryParams || {});

  const conditions = [eq(leads.organizationId, organizationId)];

  // Archived filter
  if (validated.archived === "true") {
    conditions.push(isNotNull(leads.archivedAt));
  } else if (validated.archived === "all") {
    // Show both active and archived
  } else {
    // Default: only active leads
    conditions.push(isNull(leads.archivedAt));
  }

  // Status filter
  if (validated.status && validated.status !== "all") {
    conditions.push(eq(leads.status, validated.status));
  }

  // Source filter
  if (validated.source && validated.source !== "all") {
    conditions.push(eq(leads.source, validated.source));
  }

  // Assigned to filter
  if (validated.assignedTo && validated.assignedTo !== "all") {
    if (validated.assignedTo === "unassigned") {
      conditions.push(isNull(leads.assignedToUserId));
    } else {
      conditions.push(eq(leads.assignedToUserId, validated.assignedTo));
    }
  }

  // Search filter (first name, last name, email, phone)
  if (validated.search && validated.search.trim() !== "") {
    const term = `%${validated.search.trim()}%`;
    conditions.push(
      or(
        ilike(leads.firstName, term),
        ilike(leads.lastName, term),
        ilike(leads.email, term),
        ilike(leads.phone, term)
      )!
    );
  }

  // Count query
  const [totalRes] = await dbInstance
    .select({ total: count() })
    .from(leads)
    .where(and(...conditions));

  const total = Number(totalRes?.total || 0);
  const totalPages = Math.ceil(total / validated.pageSize) || 1;

  // Sorting
  const sortCol =
    validated.sort === "updatedAt"
      ? leads.updatedAt
      : validated.sort === "firstName"
      ? leads.firstName
      : validated.sort === "status"
      ? leads.status
      : validated.sort === "source"
      ? leads.source
      : leads.createdAt;

  const orderClause =
    validated.sortDirection === "asc" ? asc(sortCol) : desc(sortCol);

  // Data query with left join on users for assigned member details
  const rows = await dbInstance
    .select({
      lead: leads,
      assignedUser: {
        id: users.id,
        name: users.name,
        email: users.email,
        image: users.image,
      },
    })
    .from(leads)
    .leftJoin(users, eq(leads.assignedToUserId, users.id))
    .where(and(...conditions))
    .orderBy(orderClause)
    .limit(validated.pageSize)
    .offset((validated.page - 1) * validated.pageSize);

  const data: LeadWithRelations[] = rows.map((r) => ({
    ...r.lead,
    source: r.lead.source as LeadSource,
    status: r.lead.status as LeadStatus,
    assignedToUser: r.assignedUser?.id ? r.assignedUser : null,
  }));

  return {
    data,
    pagination: {
      page: validated.page,
      pageSize: validated.pageSize,
      total,
      totalPages,
    },
  };
}

/**
 * Retrieves a single lead by ID, including assigned user and custom field values.
 */
export async function getLeadById(
  organizationId: string,
  leadId: string,
  dbInstance: DbClient = db as DbClient
): Promise<LeadWithRelations> {
  const [row] = await dbInstance
    .select({
      lead: leads,
      assignedUser: {
        id: users.id,
        name: users.name,
        email: users.email,
        image: users.image,
      },
    })
    .from(leads)
    .leftJoin(users, eq(leads.assignedToUserId, users.id))
    .where(
      and(eq(leads.organizationId, organizationId), eq(leads.id, leadId))
    )
    .limit(1);

  if (!row) {
    throw new NotFoundError("Lead not found.");
  }

  // Fetch custom field values polymorphic to lead
  const customFieldEntries = await getCustomFieldValuesForEntity(
    organizationId,
    "lead",
    leadId,
    dbInstance
  );

  const customFields: Record<string, unknown> = {};
  for (const entry of customFieldEntries) {
    customFields[entry.field.key] = entry.value;
  }

  return {
    ...row.lead,
    source: row.lead.source as LeadSource,
    status: row.lead.status as LeadStatus,
    assignedToUser: row.assignedUser?.id ? row.assignedUser : null,
    customFields,
    customFieldValues: customFieldEntries,
  };
}

/**
 * Updates an existing lead's standard fields and custom field values.
 */
export async function updateLead(
  organizationId: string,
  leadId: string,
  input: UpdateLeadInput,
  dbInstance: DbClient = db as DbClient
): Promise<LeadWithRelations> {
  // 1. Ensure lead exists in this organization
  await getLeadById(organizationId, leadId, dbInstance);

  const validated = updateLeadSchema.parse(input);

  // 2. Verify assigned user belongs to this organization (if changed)
  let assignedUserId: string | null | undefined = undefined;
  if (validated.assignedToUserId !== undefined) {
    if (
      validated.assignedToUserId &&
      validated.assignedToUserId.trim() !== ""
    ) {
      const assignedId = validated.assignedToUserId.trim();
      const member = await dbInstance
        .select({ id: organizationMembers.id })
        .from(organizationMembers)
        .where(
          and(
            eq(organizationMembers.organizationId, organizationId),
            eq(organizationMembers.userId, assignedId)
          )
        )
        .limit(1);

      if (member.length === 0) {
        throw new ValidationError(
          "Assigned user does not belong to this organization."
        );
      }
      assignedUserId = assignedId;
    } else {
      assignedUserId = null;
    }
  }

  // 3. Validate and update custom fields (if provided)
  if (validated.customFields) {
    const activeFields = await getCustomFields(
      organizationId,
      { entityType: "lead" },
      dbInstance
    );

    for (const [key, rawValue] of Object.entries(validated.customFields)) {
      const fieldDef = activeFields.find((f) => f.key === key);
      if (!fieldDef) continue;

      const validation = validateCustomFieldValue(fieldDef, rawValue);
      if (!validation.isValid) {
        throw new ValidationError(
          validation.error || `Invalid value for "${fieldDef.label}".`
        );
      }

      await setCustomFieldValue(
        organizationId,
        "lead",
        leadId,
        fieldDef.id,
        validation.normalizedValue,
        dbInstance
      );
    }
  }

  // 4. Update lead standard fields
  await dbInstance
    .update(leads)
    .set({
      ...(validated.firstName !== undefined
        ? { firstName: validated.firstName }
        : {}),
      ...(validated.lastName !== undefined
        ? { lastName: validated.lastName ? validated.lastName.trim() : null }
        : {}),
      ...(validated.email !== undefined
        ? { email: validated.email ? validated.email.trim() : null }
        : {}),
      ...(validated.phone !== undefined
        ? { phone: validated.phone ? validated.phone.trim() : null }
        : {}),
      ...(validated.source !== undefined ? { source: validated.source } : {}),
      ...(validated.status !== undefined ? { status: validated.status } : {}),
      ...(assignedUserId !== undefined
        ? { assignedToUserId: assignedUserId }
        : {}),
      ...(validated.notes !== undefined
        ? { notes: validated.notes ? validated.notes.trim() : null }
        : {}),
      updatedAt: new Date(),
    })
    .where(
      and(eq(leads.organizationId, organizationId), eq(leads.id, leadId))
    );

  return getLeadById(organizationId, leadId, dbInstance);
}

/**
 * Soft deletes / archives a lead by setting archivedAt.
 */
export async function archiveLead(
  organizationId: string,
  leadId: string,
  dbInstance: DbClient = db as DbClient
): Promise<LeadWithRelations> {
  await getLeadById(organizationId, leadId, dbInstance);

  await dbInstance
    .update(leads)
    .set({
      archivedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(eq(leads.organizationId, organizationId), eq(leads.id, leadId))
    );

  return getLeadById(organizationId, leadId, dbInstance);
}

/**
 * Restores an archived lead by clearing archivedAt.
 */
export async function restoreLead(
  organizationId: string,
  leadId: string,
  dbInstance: DbClient = db as DbClient
): Promise<LeadWithRelations> {
  await getLeadById(organizationId, leadId, dbInstance);

  await dbInstance
    .update(leads)
    .set({
      archivedAt: null,
      updatedAt: new Date(),
    })
    .where(
      and(eq(leads.organizationId, organizationId), eq(leads.id, leadId))
    );

  return getLeadById(organizationId, leadId, dbInstance);
}
