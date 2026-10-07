import crypto from "crypto";
import { db } from "@/db";
import { DbClient } from "@/db/types";
import {
  organizationIntegrations,
  integrationProviders,
  integrationCredentials,
  IntegrationStatus,
} from "@/db/schema/integrations";
import {
  CreateOrganizationIntegrationInput,
  UpdateOrganizationIntegrationInput,
} from "@/lib/validations/integrations";
import { OrganizationIntegrationItem } from "@/lib/types/integrations";
import {
  setIntegrationCredentials,
  deleteIntegrationCredentials,
  getDecryptedCredentials,
} from "./credential.service";
import { connectorRegistry } from "@/lib/integrations/connectors/connector-registry";
import { getProviderById } from "./provider-registry.service";
import { eq, and } from "drizzle-orm";
import { NotFoundError, ValidationError } from "@/lib/errors";

/**
 * Retrieves all integration connections for an organization.
 * Strict tenant isolation enforced.
 */
export async function getOrganizationIntegrations(
  organizationId: string,
  dbInstance: DbClient = db as DbClient
): Promise<OrganizationIntegrationItem[]> {
  const rows = await dbInstance
    .select({
      id: organizationIntegrations.id,
      organizationId: organizationIntegrations.organizationId,
      providerId: organizationIntegrations.providerId,
      providerKey: integrationProviders.key,
      providerName: integrationProviders.name,
      name: organizationIntegrations.name,
      status: organizationIntegrations.status,
      config: organizationIntegrations.config,
      connectedByUserId: organizationIntegrations.connectedByUserId,
      lastSuccessAt: organizationIntegrations.lastSuccessAt,
      lastErrorAt: organizationIntegrations.lastErrorAt,
      lastErrorCode: organizationIntegrations.lastErrorCode,
      lastErrorMessage: organizationIntegrations.lastErrorMessage,
      credentialId: integrationCredentials.id,
      createdAt: organizationIntegrations.createdAt,
      updatedAt: organizationIntegrations.updatedAt,
    })
    .from(organizationIntegrations)
    .innerJoin(
      integrationProviders,
      eq(organizationIntegrations.providerId, integrationProviders.id)
    )
    .leftJoin(
      integrationCredentials,
      and(
        eq(
          integrationCredentials.integrationId,
          organizationIntegrations.id
        ),
        eq(
          integrationCredentials.organizationId,
          organizationIntegrations.organizationId
        )
      )
    )
    .where(eq(organizationIntegrations.organizationId, organizationId))
    .orderBy(organizationIntegrations.createdAt);

  return rows.map((r) => ({
    id: r.id,
    organizationId: r.organizationId,
    providerId: r.providerId,
    providerKey: r.providerKey,
    providerName: r.providerName,
    name: r.name,
    status: r.status,
    config: r.config as Record<string, unknown>,
    connectedByUserId: r.connectedByUserId,
    lastSuccessAt: r.lastSuccessAt,
    lastErrorAt: r.lastErrorAt,
    lastErrorCode: r.lastErrorCode,
    lastErrorMessage: r.lastErrorMessage,
    hasCredentials: !!r.credentialId,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
}

/**
 * Retrieves a single organization integration connection by ID.
 * Strict tenant isolation enforced.
 */
export async function getOrganizationIntegrationById(
  organizationId: string,
  id: string,
  dbInstance: DbClient = db as DbClient
): Promise<OrganizationIntegrationItem> {
  const [row] = await dbInstance
    .select({
      id: organizationIntegrations.id,
      organizationId: organizationIntegrations.organizationId,
      providerId: organizationIntegrations.providerId,
      providerKey: integrationProviders.key,
      providerName: integrationProviders.name,
      name: organizationIntegrations.name,
      status: organizationIntegrations.status,
      config: organizationIntegrations.config,
      connectedByUserId: organizationIntegrations.connectedByUserId,
      lastSuccessAt: organizationIntegrations.lastSuccessAt,
      lastErrorAt: organizationIntegrations.lastErrorAt,
      lastErrorCode: organizationIntegrations.lastErrorCode,
      lastErrorMessage: organizationIntegrations.lastErrorMessage,
      credentialId: integrationCredentials.id,
      createdAt: organizationIntegrations.createdAt,
      updatedAt: organizationIntegrations.updatedAt,
    })
    .from(organizationIntegrations)
    .innerJoin(
      integrationProviders,
      eq(organizationIntegrations.providerId, integrationProviders.id)
    )
    .leftJoin(
      integrationCredentials,
      and(
        eq(
          integrationCredentials.integrationId,
          organizationIntegrations.id
        ),
        eq(
          integrationCredentials.organizationId,
          organizationIntegrations.organizationId
        )
      )
    )
    .where(
      and(
        eq(organizationIntegrations.id, id),
        eq(organizationIntegrations.organizationId, organizationId)
      )
    )
    .limit(1);

  if (!row) {
    throw new NotFoundError(
      `Integration connection '${id}' not found in this organization.`
    );
  }

  return {
    id: row.id,
    organizationId: row.organizationId,
    providerId: row.providerId,
    providerKey: row.providerKey,
    providerName: row.providerName,
    name: row.name,
    status: row.status,
    config: row.config as Record<string, unknown>,
    connectedByUserId: row.connectedByUserId,
    lastSuccessAt: row.lastSuccessAt,
    lastErrorAt: row.lastErrorAt,
    lastErrorCode: row.lastErrorCode,
    lastErrorMessage: row.lastErrorMessage,
    hasCredentials: !!row.credentialId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Creates a new organization integration connection.
 */
export async function createOrganizationIntegration(
  organizationId: string,
  userId: string | null,
  input: CreateOrganizationIntegrationInput,
  dbInstance: DbClient = db as DbClient
): Promise<OrganizationIntegrationItem> {
  // Validate that provider exists
  const provider = await getProviderById(input.providerId, dbInstance);

  const id = crypto.randomUUID();
  const initialStatus: IntegrationStatus = input.credentials
    ? "connected"
    : "pending";

  await dbInstance.insert(organizationIntegrations).values({
    id,
    organizationId,
    providerId: provider.id,
    name: input.name,
    status: initialStatus,
    config: input.config || {},
    connectedByUserId: userId,
  });

  if (input.credentials) {
    await setIntegrationCredentials(
      organizationId,
      id,
      input.credentials.credentialType,
      input.credentials.secret,
      dbInstance
    );
  }

  return getOrganizationIntegrationById(organizationId, id, dbInstance);
}

/**
 * Updates an organization integration connection.
 */
export async function updateOrganizationIntegration(
  organizationId: string,
  id: string,
  input: UpdateOrganizationIntegrationInput,
  dbInstance: DbClient = db as DbClient
): Promise<OrganizationIntegrationItem> {
  // Verify existence & tenant ownership
  await getOrganizationIntegrationById(organizationId, id, dbInstance);

  const updateValues: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (input.name !== undefined) updateValues.name = input.name;
  if (input.config !== undefined) updateValues.config = input.config;
  if (input.status !== undefined) updateValues.status = input.status;

  await dbInstance
    .update(organizationIntegrations)
    .set(updateValues)
    .where(
      and(
        eq(organizationIntegrations.id, id),
        eq(organizationIntegrations.organizationId, organizationId)
      )
    );

  if (input.credentials) {
    await setIntegrationCredentials(
      organizationId,
      id,
      input.credentials.credentialType,
      input.credentials.secret,
      dbInstance
    );
  }

  return getOrganizationIntegrationById(organizationId, id, dbInstance);
}

/**
 * Toggles an integration's enabled / disabled state.
 */
export async function toggleIntegrationStatus(
  organizationId: string,
  id: string,
  enabled: boolean,
  dbInstance: DbClient = db as DbClient
): Promise<OrganizationIntegrationItem> {
  const current = await getOrganizationIntegrationById(
    organizationId,
    id,
    dbInstance
  );

  const newStatus: IntegrationStatus = enabled
    ? current.hasCredentials
      ? "connected"
      : "pending"
    : "disabled";

  await dbInstance
    .update(organizationIntegrations)
    .set({
      status: newStatus,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(organizationIntegrations.id, id),
        eq(organizationIntegrations.organizationId, organizationId)
      )
    );

  return getOrganizationIntegrationById(organizationId, id, dbInstance);
}

/**
 * Disconnects an integration and clears any stored credentials.
 */
export async function disconnectOrganizationIntegration(
  organizationId: string,
  id: string,
  dbInstance: DbClient = db as DbClient
): Promise<OrganizationIntegrationItem> {
  await getOrganizationIntegrationById(organizationId, id, dbInstance);

  // Remove associated credentials
  await deleteIntegrationCredentials(organizationId, id, dbInstance);

  // Update status to disconnected
  await dbInstance
    .update(organizationIntegrations)
    .set({
      status: "disconnected",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(organizationIntegrations.id, id),
        eq(organizationIntegrations.organizationId, organizationId)
      )
    );

  return getOrganizationIntegrationById(organizationId, id, dbInstance);
}

/**
 * Tests connection readiness for an organization integration.
 * Updates lastSuccessAt or lastErrorAt accordingly.
 */
export async function testIntegrationConnection(
  organizationId: string,
  id: string,
  dbInstance: DbClient = db as DbClient
): Promise<{
  success: boolean;
  message: string;
  testedAt: Date;
}> {
  const item = await getOrganizationIntegrationById(
    organizationId,
    id,
    dbInstance
  );

  if (item.status === "disabled") {
    throw new ValidationError(
      "Cannot test a disabled integration connection. Please enable it first."
    );
  }

  // Resolve registered connector if available
  const connector = connectorRegistry.get(item.providerKey);
  let isSuccessful = true;
  let message = `Connection test passed for ${item.name} (${item.providerName}).`;
  const testedAt = new Date();

  if (connector) {
    try {
      const rawCreds = await getDecryptedCredentials(
        organizationId,
        id,
        dbInstance
      );
      let credentialsObj: Record<string, string> | undefined = undefined;
      if (rawCreds) {
        try {
          credentialsObj = JSON.parse(rawCreds);
        } catch {
          credentialsObj = { secret: rawCreds };
        }
      }
      const health = await connector.testConnection({
        organizationId,
        integrationId: id,
        config: item.config,
        credentials: credentialsObj,
        dbInstance,
      });
      isSuccessful = health.success;
      message = health.message;
    } catch (testErr: unknown) {
      isSuccessful = false;
      message =
        testErr instanceof Error ? testErr.message : "Handshake with connector failed.";
    }
  }

  if (isSuccessful) {
    await dbInstance
      .update(organizationIntegrations)
      .set({
        lastSuccessAt: testedAt,
        lastErrorAt: null,
        lastErrorCode: null,
        lastErrorMessage: null,
        updatedAt: testedAt,
      })
      .where(
        and(
          eq(organizationIntegrations.id, id),
          eq(organizationIntegrations.organizationId, organizationId)
        )
      );

    return {
      success: true,
      message,
      testedAt,
    };
  } else {
    await dbInstance
      .update(organizationIntegrations)
      .set({
        lastErrorAt: testedAt,
        lastErrorCode: "CONNECTION_FAILED",
        lastErrorMessage: message,
        updatedAt: testedAt,
      })
      .where(
        and(
          eq(organizationIntegrations.id, id),
          eq(organizationIntegrations.organizationId, organizationId)
        )
      );

    return {
      success: false,
      message,
      testedAt,
    };
  }
}
