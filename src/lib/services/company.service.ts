import { db } from "@/db";
import { DbClient } from "@/db/types";
import { companies } from "@/db/schema/companies";
import { contacts } from "@/db/schema/contacts";
import { leads } from "@/db/schema/leads";
import { pipelines, pipelineStages } from "@/db/schema/pipelines";
import { users } from "@/db/schema/users";
import { organizationMembers } from "@/db/schema/organizations";
import {
  eq,
  and,
  or,
  ne,
  ilike,
  isNull,
  isNotNull,
  asc,
  desc,
  count,
  sql,
} from "drizzle-orm";
import {
  createCompanySchema,
  updateCompanySchema,
  companyQuerySchema,
  type CreateCompanyInput,
  type UpdateCompanyInput,
  type CompanyQueryInput,
} from "@/lib/validations/company";
import {
  type CompanyWithRelations,
  type PaginatedCompaniesResult,
  type CompanyContactItem,
  type CompanyLeadItem,
} from "@/lib/types/companies";
import {
  getCustomFields,
  setCustomFieldValue,
  getCustomFieldValuesForEntity,
} from "@/lib/services/custom-field.service";
import { validateCustomFieldValue } from "@/lib/validations/custom-field";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { emitAutomationEvent } from "@/lib/automation/automation-engine";

/**
 * Creates a new Company for an organization.
 */
export async function createCompany(
  organizationId: string,
  input: CreateCompanyInput,
  dbInstance: DbClient = db as DbClient
): Promise<CompanyWithRelations> {
  const validated = createCompanySchema.parse(input);

  // 1. Verify assigned owner belongs to this organization (if provided)
  const ownerId =
    validated.ownerUserId && validated.ownerUserId.trim() !== ""
      ? validated.ownerUserId.trim()
      : null;

  if (ownerId) {
    const member = await dbInstance
      .select({ id: organizationMembers.id })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, organizationId),
          eq(organizationMembers.userId, ownerId)
        )
      )
      .limit(1);

    if (member.length === 0) {
      throw new ValidationError(
        "Assigned owner does not belong to this organization."
      );
    }
  }

  // 2. Fetch active custom field definitions for 'company'
  const activeFields = await getCustomFields(
    organizationId,
    { entityType: "company", active: true },
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

  // 3. Insert Company record
  const companyId = crypto.randomUUID();

  await dbInstance.insert(companies).values({
    id: companyId,
    organizationId,
    name: validated.name,
    website: validated.website ? validated.website.trim() : null,
    email: validated.email ? validated.email.trim() : null,
    phone: validated.phone ? validated.phone.trim() : null,
    industry: validated.industry ? validated.industry.trim() : null,
    companySize: validated.companySize ? validated.companySize.trim() : null,
    ownerUserId: ownerId,
    notes: validated.notes ? validated.notes.trim() : null,
  });

  // 4. Save validated custom field values
  for (const item of validatedCustomFields) {
    await setCustomFieldValue(
      organizationId,
      "company",
      companyId,
      item.fieldDefId,
      item.normalizedValue,
      dbInstance
    );
  }

  const createdCompany = await getCompanyById(
    organizationId,
    companyId,
    dbInstance
  );

  try {
    await emitAutomationEvent(
      {
        organizationId,
        entityType: "company",
        entityId: companyId,
        eventType: "entity_created",
        payload: { current: createdCompany },
      },
      undefined,
      dbInstance
    );
  } catch (err) {
    console.error("[CompanyService] Error emitting entity_created event:", err);
  }

  return createdCompany;
}

/**
 * Retrieves companies for an organization with filtering, search, sorting, and pagination.
 */
export async function getCompanies(
  organizationId: string,
  queryParams?: CompanyQueryInput,
  dbInstance: DbClient = db as DbClient
): Promise<PaginatedCompaniesResult> {
  const validated = companyQuerySchema.parse(queryParams || {});

  const conditions = [eq(companies.organizationId, organizationId)];

  // Archived filter
  if (validated.archived === "true") {
    conditions.push(isNotNull(companies.archivedAt));
  } else if (validated.archived === "all") {
    // Show both active and archived
  } else {
    // Default: only active companies
    conditions.push(isNull(companies.archivedAt));
  }

  // Owner filter
  if (validated.ownerId && validated.ownerId !== "all") {
    if (validated.ownerId === "unassigned") {
      conditions.push(isNull(companies.ownerUserId));
    } else {
      conditions.push(eq(companies.ownerUserId, validated.ownerId));
    }
  }

  // Search filter (name, email, phone, website, industry)
  if (validated.search && validated.search.trim() !== "") {
    const term = `%${validated.search.trim()}%`;
    const digitsOnly = validated.search.replace(/\D/g, "");
    const searchConditions = [
      ilike(companies.name, term),
      ilike(companies.email, term),
      ilike(companies.phone, term),
      ilike(companies.website, term),
      ilike(companies.industry, term),
    ];

    if (digitsOnly.length >= 3) {
      searchConditions.push(
        ilike(
          sql`regexp_replace(${companies.phone}, '[^0-9]', '', 'g')`,
          `%${digitsOnly}%`
        )
      );
    }

    conditions.push(or(...searchConditions)!);
  }

  // Count query
  const [totalRes] = await dbInstance
    .select({ total: count() })
    .from(companies)
    .where(and(...conditions));

  const total = Number(totalRes?.total || 0);
  const totalPages = Math.ceil(total / validated.pageSize) || 1;

  // Sorting
  const sortCol =
    validated.sort === "updatedAt"
      ? companies.updatedAt
      : validated.sort === "name"
      ? companies.name
      : validated.sort === "industry"
      ? companies.industry
      : companies.createdAt;

  const orderClause =
    validated.sortDirection === "asc" ? asc(sortCol) : desc(sortCol);

  // Data query with left join on users for owner details
  const rows = await dbInstance
    .select({
      company: companies,
      ownerUser: {
        id: users.id,
        name: users.name,
        email: users.email,
        image: users.image,
      },
    })
    .from(companies)
    .leftJoin(users, eq(companies.ownerUserId, users.id))
    .where(and(...conditions))
    .orderBy(orderClause)
    .limit(validated.pageSize)
    .offset((validated.page - 1) * validated.pageSize);

  const data: CompanyWithRelations[] = rows.map((r) => ({
    ...r.company,
    ownerUser: r.ownerUser?.id ? r.ownerUser : null,
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
 * Retrieves a single company by ID, including owner and custom field values.
 */
export async function getCompanyById(
  organizationId: string,
  companyId: string,
  dbInstance: DbClient = db as DbClient
): Promise<CompanyWithRelations> {
  const [row] = await dbInstance
    .select({
      company: companies,
      ownerUser: {
        id: users.id,
        name: users.name,
        email: users.email,
        image: users.image,
      },
    })
    .from(companies)
    .leftJoin(users, eq(companies.ownerUserId, users.id))
    .where(
      and(
        eq(companies.organizationId, organizationId),
        eq(companies.id, companyId)
      )
    )
    .limit(1);

  if (!row) {
    throw new NotFoundError("Company not found.");
  }

  // Fetch custom field values polymorphic to company
  const customFieldEntries = await getCustomFieldValuesForEntity(
    organizationId,
    "company",
    companyId,
    dbInstance
  );

  const customFields: Record<string, unknown> = {};
  for (const entry of customFieldEntries) {
    customFields[entry.field.key] = entry.value;
  }

  // Count active related contacts
  const [contactCountRes] = await dbInstance
    .select({ count: count() })
    .from(contacts)
    .where(
      and(
        eq(contacts.organizationId, organizationId),
        eq(contacts.companyId, companyId),
        isNull(contacts.archivedAt)
      )
    );

  // Count active related leads
  const [leadCountRes] = await dbInstance
    .select({ count: count() })
    .from(leads)
    .where(
      and(
        eq(leads.organizationId, organizationId),
        eq(leads.companyId, companyId),
        isNull(leads.archivedAt)
      )
    );

  // Find primary contact
  const [primaryContactRow] = await dbInstance
    .select({
      id: contacts.id,
      firstName: contacts.firstName,
      lastName: contacts.lastName,
      email: contacts.email,
      phone: contacts.phone,
    })
    .from(contacts)
    .where(
      and(
        eq(contacts.organizationId, organizationId),
        eq(contacts.companyId, companyId),
        eq(contacts.isPrimaryContact, true),
        isNull(contacts.archivedAt)
      )
    )
    .limit(1);

  return {
    ...row.company,
    ownerUser: row.ownerUser?.id ? row.ownerUser : null,
    contactCount: Number(contactCountRes?.count || 0),
    leadCount: Number(leadCountRes?.count || 0),
    primaryContact: primaryContactRow || null,
    customFields,
    customFieldValues: customFieldEntries,
  };
}

/**
 * Updates an existing company's standard fields and custom field values.
 */
export async function updateCompany(
  organizationId: string,
  companyId: string,
  input: UpdateCompanyInput,
  dbInstance: DbClient = db as DbClient
): Promise<CompanyWithRelations> {
  // 1. Ensure company exists in this organization
  const existingCompany = await getCompanyById(
    organizationId,
    companyId,
    dbInstance
  );

  const validated = updateCompanySchema.parse(input);

  // 2. Verify assigned owner belongs to this organization (if changed)
  let ownerId: string | null | undefined = undefined;
  if (validated.ownerUserId !== undefined) {
    if (validated.ownerUserId && validated.ownerUserId.trim() !== "") {
      const assignedId = validated.ownerUserId.trim();
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
          "Assigned owner does not belong to this organization."
        );
      }
      ownerId = assignedId;
    } else {
      ownerId = null;
    }
  }

  // 3. Validate and update custom fields (if provided)
  if (validated.customFields) {
    const activeFields = await getCustomFields(
      organizationId,
      { entityType: "company" },
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
        "company",
        companyId,
        fieldDef.id,
        validation.normalizedValue,
        dbInstance
      );
    }
  }

  // 4. Update company standard fields
  await dbInstance
    .update(companies)
    .set({
      ...(validated.name !== undefined ? { name: validated.name } : {}),
      ...(validated.website !== undefined
        ? { website: validated.website ? validated.website.trim() : null }
        : {}),
      ...(validated.email !== undefined
        ? { email: validated.email ? validated.email.trim() : null }
        : {}),
      ...(validated.phone !== undefined
        ? { phone: validated.phone ? validated.phone.trim() : null }
        : {}),
      ...(validated.industry !== undefined
        ? { industry: validated.industry ? validated.industry.trim() : null }
        : {}),
      ...(validated.companySize !== undefined
        ? { companySize: validated.companySize ? validated.companySize.trim() : null }
        : {}),
      ...(ownerId !== undefined ? { ownerUserId: ownerId } : {}),
      ...(validated.notes !== undefined
        ? { notes: validated.notes ? validated.notes.trim() : null }
        : {}),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(companies.organizationId, organizationId),
        eq(companies.id, companyId)
      )
    );

  const updatedCompany = await getCompanyById(
    organizationId,
    companyId,
    dbInstance
  );

  try {
    if (existingCompany.ownerUserId !== updatedCompany.ownerUserId) {
      await emitAutomationEvent(
        {
          organizationId,
          entityType: "company",
          entityId: companyId,
          eventType: "entity_assigned",
          payload: {
            previous: existingCompany,
            current: updatedCompany,
          },
        },
        undefined,
        dbInstance
      );
    }

    await emitAutomationEvent(
      {
        organizationId,
        entityType: "company",
        entityId: companyId,
        eventType: "entity_updated",
        payload: {
          previous: existingCompany,
          current: updatedCompany,
        },
      },
      undefined,
      dbInstance
    );
  } catch (err) {
    console.error(
      "[CompanyService] Error emitting automation events for company update:",
      err
    );
  }

  return updatedCompany;
}

/**
 * Soft deletes / archives a company by setting archivedAt.
 */
export async function archiveCompany(
  organizationId: string,
  companyId: string,
  dbInstance: DbClient = db as DbClient
): Promise<CompanyWithRelations> {
  await getCompanyById(organizationId, companyId, dbInstance);

  await dbInstance
    .update(companies)
    .set({
      archivedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(companies.organizationId, organizationId),
        eq(companies.id, companyId)
      )
    );

  return getCompanyById(organizationId, companyId, dbInstance);
}

/**
 * Restores an archived company by clearing archivedAt.
 */
export async function restoreCompany(
  organizationId: string,
  companyId: string,
  dbInstance: DbClient = db as DbClient
): Promise<CompanyWithRelations> {
  await getCompanyById(organizationId, companyId, dbInstance);

  await dbInstance
    .update(companies)
    .set({
      archivedAt: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(companies.organizationId, organizationId),
        eq(companies.id, companyId)
      )
    );

  return getCompanyById(organizationId, companyId, dbInstance);
}

/**
 * Searches companies by query term.
 */
export async function searchCompanies(
  organizationId: string,
  search: string,
  limit: number = 10,
  dbInstance: DbClient = db as DbClient
): Promise<CompanyWithRelations[]> {
  const result = await getCompanies(
    organizationId,
    { search, pageSize: limit, page: 1, archived: "false" },
    dbInstance
  );
  return result.data;
}

/**
 * Validates that a company belongs to the organization and is not archived.
 */
export async function validateCompanyForOrganization(
  organizationId: string,
  companyId: string,
  dbInstance: DbClient = db as DbClient
) {
  const [comp] = await dbInstance
    .select({
      id: companies.id,
      name: companies.name,
      archivedAt: companies.archivedAt,
    })
    .from(companies)
    .where(
      and(
        eq(companies.organizationId, organizationId),
        eq(companies.id, companyId)
      )
    )
    .limit(1);

  if (!comp) {
    throw new ValidationError("Company not found in this organization.");
  }
  if (comp.archivedAt !== null) {
    throw new ValidationError("Archived companies cannot be assigned.");
  }
  return comp;
}

/**
 * Retrieves all active contacts associated with a specific company.
 */
export async function getCompanyContacts(
  organizationId: string,
  companyId: string,
  dbInstance: DbClient = db as DbClient
): Promise<CompanyContactItem[]> {
  await getCompanyById(organizationId, companyId, dbInstance);

  const rows = await dbInstance
    .select({
      contact: contacts,
      ownerUser: {
        id: users.id,
        name: users.name,
        email: users.email,
        image: users.image,
      },
    })
    .from(contacts)
    .leftJoin(users, eq(contacts.ownerUserId, users.id))
    .where(
      and(
        eq(contacts.organizationId, organizationId),
        eq(contacts.companyId, companyId),
        isNull(contacts.archivedAt)
      )
    )
    .orderBy(desc(contacts.isPrimaryContact), asc(contacts.firstName));

  return rows.map((r) => ({
    id: r.contact.id,
    firstName: r.contact.firstName,
    lastName: r.contact.lastName,
    email: r.contact.email,
    phone: r.contact.phone,
    isPrimaryContact: r.contact.isPrimaryContact,
    ownerUser: r.ownerUser?.id ? r.ownerUser : null,
    createdAt: r.contact.createdAt,
  }));
}

/**
 * Retrieves all active leads associated with a specific company.
 */
export async function getCompanyLeads(
  organizationId: string,
  companyId: string,
  dbInstance: DbClient = db as DbClient
): Promise<CompanyLeadItem[]> {
  await getCompanyById(organizationId, companyId, dbInstance);

  const rows = await dbInstance
    .select({
      lead: leads,
      pipeline: {
        id: pipelines.id,
        name: pipelines.name,
      },
      stage: {
        id: pipelineStages.id,
        name: pipelineStages.name,
      },
      assignedUser: {
        id: users.id,
        name: users.name,
        email: users.email,
        image: users.image,
      },
    })
    .from(leads)
    .leftJoin(users, eq(leads.assignedToUserId, users.id))
    .leftJoin(pipelines, eq(leads.pipelineId, pipelines.id))
    .leftJoin(pipelineStages, eq(leads.stageId, pipelineStages.id))
    .where(
      and(
        eq(leads.organizationId, organizationId),
        eq(leads.companyId, companyId),
        isNull(leads.archivedAt)
      )
    )
    .orderBy(desc(leads.createdAt));

  return rows.map((r) => ({
    id: r.lead.id,
    firstName: r.lead.firstName,
    lastName: r.lead.lastName,
    email: r.lead.email,
    phone: r.lead.phone,
    status: r.lead.status,
    pipeline: r.pipeline?.id ? r.pipeline : null,
    stage: r.stage?.id ? r.stage : null,
    assignedUser: r.assignedUser?.id ? r.assignedUser : null,
    createdAt: r.lead.createdAt,
  }));
}

/**
 * Associates or removes a contact from a company, optionally setting primary contact status.
 */
export async function setContactCompany(
  organizationId: string,
  contactId: string,
  companyId: string | null,
  isPrimaryContact: boolean = false,
  dbInstance: DbClient = db as DbClient
) {
  const [contact] = await dbInstance
    .select({ id: contacts.id })
    .from(contacts)
    .where(
      and(
        eq(contacts.organizationId, organizationId),
        eq(contacts.id, contactId)
      )
    )
    .limit(1);

  if (!contact) {
    throw new NotFoundError("Contact not found in this organization.");
  }

  if (companyId) {
    await validateCompanyForOrganization(organizationId, companyId, dbInstance);
    if (isPrimaryContact) {
      await dbInstance
        .update(contacts)
        .set({ isPrimaryContact: false })
        .where(
          and(
            eq(contacts.organizationId, organizationId),
            eq(contacts.companyId, companyId),
            eq(contacts.isPrimaryContact, true),
            ne(contacts.id, contactId)
          )
        );
    }
    await dbInstance
      .update(contacts)
      .set({
        companyId,
        isPrimaryContact,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(contacts.organizationId, organizationId),
          eq(contacts.id, contactId)
        )
      );
  } else {
    await dbInstance
      .update(contacts)
      .set({
        companyId: null,
        isPrimaryContact: false,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(contacts.organizationId, organizationId),
          eq(contacts.id, contactId)
        )
      );
  }
}

/**
 * Sets a specific contact as the primary contact for a company.
 */
export async function setPrimaryContact(
  organizationId: string,
  companyId: string,
  contactId: string,
  dbInstance: DbClient = db as DbClient
) {
  await validateCompanyForOrganization(organizationId, companyId, dbInstance);

  const [contact] = await dbInstance
    .select({ id: contacts.id })
    .from(contacts)
    .where(
      and(
        eq(contacts.organizationId, organizationId),
        eq(contacts.id, contactId),
        eq(contacts.companyId, companyId)
      )
    )
    .limit(1);

  if (!contact) {
    throw new ValidationError("Contact does not belong to this company.");
  }

  // Reset other primary contacts for this company
  await dbInstance
    .update(contacts)
    .set({ isPrimaryContact: false })
    .where(
      and(
        eq(contacts.organizationId, organizationId),
        eq(contacts.companyId, companyId),
        eq(contacts.isPrimaryContact, true),
        ne(contacts.id, contactId)
      )
    );

  await dbInstance
    .update(contacts)
    .set({
      isPrimaryContact: true,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(contacts.organizationId, organizationId),
        eq(contacts.id, contactId)
      )
    );
}

/**
 * Removes a contact from its associated company.
 */
export async function removeContactFromCompany(
  organizationId: string,
  contactId: string,
  dbInstance: DbClient = db as DbClient
) {
  await setContactCompany(organizationId, contactId, null, false, dbInstance);
}

/**
 * Associates or removes a lead from a company.
 */
export async function setLeadCompany(
  organizationId: string,
  leadId: string,
  companyId: string | null,
  dbInstance: DbClient = db as DbClient
) {
  const [lead] = await dbInstance
    .select({ id: leads.id })
    .from(leads)
    .where(
      and(
        eq(leads.organizationId, organizationId),
        eq(leads.id, leadId)
      )
    )
    .limit(1);

  if (!lead) {
    throw new NotFoundError("Lead not found in this organization.");
  }

  if (companyId) {
    await validateCompanyForOrganization(organizationId, companyId, dbInstance);
    await dbInstance
      .update(leads)
      .set({
        companyId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(leads.organizationId, organizationId),
          eq(leads.id, leadId)
        )
      );
  } else {
    await dbInstance
      .update(leads)
      .set({
        companyId: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(leads.organizationId, organizationId),
          eq(leads.id, leadId)
        )
      );
  }
}

/**
 * Removes a lead from its associated company.
 */
export async function removeLeadFromCompany(
  organizationId: string,
  leadId: string,
  dbInstance: DbClient = db as DbClient
) {
  await setLeadCompany(organizationId, leadId, null, dbInstance);
}
