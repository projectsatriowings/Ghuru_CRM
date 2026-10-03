import { db } from "@/db";
import { DbClient } from "@/db/types";
import { contacts } from "@/db/schema/contacts";
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

  return getContactById(organizationId, contactId, dbInstance);
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

  // Data query with left join on users for owner details
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
    .where(and(...conditions))
    .orderBy(orderClause)
    .limit(validated.pageSize)
    .offset((validated.page - 1) * validated.pageSize);

  const data: ContactWithRelations[] = rows.map((r) => ({
    ...r.contact,
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
 * Retrieves a single contact by ID, including owner and custom field values.
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
    })
    .from(contacts)
    .leftJoin(users, eq(contacts.ownerUserId, users.id))
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
  await getContactById(organizationId, contactId, dbInstance);

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

  return getContactById(organizationId, contactId, dbInstance);
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
