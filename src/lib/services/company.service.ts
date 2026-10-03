import { db } from "@/db";
import { DbClient } from "@/db/types";
import { companies } from "@/db/schema/companies";
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
} from "@/lib/types/companies";
import {
  getCustomFields,
  setCustomFieldValue,
  getCustomFieldValuesForEntity,
} from "@/lib/services/custom-field.service";
import { validateCustomFieldValue } from "@/lib/validations/custom-field";
import { NotFoundError, ValidationError } from "@/lib/errors";

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

  return getCompanyById(organizationId, companyId, dbInstance);
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

  return {
    ...row.company,
    ownerUser: row.ownerUser?.id ? row.ownerUser : null,
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
  await getCompanyById(organizationId, companyId, dbInstance);

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

  return getCompanyById(organizationId, companyId, dbInstance);
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
