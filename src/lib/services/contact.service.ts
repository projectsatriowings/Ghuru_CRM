import { db } from "@/db";
import { DbClient } from "@/db/types";
import { contacts } from "@/db/schema/contacts";
import { users } from "@/db/schema/users";
import { organizationMembers } from "@/db/schema/organizations";
import { companies } from "@/db/schema/companies";
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
  createContactSchema,
  updateContactSchema,
  contactQuerySchema,
  type CreateContactInput,
  type UpdateContactInput,
  type ContactQueryInput,
} from "@/lib/validations/contact";
import {
  type ContactWithRelations,
  type PaginatedContactsResult,
} from "@/lib/types/contacts";
import {
  getCustomFields,
  setCustomFieldValue,
  getCustomFieldValuesForEntity,
} from "@/lib/services/custom-field.service";
import { validateCustomFieldValue } from "@/lib/validations/custom-field";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { emitAutomationEvent } from "@/lib/automation/automation-engine";

/**
 * Validates that a company belongs to the organization and is not archived.
 */
export async function validateActiveCompany(
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
    throw new ValidationError("Selected company was not found in this organization.");
  }

  if (comp.archivedAt !== null) {
    throw new ValidationError("Archived companies cannot be assigned.");
  }

  return comp;
}

/**
 * Creates a new Contact for an organization.
 */
export async function createContact(
  organizationId: string,
  input: CreateContactInput,
  dbInstance: DbClient = db as DbClient
): Promise<ContactWithRelations> {
  const validated = createContactSchema.parse(input);

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

  // 1b. Validate company relationship and primary contact status (if provided)
  let resolvedCompanyId: string | null = null;
  let isPrimary = false;

  if (validated.companyId && validated.companyId.trim() !== "") {
    await validateActiveCompany(
      organizationId,
      validated.companyId.trim(),
      dbInstance
    );
    resolvedCompanyId = validated.companyId.trim();

    if (validated.isPrimaryContact) {
      // Clear existing primary contact for this company in this organization
      await dbInstance
        .update(contacts)
        .set({ isPrimaryContact: false })
        .where(
          and(
            eq(contacts.organizationId, organizationId),
            eq(contacts.companyId, resolvedCompanyId),
            eq(contacts.isPrimaryContact, true)
          )
        );
      isPrimary = true;
    }
  }

  // 2. Fetch active custom field definitions for 'contact'
  const activeFields = await getCustomFields(
    organizationId,
    { entityType: "contact", active: true },
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

  // 3. Insert Contact record
  const contactId = crypto.randomUUID();

  await dbInstance.insert(contacts).values({
    id: contactId,
    organizationId,
    companyId: resolvedCompanyId,
    isPrimaryContact: isPrimary,
    firstName: validated.firstName,
    lastName: validated.lastName ? validated.lastName.trim() : null,
    email: validated.email ? validated.email.trim() : null,
    phone: validated.phone ? validated.phone.trim() : null,
    ownerUserId: ownerId,
    notes: validated.notes ? validated.notes.trim() : null,
  });

  // 4. Save validated custom field values
  for (const item of validatedCustomFields) {
    await setCustomFieldValue(
      organizationId,
      "contact",
      contactId,
      item.fieldDefId,
      item.normalizedValue,
      dbInstance
    );
  }

  const createdContact = await getContactById(
    organizationId,
    contactId,
    dbInstance
  );

  try {
    await emitAutomationEvent(
      {
        organizationId,
        entityType: "contact",
        entityId: contactId,
        eventType: "entity_created",
        payload: { current: createdContact },
      },
      undefined,
      dbInstance
    );
  } catch (err) {
    console.error("[ContactService] Error emitting entity_created event:", err);
  }

  return createdContact;
}

/**
 * Retrieves contacts for an organization with filtering, search, sorting, and pagination.
 */
export async function getContacts(
  organizationId: string,
  queryParams?: ContactQueryInput,
  dbInstance: DbClient = db as DbClient
): Promise<PaginatedContactsResult> {
  const validated = contactQuerySchema.parse(queryParams || {});

  const conditions = [eq(contacts.organizationId, organizationId)];

  // Archived filter
  if (validated.archived === "true") {
    conditions.push(isNotNull(contacts.archivedAt));
  } else if (validated.archived === "all") {
    // Show both active and archived
  } else {
    // Default: only active contacts
    conditions.push(isNull(contacts.archivedAt));
  }

  // Owner filter
  if (validated.ownerId && validated.ownerId !== "all") {
    if (validated.ownerId === "unassigned") {
      conditions.push(isNull(contacts.ownerUserId));
    } else {
      conditions.push(eq(contacts.ownerUserId, validated.ownerId));
    }
  }

  // Search filter (first name, last name, full name, email, phone)
  if (validated.search && validated.search.trim() !== "") {
    const term = `%${validated.search.trim()}%`;
    conditions.push(
      or(
        ilike(contacts.firstName, term),
        ilike(contacts.lastName, term),
        ilike(
          sql`coalesce(${contacts.firstName}, '') || ' ' || coalesce(${contacts.lastName}, '')`,
          term
        ),
        ilike(contacts.email, term),
        ilike(contacts.phone, term)
      )!
    );
  }

  // Count query
  const [totalRes] = await dbInstance
    .select({ total: count() })
    .from(contacts)
    .where(and(...conditions));

  const total = Number(totalRes?.total || 0);
  const totalPages = Math.ceil(total / validated.pageSize) || 1;

  // Sorting
  const sortCol =
    validated.sort === "updatedAt"
      ? contacts.updatedAt
      : validated.sort === "firstName"
      ? contacts.firstName
      : validated.sort === "lastName"
      ? contacts.lastName
      : contacts.createdAt;

  const orderClause =
    validated.sortDirection === "asc" ? asc(sortCol) : desc(sortCol);

  // Data query with left join on users and companies
  const rows = await dbInstance
    .select({
      contact: contacts,
      ownerUser: {
        id: users.id,
        name: users.name,
        email: users.email,
        image: users.image,
      },
      company: {
        id: companies.id,
        name: companies.name,
      },
    })
    .from(contacts)
    .leftJoin(users, eq(contacts.ownerUserId, users.id))
    .leftJoin(companies, eq(contacts.companyId, companies.id))
    .where(and(...conditions))
    .orderBy(orderClause)
    .limit(validated.pageSize)
    .offset((validated.page - 1) * validated.pageSize);

  const data: ContactWithRelations[] = rows.map((r) => ({
    ...r.contact,
    ownerUser: r.ownerUser?.id ? r.ownerUser : null,
    company: r.company?.id ? r.company : null,
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
 * Retrieves a single contact by ID, including owner, company, and custom field values.
 */
export async function getContactById(
  organizationId: string,
  contactId: string,
  dbInstance: DbClient = db as DbClient
): Promise<ContactWithRelations> {
  const [row] = await dbInstance
    .select({
      contact: contacts,
      ownerUser: {
        id: users.id,
        name: users.name,
        email: users.email,
        image: users.image,
      },
      company: {
        id: companies.id,
        name: companies.name,
      },
    })
    .from(contacts)
    .leftJoin(users, eq(contacts.ownerUserId, users.id))
    .leftJoin(companies, eq(contacts.companyId, companies.id))
    .where(
      and(
        eq(contacts.organizationId, organizationId),
        eq(contacts.id, contactId)
      )
    )
    .limit(1);

  if (!row) {
    throw new NotFoundError("Contact not found.");
  }

  // Fetch custom field values polymorphic to contact
  const customFieldEntries = await getCustomFieldValuesForEntity(
    organizationId,
    "contact",
    contactId,
    dbInstance
  );

  const customFields: Record<string, unknown> = {};
  for (const entry of customFieldEntries) {
    customFields[entry.field.key] = entry.value;
  }

  return {
    ...row.contact,
    ownerUser: row.ownerUser?.id ? row.ownerUser : null,
    company: row.company?.id ? row.company : null,
    customFields,
    customFieldValues: customFieldEntries,
  };
}

/**
 * Updates an existing contact's standard fields and custom field values.
 */
export async function updateContact(
  organizationId: string,
  contactId: string,
  input: UpdateContactInput,
  dbInstance: DbClient = db as DbClient
): Promise<ContactWithRelations> {
  // 1. Ensure contact exists in this organization
  const existingContact = await getContactById(
    organizationId,
    contactId,
    dbInstance
  );

  const validated = updateContactSchema.parse(input);

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

  // 2b. Handle companyId and isPrimaryContact changes
  let updatedCompanyId: string | null | undefined = undefined;
  let updatedIsPrimary: boolean | undefined = undefined;

  if (validated.companyId !== undefined) {
    if (validated.companyId && validated.companyId.trim() !== "") {
      const cid = validated.companyId.trim();
      await validateActiveCompany(organizationId, cid, dbInstance);
      updatedCompanyId = cid;
    } else {
      updatedCompanyId = null;
      updatedIsPrimary = false; // removing company automatically removes primary status
    }
  }

  const effectiveCompanyId =
    updatedCompanyId !== undefined
      ? updatedCompanyId
      : existingContact.companyId;

  if (validated.isPrimaryContact !== undefined) {
    if (validated.isPrimaryContact) {
      if (!effectiveCompanyId) {
        throw new ValidationError(
          "Primary contact requires a company to be assigned."
        );
      }
      // Unset previous primary contact for this company in this organization
      await dbInstance
        .update(contacts)
        .set({ isPrimaryContact: false })
        .where(
          and(
            eq(contacts.organizationId, organizationId),
            eq(contacts.companyId, effectiveCompanyId),
            eq(contacts.isPrimaryContact, true),
            ne(contacts.id, contactId)
          )
        );
      updatedIsPrimary = true;
    } else {
      updatedIsPrimary = false;
    }
  } else if (
    updatedCompanyId !== undefined &&
    updatedCompanyId !== existingContact.companyId &&
    updatedCompanyId === null
  ) {
    updatedIsPrimary = false;
  }

  // 3. Validate and update custom fields (if provided)
  if (validated.customFields) {
    const activeFields = await getCustomFields(
      organizationId,
      { entityType: "contact" },
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
        "contact",
        contactId,
        fieldDef.id,
        validation.normalizedValue,
        dbInstance
      );
    }
  }

  // 4. Update contact standard fields
  await dbInstance
    .update(contacts)
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
      ...(ownerId !== undefined ? { ownerUserId: ownerId } : {}),
      ...(updatedCompanyId !== undefined ? { companyId: updatedCompanyId } : {}),
      ...(updatedIsPrimary !== undefined
        ? { isPrimaryContact: updatedIsPrimary }
        : {}),
      ...(validated.notes !== undefined
        ? { notes: validated.notes ? validated.notes.trim() : null }
        : {}),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(contacts.organizationId, organizationId),
        eq(contacts.id, contactId)
      )
    );

  const updatedContact = await getContactById(
    organizationId,
    contactId,
    dbInstance
  );

  try {
    if (existingContact.ownerUserId !== updatedContact.ownerUserId) {
      await emitAutomationEvent(
        {
          organizationId,
          entityType: "contact",
          entityId: contactId,
          eventType: "entity_assigned",
          payload: {
            previous: existingContact,
            current: updatedContact,
          },
        },
        undefined,
        dbInstance
      );
    }

    await emitAutomationEvent(
      {
        organizationId,
        entityType: "contact",
        entityId: contactId,
        eventType: "entity_updated",
        payload: {
          previous: existingContact,
          current: updatedContact,
        },
      },
      undefined,
      dbInstance
    );
  } catch (err) {
    console.error(
      "[ContactService] Error emitting automation events for contact update:",
      err
    );
  }

  return updatedContact;
}

/**
 * Soft deletes / archives a contact by setting archivedAt.
 */
export async function archiveContact(
  organizationId: string,
  contactId: string,
  dbInstance: DbClient = db as DbClient
): Promise<ContactWithRelations> {
  await getContactById(organizationId, contactId, dbInstance);

  await dbInstance
    .update(contacts)
    .set({
      archivedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(contacts.organizationId, organizationId),
        eq(contacts.id, contactId)
      )
    );

  return getContactById(organizationId, contactId, dbInstance);
}

/**
 * Restores an archived contact by clearing archivedAt.
 */
export async function restoreContact(
  organizationId: string,
  contactId: string,
  dbInstance: DbClient = db as DbClient
): Promise<ContactWithRelations> {
  await getContactById(organizationId, contactId, dbInstance);

  await dbInstance
    .update(contacts)
    .set({
      archivedAt: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(contacts.organizationId, organizationId),
        eq(contacts.id, contactId)
      )
    );

  return getContactById(organizationId, contactId, dbInstance);
}

/**
 * Searches contacts by query term.
 */
export async function searchContacts(
  organizationId: string,
  search: string,
  limit: number = 10,
  dbInstance: DbClient = db as DbClient
): Promise<ContactWithRelations[]> {
  const result = await getContacts(
    organizationId,
    { search, pageSize: limit, page: 1, archived: "false" },
    dbInstance
  );
  return result.data;
}
