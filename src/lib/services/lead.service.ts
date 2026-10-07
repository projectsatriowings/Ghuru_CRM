import { db } from "@/db";
import { DbClient } from "@/db/types";
import { leads } from "@/db/schema/leads";
import { users } from "@/db/schema/users";
import { organizationMembers } from "@/db/schema/organizations";
import { pipelines, pipelineStages } from "@/db/schema/pipelines";
import { companies } from "@/db/schema/companies";
import { contacts } from "@/db/schema/contacts";
import { activities } from "@/db/schema/activities";
import { validateActiveCompany } from "@/lib/services/contact.service";
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
import { emitAutomationEvent } from "@/lib/automation/automation-engine";
import { publishIntegrationEvent } from "@/lib/services/integrations/integration-event.service";

export interface PaginatedLeadsResult {
  data: LeadWithRelations[];
  pagination: LeadPagination;
}

/**
 * Validates that pipelineId and stageId belong to the organization, are active,
 * and that stageId belongs to pipelineId.
 */
export async function validateLeadPipelineAndStage(
  organizationId: string,
  pipelineId: string | null | undefined,
  stageId: string | null | undefined,
  dbInstance: DbClient = db as DbClient
): Promise<{ resolvedPipelineId: string | null; resolvedStageId: string | null }> {
  const pId = pipelineId && pipelineId.trim() !== "" ? pipelineId.trim() : null;
  const sId = stageId && stageId.trim() !== "" ? stageId.trim() : null;

  if (sId && !pId) {
    throw new ValidationError("Cannot assign stage without a pipeline.");
  }

  if (pId) {
    // Verify pipeline belongs to this organization, is not archived, and is active
    const [pipeline] = await dbInstance
      .select({ id: pipelines.id })
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

    if (sId) {
      // Verify stage belongs to this organization and pipeline, is not archived, and is active
      const [stage] = await dbInstance
        .select({ id: pipelineStages.id })
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
    }
  }

  return {
    resolvedPipelineId: pId,
    resolvedStageId: sId,
  };
}

/**
 * Creates a new lead in the specified organization with atomic validation
 * of assignee, custom fields, pipeline, and stage.
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

  // 2. Validate pipeline and stage (if provided)
  const { resolvedPipelineId, resolvedStageId } =
    await validateLeadPipelineAndStage(
      organizationId,
      validated.pipelineId,
      validated.stageId,
      dbInstance
    );

  // 3. Fetch active custom field definitions for 'lead'
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

  // Validate company relationship (if provided)
  let resolvedCompanyId: string | null = null;
  if (validated.companyId && validated.companyId.trim() !== "") {
    await validateActiveCompany(
      organizationId,
      validated.companyId.trim(),
      dbInstance
    );
    resolvedCompanyId = validated.companyId.trim();
  }

  // 4. Insert Lead record
  const leadId = crypto.randomUUID();

  await dbInstance.insert(leads).values({
    id: leadId,
    organizationId,
    companyId: resolvedCompanyId,
    firstName: validated.firstName,
    lastName: validated.lastName ? validated.lastName.trim() : null,
    email: validated.email ? validated.email.trim() : null,
    phone: validated.phone ? validated.phone.trim() : null,
    source: validated.source,
    status: validated.status,
    assignedToUserId: assignedUserId,
    pipelineId: resolvedPipelineId,
    stageId: resolvedStageId,
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

  const createdLead = await getLeadById(organizationId, leadId, dbInstance);

  try {
    await emitAutomationEvent(
      {
        organizationId,
        entityType: "lead",
        entityId: leadId,
        eventType: "entity_created",
        payload: { current: createdLead },
      },
      undefined,
      dbInstance
    );
  } catch (err) {
    console.error("[LeadService] Error emitting entity_created event:", err);
  }

  return createdLead;
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

  // Pipeline filter
  if (validated.pipelineId && validated.pipelineId !== "all") {
    if (validated.pipelineId === "unassigned") {
      conditions.push(isNull(leads.pipelineId));
    } else {
      conditions.push(eq(leads.pipelineId, validated.pipelineId));
    }
  }

  // Stage filter
  if (validated.stageId && validated.stageId !== "all") {
    if (validated.stageId === "unassigned") {
      conditions.push(isNull(leads.stageId));
    } else {
      conditions.push(eq(leads.stageId, validated.stageId));
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

  // Data query with left join on users for assigned member details, pipelines, stages, companies, and contacts
  const rows = await dbInstance
    .select({
      lead: leads,
      assignedUser: {
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
      company: {
        id: companies.id,
        name: companies.name,
      },
      contact: {
        id: contacts.id,
        firstName: contacts.firstName,
        lastName: contacts.lastName,
        email: contacts.email,
      },
    })
    .from(leads)
    .leftJoin(users, eq(leads.assignedToUserId, users.id))
    .leftJoin(pipelines, eq(leads.pipelineId, pipelines.id))
    .leftJoin(pipelineStages, eq(leads.stageId, pipelineStages.id))
    .leftJoin(companies, eq(leads.companyId, companies.id))
    .leftJoin(contacts, eq(leads.contactId, contacts.id))
    .where(and(...conditions))
    .orderBy(orderClause)
    .limit(validated.pageSize)
    .offset((validated.page - 1) * validated.pageSize);

  const data: LeadWithRelations[] = rows.map((r) => ({
    ...r.lead,
    source: r.lead.source as LeadSource,
    status: r.lead.status as LeadStatus,
    assignedToUser: r.assignedUser?.id ? r.assignedUser : null,
    pipeline: r.pipeline?.id ? r.pipeline : null,
    stage: r.stage?.id ? r.stage : null,
    company: r.company?.id ? r.company : null,
    contact: r.contact?.id ? r.contact : null,
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
 * Retrieves a single lead by ID, including assigned user, pipeline, stage, company, and custom field values.
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
      pipeline: {
        id: pipelines.id,
        name: pipelines.name,
      },
      stage: {
        id: pipelineStages.id,
        name: pipelineStages.name,
        displayOrder: pipelineStages.displayOrder,
      },
      company: {
        id: companies.id,
        name: companies.name,
      },
      contact: {
        id: contacts.id,
        firstName: contacts.firstName,
        lastName: contacts.lastName,
        email: contacts.email,
      },
    })
    .from(leads)
    .leftJoin(users, eq(leads.assignedToUserId, users.id))
    .leftJoin(pipelines, eq(leads.pipelineId, pipelines.id))
    .leftJoin(pipelineStages, eq(leads.stageId, pipelineStages.id))
    .leftJoin(companies, eq(leads.companyId, companies.id))
    .leftJoin(contacts, eq(leads.contactId, contacts.id))
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
    pipeline: row.pipeline?.id ? row.pipeline : null,
    stage: row.stage?.id ? row.stage : null,
    company: row.company?.id ? row.company : null,
    contact: row.contact?.id ? row.contact : null,
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
  const existingLead = await getLeadById(organizationId, leadId, dbInstance);

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

  // 2b. Handle companyId change
  let targetCompanyId: string | null | undefined = undefined;
  if (validated.companyId !== undefined) {
    if (validated.companyId && validated.companyId.trim() !== "") {
      const cid = validated.companyId.trim();
      await validateActiveCompany(organizationId, cid, dbInstance);
      targetCompanyId = cid;
    } else {
      targetCompanyId = null;
    }
  }

  // 3. Verify pipeline and stage relationship (if changed)
  let targetPipelineId: string | null | undefined = undefined;
  let targetStageId: string | null | undefined = undefined;

  const hasPipelineUpdate = validated.pipelineId !== undefined;
  const hasStageUpdate = validated.stageId !== undefined;

  if (hasPipelineUpdate || hasStageUpdate) {
    const rawPipeline = hasPipelineUpdate
      ? (validated.pipelineId && validated.pipelineId.trim() !== "" ? validated.pipelineId.trim() : null)
      : existingLead.pipelineId;

    let rawStage = hasStageUpdate
      ? (validated.stageId && validated.stageId.trim() !== "" ? validated.stageId.trim() : null)
      : existingLead.stageId;

    // If pipeline is being explicitly removed/cleared, stage must also be cleared
    if (hasPipelineUpdate && rawPipeline === null && !hasStageUpdate) {
      rawStage = null;
    }

    const { resolvedPipelineId, resolvedStageId } =
      await validateLeadPipelineAndStage(
        organizationId,
        rawPipeline,
        rawStage,
        dbInstance
      );

    targetPipelineId = resolvedPipelineId;
    targetStageId = resolvedStageId;
  }

  // 4. Validate and update custom fields (if provided)
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

  // 5. Update lead standard fields
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
      ...(targetCompanyId !== undefined
        ? { companyId: targetCompanyId }
        : {}),
      ...(targetPipelineId !== undefined
        ? { pipelineId: targetPipelineId }
        : {}),
      ...(targetStageId !== undefined
        ? { stageId: targetStageId }
        : {}),
      ...(validated.notes !== undefined
        ? { notes: validated.notes ? validated.notes.trim() : null }
        : {}),
      updatedAt: new Date(),
    })
    .where(
      and(eq(leads.organizationId, organizationId), eq(leads.id, leadId))
    );

  const updatedLead = await getLeadById(organizationId, leadId, dbInstance);

  try {
    // 1. Status change
    if (existingLead.status !== updatedLead.status) {
      await emitAutomationEvent(
        {
          organizationId,
          entityType: "lead",
          entityId: leadId,
          eventType: "entity_status_changed",
          payload: {
            previous: existingLead,
            current: updatedLead,
          },
        },
        undefined,
        dbInstance
      );
    }

    // 2. Stage change
    if (
      existingLead.stageId !== updatedLead.stageId ||
      existingLead.pipelineId !== updatedLead.pipelineId
    ) {
      await emitAutomationEvent(
        {
          organizationId,
          entityType: "lead",
          entityId: leadId,
          eventType: "pipeline_stage_changed",
          payload: {
            previous: existingLead,
            current: updatedLead,
          },
        },
        undefined,
        dbInstance
      );
    }

    // 3. Assignment change
    if (existingLead.assignedToUserId !== updatedLead.assignedToUserId) {
      await emitAutomationEvent(
        {
          organizationId,
          entityType: "lead",
          entityId: leadId,
          eventType: "entity_assigned",
          payload: {
            previous: existingLead,
            current: updatedLead,
          },
        },
        undefined,
        dbInstance
      );
    }

    // 4. General update
    await emitAutomationEvent(
      {
        organizationId,
        entityType: "lead",
        entityId: leadId,
        eventType: "entity_updated",
        payload: {
          previous: existingLead,
          current: updatedLead,
        },
      },
      undefined,
      dbInstance
    );
  } catch (err) {
    console.error(
      "[LeadService] Error emitting automation events for lead update:",
      err
    );
  }

  return updatedLead;
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

// ---------------------------------------------------------------------------
// Milestone 2.5D — Lead → Contact Conversion
// ---------------------------------------------------------------------------

export interface DuplicateContactResult {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
}

/**
 * Searches for potential duplicate contacts within the organization
 * based on email and/or phone match (active contacts only).
 */
export async function findDuplicateContacts(
  organizationId: string,
  email: string | null | undefined,
  phone: string | null | undefined,
  dbInstance: DbClient = db as DbClient
): Promise<DuplicateContactResult[]> {
  if (!email && !phone) return [];

  const conditions = [eq(contacts.organizationId, organizationId), isNull(contacts.archivedAt)];

  const matchClauses = [];
  if (email && email.trim() !== "") {
    matchClauses.push(eq(contacts.email, email.trim().toLowerCase()));
  }
  if (phone && phone.trim() !== "") {
    matchClauses.push(eq(contacts.phone, phone.trim()));
  }

  if (matchClauses.length === 0) return [];

  conditions.push(or(...matchClauses)!);

  const rows = await dbInstance
    .select({
      id: contacts.id,
      firstName: contacts.firstName,
      lastName: contacts.lastName,
      email: contacts.email,
      phone: contacts.phone,
    })
    .from(contacts)
    .where(and(...conditions))
    .limit(10);

  return rows;
}

export interface ConvertLeadInput {
  /** "create_new" — create a new Contact from the lead's data.
   *  "link_existing" — link to an already-existing Contact in the same org. */
  mode: "create_new" | "link_existing";
  /** Required when mode === "link_existing". Must belong to the same org. */
  existingContactId?: string;
  /** When mode === "create_new": skip duplicate-contact guard. Default false. */
  skipDuplicateCheck?: boolean;
  /** Override first name for the new contact (defaults to lead's first name). */
  overrideFirstName?: string;
  /** Override last name for the new contact (defaults to lead's last name). */
  overrideLastName?: string;
  /** Override email for the new contact (defaults to lead's email). */
  overrideEmail?: string;
  /** Override phone for the new contact (defaults to lead's phone). */
  overridePhone?: string;
  /** Notes to accompany the conversion activity record. */
  conversionNotes?: string;
}

export interface ConvertLeadResult {
  lead: LeadWithRelations;
  contactId: string;
  /** Set when duplicates were found and the caller should be warned. */
  duplicates?: DuplicateContactResult[];
}

/**
 * Converts a Lead to a Contact in a single atomic database transaction.
 *
 * Supported modes:
 * - "create_new": Creates a new Contact from the Lead's data (with optional
 *   duplicate guard). Marks the lead as converted and links contactId.
 * - "link_existing": Links an existing Contact to the Lead. Marks the lead
 *   as converted and links contactId.
 *
 * In both modes a "note" Activity is created as a conversion audit trail.
 * If any step fails the entire transaction is rolled back.
 */
export async function convertLead(
  organizationId: string,
  leadId: string,
  actorUserId: string,
  input: ConvertLeadInput,
  dbInstance: DbClient = db as DbClient
): Promise<ConvertLeadResult> {
  // 1. Fetch and validate the lead (tenant isolation, not already converted, not archived)
  const existingLead = await getLeadById(organizationId, leadId, dbInstance);

  if (existingLead.archivedAt) {
    throw new ValidationError("Archived leads cannot be converted.");
  }

  if (existingLead.status === "converted" && existingLead.contactId) {
    throw new ValidationError("This lead has already been converted to a contact.");
  }

  let duplicatesToReturn: DuplicateContactResult[] | undefined;
  let contactId: string;

  if (input.mode === "create_new") {
    // 2a. Optionally check for duplicates before creating
    if (!input.skipDuplicateCheck) {
      const targetEmail = input.overrideEmail ?? existingLead.email;
      const targetPhone = input.overridePhone ?? existingLead.phone;
      const dups = await findDuplicateContacts(
        organizationId,
        targetEmail,
        targetPhone,
        dbInstance
      );

      if (dups.length > 0) {
        // Surface duplicates — caller must explicitly re-submit with skipDuplicateCheck=true
        duplicatesToReturn = dups;
        // Return early before any mutation; no transaction needed
        return {
          lead: existingLead,
          contactId: "",
          duplicates: duplicatesToReturn,
        };
      }
    }

    // 3a. Execute atomic conversion — create contact + update lead + create activity
    const newContactId = crypto.randomUUID();

    const firstName = (input.overrideFirstName ?? existingLead.firstName).trim();
    const lastName = input.overrideLastName !== undefined
      ? (input.overrideLastName?.trim() || null)
      : (existingLead.lastName ? existingLead.lastName.trim() : null);
    const email = input.overrideEmail !== undefined
      ? (input.overrideEmail?.trim().toLowerCase() || null)
      : (existingLead.email ? existingLead.email.trim().toLowerCase() : null);
    const phone = input.overridePhone !== undefined
      ? (input.overridePhone?.trim() || null)
      : (existingLead.phone ? existingLead.phone.trim() : null);

    if (!firstName) {
      throw new ValidationError("Contact first name cannot be empty.");
    }

    const now = new Date();
    const activityId = crypto.randomUUID();
    const convNotes = input.conversionNotes?.trim();
    const convDescription = convNotes
      ? `Converted to contact. Notes: ${convNotes}`
      : `Lead was converted to a new contact (${firstName}${lastName ? ` ${lastName}` : ""}).`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = dbInstance as any;
    if ("batch" in client && typeof client.batch === "function") {
      // Neon HTTP — execute in one atomic batch request
      await client.batch([
        dbInstance.insert(contacts).values({
          id: newContactId,
          organizationId,
          firstName,
          lastName,
          email,
          phone,
          companyId: existingLead.companyId ?? null,
          isPrimaryContact: false,
          ownerUserId: existingLead.assignedToUserId ?? null,
          notes: null,
          createdAt: now,
          updatedAt: now,
        }),
        dbInstance
          .update(leads)
          .set({ contactId: newContactId, status: "converted", updatedAt: now })
          .where(and(eq(leads.organizationId, organizationId), eq(leads.id, leadId))),
        dbInstance.insert(activities).values({
          id: activityId,
          organizationId,
          entityType: "lead",
          entityId: leadId,
          leadId,
          type: "note",
          title: "Lead converted to contact",
          description: convDescription,
          createdByUserId: actorUserId,
          createdAt: now,
          updatedAt: now,
        }),
      ]);
    } else if ("transaction" in client && typeof client.transaction === "function") {
      // PGlite (tests) or standard Postgres pool
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await client.transaction(async (tx: any) => {
        await tx.insert(contacts).values({
          id: newContactId,
          organizationId,
          firstName,
          lastName,
          email,
          phone,
          companyId: existingLead.companyId ?? null,
          isPrimaryContact: false,
          ownerUserId: existingLead.assignedToUserId ?? null,
          notes: null,
          createdAt: now,
          updatedAt: now,
        });
        await tx
          .update(leads)
          .set({ contactId: newContactId, status: "converted", updatedAt: now })
          .where(and(eq(leads.organizationId, organizationId), eq(leads.id, leadId)));
        await tx.insert(activities).values({
          id: activityId,
          organizationId,
          entityType: "lead",
          entityId: leadId,
          leadId,
          type: "note",
          title: "Lead converted to contact",
          description: convDescription,
          createdByUserId: actorUserId,
          createdAt: now,
          updatedAt: now,
        });
      });
    } else {
      // Fallback: sequential writes (no atomic guarantee)
      await dbInstance.insert(contacts).values({
        id: newContactId,
        organizationId,
        firstName,
        lastName,
        email,
        phone,
        companyId: existingLead.companyId ?? null,
        isPrimaryContact: false,
        ownerUserId: existingLead.assignedToUserId ?? null,
        notes: null,
        createdAt: now,
        updatedAt: now,
      });
      await dbInstance
        .update(leads)
        .set({ contactId: newContactId, status: "converted", updatedAt: now })
        .where(and(eq(leads.organizationId, organizationId), eq(leads.id, leadId)));
      await dbInstance.insert(activities).values({
        id: activityId,
        organizationId,
        entityType: "lead",
        entityId: leadId,
        leadId,
        type: "note",
        title: "Lead converted to contact",
        description: convDescription,
        createdByUserId: actorUserId,
        createdAt: now,
        updatedAt: now,
      });
    }

    contactId = newContactId;
  } else {
    // mode === "link_existing"
    if (!input.existingContactId || input.existingContactId.trim() === "") {
      throw new ValidationError("An existing contact ID is required for link_existing mode.");
    }

    const existingContactId = input.existingContactId.trim();

    // Verify the target contact belongs to this organization and is not archived
    const [targetContact] = await dbInstance
      .select({
        id: contacts.id,
        firstName: contacts.firstName,
        lastName: contacts.lastName,
        archivedAt: contacts.archivedAt,
      })
      .from(contacts)
      .where(
        and(
          eq(contacts.id, existingContactId),
          eq(contacts.organizationId, organizationId)
        )
      )
      .limit(1);

    if (!targetContact) {
      throw new ValidationError("Selected contact not found in this organization.");
    }

    if (targetContact.archivedAt) {
      throw new ValidationError("Cannot link to an archived contact.");
    }

    const now = new Date();
    const contactName = `${targetContact.firstName}${targetContact.lastName ? ` ${targetContact.lastName}` : ""}`;
    const activityId = crypto.randomUUID();
    const convNotes = input.conversionNotes?.trim();
    const convDescription = convNotes
      ? `Linked to existing contact "${contactName}". Notes: ${convNotes}`
      : `Lead was linked to existing contact "${contactName}".`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client2 = dbInstance as any;
    if ("batch" in client2 && typeof client2.batch === "function") {
      // Neon HTTP — execute in one atomic batch request
      await client2.batch([
        dbInstance
          .update(leads)
          .set({ contactId: existingContactId, status: "converted", updatedAt: now })
          .where(and(eq(leads.organizationId, organizationId), eq(leads.id, leadId))),
        dbInstance.insert(activities).values({
          id: activityId,
          organizationId,
          entityType: "lead",
          entityId: leadId,
          leadId,
          type: "note",
          title: "Lead linked to existing contact",
          description: convDescription,
          createdByUserId: actorUserId,
          createdAt: now,
          updatedAt: now,
        }),
      ]);
    } else if ("transaction" in client2 && typeof client2.transaction === "function") {
      // PGlite (tests) or standard Postgres pool
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await client2.transaction(async (tx: any) => {
        await tx
          .update(leads)
          .set({ contactId: existingContactId, status: "converted", updatedAt: now })
          .where(and(eq(leads.organizationId, organizationId), eq(leads.id, leadId)));
        await tx.insert(activities).values({
          id: activityId,
          organizationId,
          entityType: "lead",
          entityId: leadId,
          leadId,
          type: "note",
          title: "Lead linked to existing contact",
          description: convDescription,
          createdByUserId: actorUserId,
          createdAt: now,
          updatedAt: now,
        });
      });
    } else {
      // Fallback: sequential writes
      await dbInstance
        .update(leads)
        .set({ contactId: existingContactId, status: "converted", updatedAt: now })
        .where(and(eq(leads.organizationId, organizationId), eq(leads.id, leadId)));
      await dbInstance.insert(activities).values({
        id: activityId,
        organizationId,
        entityType: "lead",
        entityId: leadId,
        leadId,
        type: "note",
        title: "Lead linked to existing contact",
        description: convDescription,
        createdByUserId: actorUserId,
        createdAt: now,
        updatedAt: now,
      });
    }

    contactId = existingContactId;
  }

  const updatedLead = await getLeadById(organizationId, leadId, dbInstance);

  void publishIntegrationEvent(
    {
      organizationId,
      eventType: "lead.converted",
      entityType: "lead",
      entityId: leadId,
      payload: {
        lead: updatedLead,
        contactId,
        mode: input.mode,
      },
      metadata: {
        actorUserId,
      },
    },
    dbInstance
  ).catch((err) => {
    console.error(
      "[LeadService] Failed to dispatch lead.converted integration event:",
      err
    );
  });

  return { lead: updatedLead, contactId };
}
