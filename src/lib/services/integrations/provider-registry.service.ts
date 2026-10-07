import crypto from "crypto";
import { db } from "@/db";
import { DbClient } from "@/db/types";
import {
  integrationProviders,
} from "@/db/schema/integrations";
import {
  CreateIntegrationProviderInput,
  UpdateIntegrationProviderInput,
} from "@/lib/validations/integrations";
import { IntegrationProviderItem } from "@/lib/types/integrations";
import { eq, and } from "drizzle-orm";
import { ConflictError, NotFoundError } from "@/lib/errors";

/**
 * Registers a new integration provider in the system registry.
 */
export async function registerProvider(
  input: CreateIntegrationProviderInput,
  dbInstance: DbClient = db as DbClient
): Promise<IntegrationProviderItem> {
  const [existing] = await dbInstance
    .select({ id: integrationProviders.id })
    .from(integrationProviders)
    .where(eq(integrationProviders.key, input.key))
    .limit(1);

  if (existing) {
    throw new ConflictError(
      `Integration provider with key '${input.key}' already exists.`
    );
  }

  const id = crypto.randomUUID();

  const [created] = await dbInstance
    .insert(integrationProviders)
    .values({
      id,
      key: input.key,
      name: input.name,
      description: input.description ?? null,
      category: input.category,
      authType: input.authType,
      capabilities: input.capabilities,
      status: input.status,
      configSchema: input.configSchema ?? null,
    })
    .returning();

  return {
    id: created.id,
    key: created.key,
    name: created.name,
    description: created.description,
    category: created.category,
    authType: created.authType,
    capabilities: created.capabilities,
    status: created.status,
    configSchema: created.configSchema,
    createdAt: created.createdAt,
    updatedAt: created.updatedAt,
  };
}

/**
 * Retrieves all registered providers, optionally filtered by category or status.
 */
export async function getProviders(
  filter: { category?: string; status?: string } = {},
  dbInstance: DbClient = db as DbClient
): Promise<IntegrationProviderItem[]> {
  const conditions = [];

  if (filter.category) {
    conditions.push(eq(integrationProviders.category, filter.category));
  }
  if (filter.status) {
    conditions.push(eq(integrationProviders.status, filter.status));
  }

  const query = dbInstance.select().from(integrationProviders);
  const rows =
    conditions.length > 0
      ? await query.where(and(...conditions)).orderBy(integrationProviders.name)
      : await query.orderBy(integrationProviders.name);

  return rows.map((r) => ({
    id: r.id,
    key: r.key,
    name: r.name,
    description: r.description,
    category: r.category,
    authType: r.authType,
    capabilities: r.capabilities,
    status: r.status,
    configSchema: r.configSchema,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
}

/**
 * Retrieves a single provider by ID.
 */
export async function getProviderById(
  id: string,
  dbInstance: DbClient = db as DbClient
): Promise<IntegrationProviderItem> {
  const [provider] = await dbInstance
    .select()
    .from(integrationProviders)
    .where(eq(integrationProviders.id, id))
    .limit(1);

  if (!provider) {
    throw new NotFoundError(`Integration provider '${id}' not found.`);
  }

  return {
    id: provider.id,
    key: provider.key,
    name: provider.name,
    description: provider.description,
    category: provider.category,
    authType: provider.authType,
    capabilities: provider.capabilities,
    status: provider.status,
    configSchema: provider.configSchema,
    createdAt: provider.createdAt,
    updatedAt: provider.updatedAt,
  };
}

/**
 * Retrieves a single provider by unique key.
 */
export async function getProviderByKey(
  key: string,
  dbInstance: DbClient = db as DbClient
): Promise<IntegrationProviderItem | null> {
  const [provider] = await dbInstance
    .select()
    .from(integrationProviders)
    .where(eq(integrationProviders.key, key))
    .limit(1);

  if (!provider) return null;

  return {
    id: provider.id,
    key: provider.key,
    name: provider.name,
    description: provider.description,
    category: provider.category,
    authType: provider.authType,
    capabilities: provider.capabilities,
    status: provider.status,
    configSchema: provider.configSchema,
    createdAt: provider.createdAt,
    updatedAt: provider.updatedAt,
  };
}

/**
 * Updates an integration provider's configuration or status.
 */
export async function updateProvider(
  id: string,
  input: UpdateIntegrationProviderInput,
  dbInstance: DbClient = db as DbClient
): Promise<IntegrationProviderItem> {
  await getProviderById(id, dbInstance);

  const [updated] = await dbInstance
    .update(integrationProviders)
    .set({
      ...(input.name !== undefined && { name: input.name }),
      ...(input.description !== undefined && {
        description: input.description,
      }),
      ...(input.category !== undefined && { category: input.category }),
      ...(input.authType !== undefined && { authType: input.authType }),
      ...(input.capabilities !== undefined && {
        capabilities: input.capabilities,
      }),
      ...(input.status !== undefined && { status: input.status }),
      ...(input.configSchema !== undefined && {
        configSchema: input.configSchema,
      }),
      updatedAt: new Date(),
    })
    .where(eq(integrationProviders.id, id))
    .returning();

  return {
    id: updated.id,
    key: updated.key,
    name: updated.name,
    description: updated.description,
    category: updated.category,
    authType: updated.authType,
    capabilities: updated.capabilities,
    status: updated.status,
    configSchema: updated.configSchema,
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt,
  };
}
