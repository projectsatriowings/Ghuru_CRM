import { db } from "@/db";
import { DbClient } from "@/db/types";
import { deals } from "@/db/schema/deals";
import { users } from "@/db/schema/users";
import { organizationMembers } from "@/db/schema/organizations";
import { pipelines, pipelineStages } from "@/db/schema/pipelines";
import { leads } from "@/db/schema/leads";
import { contacts } from "@/db/schema/contacts";
import { companies } from "@/db/schema/companies";
import { activities } from "@/db/schema/activities";
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
  sql,
  gte,
  lte,
} from "drizzle-orm";
import {
  createDealSchema,
  updateDealSchema,
  dealQuerySchema,
  type CreateDealInput,
  type UpdateDealInput,
  type DealQueryInput,
} from "@/lib/validations/deal";
import {
  type DealWithRelations,
  type PaginatedDealsResult,
  type DealStatus,
} from "@/lib/types/deals";
import {
  getCustomFields,
  setCustomFieldValue,
  getCustomFieldValuesForEntity,
} from "@/lib/services/custom-field.service";
import { validateCustomFieldValue } from "@/lib/validations/custom-field";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { emitAutomationEvent } from "@/lib/automation/automation-engine";

/**
 * Validates that pipelineId and stageId belong to the organization, are active,
 * and that stageId belongs to pipelineId.
 */
export async function validateDealPipelineAndStage(
  organizationId: string,
  pipelineId: string,
  stageId: string,
  dbInstance: DbClient = db as DbClient
): Promise<{ pipelineName: string; stageName: string }> {
  const pId = pipelineId.trim();
  const sId = stageId.trim();

  const [pipeline] = await dbInstance
    .select({ id: pipelines.id, name: pipelines.name, active: pipelines.active, archivedAt: pipelines.archivedAt })
    .from(pipelines)
    .where(
      and(
        eq(pipelines.id, pId),
        eq(pipelines.organizationId, organizationId),
        isNull(pipelines.archivedAt),
        eq(pipelines.active, true)
      )
    )
    .limit(1);

  if (!pipeline) {
    throw new ValidationError(
      "Selected pipeline not found, inactive, or does not belong to this organization."
    );
  }

  const [stage] = await dbInstance
    .select({ id: pipelineStages.id, name: pipelineStages.name, active: pipelineStages.active, archivedAt: pipelineStages.archivedAt })
    .from(pipelineStages)
    .where(
      and(
        eq(pipelineStages.id, sId),
        eq(pipelineStages.organizationId, organizationId),
        eq(pipelineStages.pipelineId, pId),
        isNull(pipelineStages.archivedAt),
        eq(pipelineStages.active, true)
      )
    )
    .limit(1);

  if (!stage) {
    throw new ValidationError(
      "Selected stage not found, inactive, or does not belong to the selected pipeline."
    );
  }

  return { pipelineName: pipeline.name, stageName: stage.name };
}

/**
 * Validates active Lead within organization.
 */
export async function validateActiveLead(
  organizationId: string,
  leadId: string,
  dbInstance: DbClient = db as DbClient
) {
  const [record] = await dbInstance
    .select({ id: leads.id, archivedAt: leads.archivedAt })
    .from(leads)
    .where(and(eq(leads.id, leadId.trim()), eq(leads.organizationId, organizationId)))
    .limit(1);

  if (!record) {
    throw new ValidationError("Selected lead was not found in this organization.");
  }
  if (record.archivedAt !== null) {
    throw new ValidationError("Archived leads cannot be associated with a deal.");
  }
  return record;
}

/**
 * Validates active Contact within organization.
 */
export async function validateActiveContact(
  organizationId: string,
  contactId: string,
  dbInstance: DbClient = db as DbClient
) {
  const [record] = await dbInstance
    .select({ id: contacts.id, archivedAt: contacts.archivedAt })
    .from(contacts)
    .where(and(eq(contacts.id, contactId.trim()), eq(contacts.organizationId, organizationId)))
    .limit(1);

  if (!record) {
    throw new ValidationError("Selected contact was not found in this organization.");
  }
  if (record.archivedAt !== null) {
    throw new ValidationError("Archived contacts cannot be associated with a deal.");
  }
  return record;
}

/**
 * Validates active Company within organization.
 */
export async function validateActiveCompany(
  organizationId: string,
  companyId: string,
  dbInstance: DbClient = db as DbClient
) {
  const [record] = await dbInstance
    .select({ id: companies.id, archivedAt: companies.archivedAt })
    .from(companies)
    .where(and(eq(companies.id, companyId.trim()), eq(companies.organizationId, organizationId)))
    .limit(1);

  if (!record) {
    throw new ValidationError("Selected company was not found in this organization.");
  }
  if (record.archivedAt !== null) {
    throw new ValidationError("Archived companies cannot be associated with a deal.");
  }
  return record;
}

/**
 * Validates active user membership in organization.
 */
export async function validateOwner(
  organizationId: string,
  ownerUserId: string,
  dbInstance: DbClient = db as DbClient
) {
  const [member] = await dbInstance
    .select({ id: organizationMembers.id })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.userId, ownerUserId.trim())
      )
    )
    .limit(1);

  if (!member) {
    throw new ValidationError("Assigned owner does not belong to this organization.");
  }
  return member;
}

/**
 * Creates a new Deal with tenant isolation and relationship validation.
 */
export async function createDeal(
  organizationId: string,
  input: CreateDealInput,
  dbInstance: DbClient = db as DbClient,
  creatorUserId?: string
): Promise<DealWithRelations> {
  const validated = createDealSchema.parse(input);

  // 1. Validate Pipeline & Stage
  await validateDealPipelineAndStage(
    organizationId,
    validated.pipelineId,
    validated.pipelineStageId,
    dbInstance
  );

  // 2. Validate optional relationships
  let resolvedLeadId: string | null = null;
  if (validated.leadId && validated.leadId.trim() !== "") {
    await validateActiveLead(organizationId, validated.leadId, dbInstance);
    resolvedLeadId = validated.leadId.trim();
  }

  let resolvedContactId: string | null = null;
  if (validated.contactId && validated.contactId.trim() !== "") {
    await validateActiveContact(organizationId, validated.contactId, dbInstance);
    resolvedContactId = validated.contactId.trim();
  }

  let resolvedCompanyId: string | null = null;
  if (validated.companyId && validated.companyId.trim() !== "") {
    await validateActiveCompany(organizationId, validated.companyId, dbInstance);
    resolvedCompanyId = validated.companyId.trim();
  }

  let resolvedOwnerId: string | null = null;
  if (validated.ownerUserId && validated.ownerUserId.trim() !== "") {
    await validateOwner(organizationId, validated.ownerUserId, dbInstance);
    resolvedOwnerId = validated.ownerUserId.trim();
  }

  // 3. Fetch active custom field definitions for 'deal'
  const activeFields = await getCustomFields(
    organizationId,
    { entityType: "deal", active: true },
    dbInstance
  );

  const customFieldValuesMap: Record<string, unknown> = validated.customFields || {};

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

  // 4. Insert Deal record
  const dealId = crypto.randomUUID();
  const valueFormatted =
    validated.value !== null && validated.value !== undefined
      ? String(validated.value)
      : null;

  await dbInstance.insert(deals).values({
    id: dealId,
    organizationId,
    name: validated.name,
    leadId: resolvedLeadId,
    contactId: resolvedContactId,
    companyId: resolvedCompanyId,
    ownerUserId: resolvedOwnerId,
    pipelineId: validated.pipelineId.trim(),
    pipelineStageId: validated.pipelineStageId.trim(),
    value: valueFormatted,
    currency: validated.currency || "USD",
    expectedCloseDate: validated.expectedCloseDate || null,
    status: validated.status || "open",
    probability: validated.probability !== undefined ? validated.probability : null,
    description: validated.description ? validated.description.trim() : null,
  });

  // 5. Save custom fields
  for (const item of validatedCustomFields) {
    await setCustomFieldValue(
      organizationId,
      "deal",
      dealId,
      item.fieldDefId,
      item.normalizedValue,
      dbInstance
    );
  }

  // 6. Record creation activity if creator is known
  if (creatorUserId) {
    await dbInstance.insert(activities).values({
      id: crypto.randomUUID(),
      organizationId,
      entityType: "deal",
      entityId: dealId,
      type: "note",
      title: "Deal Created",
      description: `Deal "${validated.name}" was created.`,
      status: "completed",
      createdByUserId: creatorUserId,
    });
  }

  const createdDeal = await getDealById(organizationId, dealId, dbInstance);

  try {
    await emitAutomationEvent(
      {
        organizationId,
        entityType: "deal",
        entityId: dealId,
        eventType: "entity_created",
        actorUserId: creatorUserId,
        payload: { current: createdDeal },
      },
      undefined,
      dbInstance
    );
  } catch (err) {
    console.error("[DealService] Error emitting entity_created event:", err);
  }

  return createdDeal;
}

/**
 * Retrieves a single Deal by ID with relations and custom field values.
 */
export async function getDealById(
  organizationId: string,
  dealId: string,
  dbInstance: DbClient = db as DbClient
): Promise<DealWithRelations> {
  const [row] = await dbInstance
    .select({
      deal: deals,
      ownerUser: {
        id: users.id,
        name: users.name,
        email: users.email,
        image: users.image,
      },
      pipeline: {
        id: pipelines.id,
        name: pipelines.name,
      },
      stage: {
        id: pipelineStages.id,
        name: pipelineStages.name,
        displayOrder: pipelineStages.displayOrder,
      },
      lead: {
        id: leads.id,
        firstName: leads.firstName,
        lastName: leads.lastName,
        email: leads.email,
        phone: leads.phone,
      },
      contact: {
        id: contacts.id,
        firstName: contacts.firstName,
        lastName: contacts.lastName,
        email: contacts.email,
        phone: contacts.phone,
      },
      company: {
        id: companies.id,
        name: companies.name,
      },
    })
    .from(deals)
    .leftJoin(users, eq(deals.ownerUserId, users.id))
    .leftJoin(pipelines, eq(deals.pipelineId, pipelines.id))
    .leftJoin(pipelineStages, eq(deals.pipelineStageId, pipelineStages.id))
    .leftJoin(leads, eq(deals.leadId, leads.id))
    .leftJoin(contacts, eq(deals.contactId, contacts.id))
    .leftJoin(companies, eq(deals.companyId, companies.id))
    .where(
      and(
        eq(deals.organizationId, organizationId),
        eq(deals.id, dealId)
      )
    )
    .limit(1);

  if (!row) {
    throw new NotFoundError("Deal not found.");
  }

  // Fetch custom fields
  const customFieldEntries = await getCustomFieldValuesForEntity(
    organizationId,
    "deal",
    dealId,
    dbInstance
  );

  const customFields: Record<string, unknown> = {};
  for (const entry of customFieldEntries) {
    customFields[entry.field.key] = entry.value;
  }

  return {
    ...row.deal,
    status: row.deal.status as DealStatus,
    value: row.deal.value !== null ? Number(row.deal.value) : null,
    ownerUser: row.ownerUser?.id ? row.ownerUser : null,
    pipeline: row.pipeline || { id: row.deal.pipelineId, name: "Unknown Pipeline" },
    stage: row.stage || { id: row.deal.pipelineStageId, name: "Unknown Stage" },
    lead: row.lead?.id ? row.lead : null,
    contact: row.contact?.id ? row.contact : null,
    company: row.company?.id ? row.company : null,
    customFields,
    customFieldValues: customFieldEntries,
  };
}

/**
 * Retrieves deals with filtering, search, sorting, and pagination.
 */
export async function getDeals(
  organizationId: string,
  queryParams?: DealQueryInput,
  dbInstance: DbClient = db as DbClient
): Promise<PaginatedDealsResult> {
  const validated = dealQuerySchema.parse(queryParams || {});

  const conditions = [eq(deals.organizationId, organizationId)];

  // Archived filter
  if (validated.archived === "true") {
    conditions.push(isNotNull(deals.archivedAt));
  } else if (validated.archived === "all") {
    // Both active and archived
  } else {
    conditions.push(isNull(deals.archivedAt));
  }

  // Status filter
  if (validated.status && validated.status !== "all") {
    conditions.push(eq(deals.status, validated.status));
  }

  // Owner filter
  if (validated.ownerId && validated.ownerId !== "all") {
    if (validated.ownerId === "unassigned") {
      conditions.push(isNull(deals.ownerUserId));
    } else {
      conditions.push(eq(deals.ownerUserId, validated.ownerId));
    }
  }

  // Pipeline filter
  if (validated.pipelineId && validated.pipelineId !== "all") {
    conditions.push(eq(deals.pipelineId, validated.pipelineId));
  }

  // Stage filter
  if (validated.pipelineStageId && validated.pipelineStageId !== "all") {
    conditions.push(eq(deals.pipelineStageId, validated.pipelineStageId));
  }

  // Company filter
  if (validated.companyId) {
    conditions.push(eq(deals.companyId, validated.companyId));
  }

  // Contact filter
  if (validated.contactId) {
    conditions.push(eq(deals.contactId, validated.contactId));
  }

  // Lead filter
  if (validated.leadId) {
    conditions.push(eq(deals.leadId, validated.leadId));
  }

  // Date range filters
  if (validated.dateFrom) {
    conditions.push(gte(deals.createdAt, validated.dateFrom));
  }
  if (validated.dateTo) {
    conditions.push(lte(deals.createdAt, validated.dateTo));
  }

  // Search filter (Deal name, Company name, Contact name)
  if (validated.search && validated.search.trim() !== "") {
    const term = `%${validated.search.trim()}%`;
    conditions.push(
      or(
        ilike(deals.name, term),
        ilike(companies.name, term),
        ilike(contacts.firstName, term),
        ilike(contacts.lastName, term),
        ilike(
          sql`coalesce(${contacts.firstName}, '') || ' ' || coalesce(${contacts.lastName}, '')`,
          term
        )
      )!
    );
  }

  const whereClause = and(...conditions);

  // Total count query
  const [{ totalCount }] = await dbInstance
    .select({ totalCount: count() })
    .from(deals)
    .leftJoin(companies, eq(deals.companyId, companies.id))
    .leftJoin(contacts, eq(deals.contactId, contacts.id))
    .where(whereClause);

  const total = Number(totalCount);
  const totalPages = Math.ceil(total / validated.pageSize) || 1;
  const offset = (validated.page - 1) * validated.pageSize;

  // Ordering
  let orderByClause;
  const dir = validated.sortDirection === "asc" ? asc : desc;

  switch (validated.sort) {
    case "name":
      orderByClause = dir(deals.name);
      break;
    case "value":
      orderByClause = dir(deals.value);
      break;
    case "expectedCloseDate":
      orderByClause = dir(deals.expectedCloseDate);
      break;
    case "updatedAt":
      orderByClause = dir(deals.updatedAt);
      break;
    case "createdAt":
    default:
      orderByClause = dir(deals.createdAt);
      break;
  }

  const rows = await dbInstance
    .select({
      deal: deals,
      ownerUser: {
        id: users.id,
        name: users.name,
        email: users.email,
        image: users.image,
      },
      pipeline: {
        id: pipelines.id,
        name: pipelines.name,
      },
      stage: {
        id: pipelineStages.id,
        name: pipelineStages.name,
        displayOrder: pipelineStages.displayOrder,
      },
      lead: {
        id: leads.id,
        firstName: leads.firstName,
        lastName: leads.lastName,
        email: leads.email,
        phone: leads.phone,
      },
      contact: {
        id: contacts.id,
        firstName: contacts.firstName,
        lastName: contacts.lastName,
        email: contacts.email,
        phone: contacts.phone,
      },
      company: {
        id: companies.id,
        name: companies.name,
      },
    })
    .from(deals)
    .leftJoin(users, eq(deals.ownerUserId, users.id))
    .leftJoin(pipelines, eq(deals.pipelineId, pipelines.id))
    .leftJoin(pipelineStages, eq(deals.pipelineStageId, pipelineStages.id))
    .leftJoin(leads, eq(deals.leadId, leads.id))
    .leftJoin(contacts, eq(deals.contactId, contacts.id))
    .leftJoin(companies, eq(deals.companyId, companies.id))
    .where(whereClause)
    .orderBy(orderByClause)
    .limit(validated.pageSize)
    .offset(offset);

  const data: DealWithRelations[] = rows.map((r) => ({
    ...r.deal,
    status: r.deal.status as DealStatus,
    value: r.deal.value !== null ? Number(r.deal.value) : null,
    ownerUser: r.ownerUser?.id ? r.ownerUser : null,
    pipeline: r.pipeline || { id: r.deal.pipelineId, name: "Unknown Pipeline" },
    stage: r.stage || { id: r.deal.pipelineStageId, name: "Unknown Stage" },
    lead: r.lead?.id ? r.lead : null,
    contact: r.contact?.id ? r.contact : null,
    company: r.company?.id ? r.company : null,
    customFields: {},
    customFieldValues: [],
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
 * Updates an existing Deal with partial changes, relationship validation, and audit tracking.
 */
export async function updateDeal(
  organizationId: string,
  dealId: string,
  input: UpdateDealInput,
  dbInstance: DbClient = db as DbClient,
  actorUserId?: string
): Promise<DealWithRelations> {
  const existing = await getDealById(organizationId, dealId, dbInstance);

  const validated = updateDealSchema.parse(input);

  // Validate pipeline and stage changes
  const targetPipelineId =
    validated.pipelineId !== undefined ? validated.pipelineId : existing.pipelineId;
  const targetStageId =
    validated.pipelineStageId !== undefined ? validated.pipelineStageId : existing.pipelineStageId;

  let newStageInfo: { pipelineName: string; stageName: string } | null = null;
  if (
    validated.pipelineId !== undefined ||
    validated.pipelineStageId !== undefined
  ) {
    newStageInfo = await validateDealPipelineAndStage(
      organizationId,
      targetPipelineId,
      targetStageId,
      dbInstance
    );
  }

  // Validate relationships if modified
  let updatedLeadId: string | null | undefined = undefined;
  if (validated.leadId !== undefined) {
    if (validated.leadId && validated.leadId.trim() !== "") {
      await validateActiveLead(organizationId, validated.leadId, dbInstance);
      updatedLeadId = validated.leadId.trim();
    } else {
      updatedLeadId = null;
    }
  }

  let updatedContactId: string | null | undefined = undefined;
  if (validated.contactId !== undefined) {
    if (validated.contactId && validated.contactId.trim() !== "") {
      await validateActiveContact(organizationId, validated.contactId, dbInstance);
      updatedContactId = validated.contactId.trim();
    } else {
      updatedContactId = null;
    }
  }

  let updatedCompanyId: string | null | undefined = undefined;
  if (validated.companyId !== undefined) {
    if (validated.companyId && validated.companyId.trim() !== "") {
      await validateActiveCompany(organizationId, validated.companyId, dbInstance);
      updatedCompanyId = validated.companyId.trim();
    } else {
      updatedCompanyId = null;
    }
  }

  let updatedOwnerId: string | null | undefined = undefined;
  if (validated.ownerUserId !== undefined) {
    if (validated.ownerUserId && validated.ownerUserId.trim() !== "") {
      await validateOwner(organizationId, validated.ownerUserId, dbInstance);
      updatedOwnerId = validated.ownerUserId.trim();
    } else {
      updatedOwnerId = null;
    }
  }

  // Custom fields
  if (validated.customFields && Object.keys(validated.customFields).length > 0) {
    const activeFields = await getCustomFields(
      organizationId,
      { entityType: "deal", active: true },
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
        "deal",
        dealId,
        fieldDef.id,
        validation.normalizedValue,
        dbInstance
      );
    }
  }

  // Audit activities for important lifecycle changes
  if (actorUserId) {
    // 1. Status change audit
    if (validated.status && validated.status !== existing.status) {
      await dbInstance.insert(activities).values({
        id: crypto.randomUUID(),
        organizationId,
        entityType: "deal",
        entityId: dealId,
        type: "status_change",
        title: "Deal Status Changed",
        description: `Status changed from ${existing.status.toUpperCase()} to ${validated.status.toUpperCase()}.`,
        status: "completed",
        createdByUserId: actorUserId,
      });
    }

    // 2. Stage change audit
    if (
      (validated.pipelineStageId && validated.pipelineStageId !== existing.pipelineStageId) ||
      (validated.pipelineId && validated.pipelineId !== existing.pipelineId)
    ) {
      const stageName = newStageInfo?.stageName || "new stage";
      await dbInstance.insert(activities).values({
        id: crypto.randomUUID(),
        organizationId,
        entityType: "deal",
        entityId: dealId,
        type: "status_change",
        title: "Deal Stage Moved",
        description: `Stage moved from "${existing.stage.name}" to "${stageName}".`,
        status: "completed",
        createdByUserId: actorUserId,
      });
    }

    // 3. Assignment change audit
    if (updatedOwnerId !== undefined && updatedOwnerId !== existing.ownerUserId) {
      await dbInstance.insert(activities).values({
        id: crypto.randomUUID(),
        organizationId,
        entityType: "deal",
        entityId: dealId,
        type: "assignment_change",
        title: "Deal Owner Changed",
        description: updatedOwnerId
          ? `Deal ownership assigned to user.`
          : `Deal ownership was unassigned.`,
        status: "completed",
        createdByUserId: actorUserId,
      });
    }
  }

  // Format value if updated
  let formattedValue: string | null | undefined = undefined;
  if (validated.value !== undefined) {
    formattedValue = validated.value !== null ? String(validated.value) : null;
  }

  // Perform deal update
  await dbInstance
    .update(deals)
    .set({
      ...(validated.name !== undefined ? { name: validated.name } : {}),
      ...(updatedLeadId !== undefined ? { leadId: updatedLeadId } : {}),
      ...(updatedContactId !== undefined ? { contactId: updatedContactId } : {}),
      ...(updatedCompanyId !== undefined ? { companyId: updatedCompanyId } : {}),
      ...(updatedOwnerId !== undefined ? { ownerUserId: updatedOwnerId } : {}),
      ...(validated.pipelineId !== undefined ? { pipelineId: targetPipelineId } : {}),
      ...(validated.pipelineStageId !== undefined ? { pipelineStageId: targetStageId } : {}),
      ...(formattedValue !== undefined ? { value: formattedValue } : {}),
      ...(validated.currency !== undefined ? { currency: validated.currency } : {}),
      ...(validated.expectedCloseDate !== undefined
        ? { expectedCloseDate: validated.expectedCloseDate }
        : {}),
      ...(validated.status !== undefined ? { status: validated.status } : {}),
      ...(validated.probability !== undefined
        ? { probability: validated.probability }
        : {}),
      ...(validated.description !== undefined
        ? { description: validated.description ? validated.description.trim() : null }
        : {}),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(deals.organizationId, organizationId),
        eq(deals.id, dealId)
      )
    );

  const updatedDeal = await getDealById(organizationId, dealId, dbInstance);

  try {
    // 1. Status change event
    if (existing.status !== updatedDeal.status) {
      await emitAutomationEvent(
        {
          organizationId,
          entityType: "deal",
          entityId: dealId,
          eventType: "entity_status_changed",
          actorUserId,
          payload: {
            previous: existing,
            current: updatedDeal,
          },
        },
        undefined,
        dbInstance
      );
    }

    // 2. Stage change event
    if (
      existing.pipelineStageId !== updatedDeal.pipelineStageId ||
      existing.pipelineId !== updatedDeal.pipelineId
    ) {
      await emitAutomationEvent(
        {
          organizationId,
          entityType: "deal",
          entityId: dealId,
          eventType: "pipeline_stage_changed",
          actorUserId,
          payload: {
            previous: existing,
            current: updatedDeal,
          },
        },
        undefined,
        dbInstance
      );
    }

    // 3. Assignment change event
    if (existing.ownerUserId !== updatedDeal.ownerUserId) {
      await emitAutomationEvent(
        {
          organizationId,
          entityType: "deal",
          entityId: dealId,
          eventType: "entity_assigned",
          actorUserId,
          payload: {
            previous: existing,
            current: updatedDeal,
          },
        },
        undefined,
        dbInstance
      );
    }

    // 4. General entity updated event
    await emitAutomationEvent(
      {
        organizationId,
        entityType: "deal",
        entityId: dealId,
        eventType: "entity_updated",
        actorUserId,
        payload: {
          previous: existing,
          current: updatedDeal,
        },
      },
      undefined,
      dbInstance
    );
  } catch (err) {
    console.error(
      "[DealService] Error emitting automation events for deal update:",
      err
    );
  }

  return updatedDeal;
}

/**
 * Soft deletes / archives a deal.
 */
export async function archiveDeal(
  organizationId: string,
  dealId: string,
  dbInstance: DbClient = db as DbClient,
  actorUserId?: string
): Promise<DealWithRelations> {
  const existing = await getDealById(organizationId, dealId, dbInstance);

  const now = new Date();
  await dbInstance
    .update(deals)
    .set({
      archivedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(deals.organizationId, organizationId),
        eq(deals.id, dealId)
      )
    );

  if (actorUserId) {
    await dbInstance.insert(activities).values({
      id: crypto.randomUUID(),
      organizationId,
      entityType: "deal",
      entityId: dealId,
      type: "note",
      title: "Deal Archived",
      description: `Deal "${existing.name}" was archived.`,
      status: "completed",
      createdByUserId: actorUserId,
    });
  }

  return getDealById(organizationId, dealId, dbInstance);
}

/**
 * Restores an archived deal.
 */
export async function restoreDeal(
  organizationId: string,
  dealId: string,
  dbInstance: DbClient = db as DbClient,
  actorUserId?: string
): Promise<DealWithRelations> {
  const existing = await getDealById(organizationId, dealId, dbInstance);

  const now = new Date();
  await dbInstance
    .update(deals)
    .set({
      archivedAt: null,
      updatedAt: now,
    })
    .where(
      and(
        eq(deals.organizationId, organizationId),
        eq(deals.id, dealId)
      )
    );

  if (actorUserId) {
    await dbInstance.insert(activities).values({
      id: crypto.randomUUID(),
      organizationId,
      entityType: "deal",
      entityId: dealId,
      type: "note",
      title: "Deal Restored",
      description: `Deal "${existing.name}" was restored from archive.`,
      status: "completed",
      createdByUserId: actorUserId,
    });
  }

  return getDealById(organizationId, dealId, dbInstance);
}

/**
 * Fast search deals for comboboxes.
 */
export async function searchDeals(
  organizationId: string,
  search: string,
  limit: number = 10,
  dbInstance: DbClient = db as DbClient
): Promise<DealWithRelations[]> {
  const result = await getDeals(
    organizationId,
    { search, pageSize: limit, page: 1, archived: "false" },
    dbInstance
  );
  return result.data;
}
