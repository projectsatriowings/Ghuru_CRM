import crypto from "crypto";
import { db } from "@/db";
import { DbClient } from "@/db/types";
import { apiKeys } from "@/db/schema/integrations";
import {
  CreateApiKeyInput,
} from "@/lib/validations/integrations";
import {
  ApiKeyItem,
  CreatedApiKeyResult,
  ApiKeyAuthContext,
  ApiKeyScope,
} from "@/lib/types/integrations";
import { eq, and, isNull, desc } from "drizzle-orm";
import {
  NotFoundError,
  UnauthorizedError,
} from "@/lib/errors";

const API_KEY_PREFIX = "ghk_live_";

/**
 * Computes a secure SHA-256 hash of an API key secret.
 */
export function hashApiKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

/**
 * Creates a new organization API key.
 * The full secret is returned ONLY ONCE in the response.
 * Only the SHA-256 hash and safe key prefix are persisted.
 */
export async function createApiKey(
  organizationId: string,
  userId: string | null,
  input: CreateApiKeyInput,
  dbInstance: DbClient = db as DbClient
): Promise<CreatedApiKeyResult> {
  const randomHex = crypto.randomBytes(24).toString("hex");
  const fullKey = `${API_KEY_PREFIX}${randomHex}`;
  const keyPrefix = `${API_KEY_PREFIX}${randomHex.slice(0, 4)}...${randomHex.slice(-4)}`;
  const keyHash = hashApiKey(fullKey);

  const expiresAt = input.expiresInDays
    ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
    : null;

  const id = crypto.randomUUID();

  const [created] = await dbInstance
    .insert(apiKeys)
    .values({
      id,
      organizationId,
      name: input.name,
      keyPrefix,
      keyHash,
      scopes: input.scopes,
      createdById: userId,
      expiresAt,
    })
    .returning();

  const keyItem: ApiKeyItem = {
    id: created.id,
    organizationId: created.organizationId,
    name: created.name,
    keyPrefix: created.keyPrefix,
    scopes: created.scopes,
    createdById: created.createdById,
    lastUsedAt: created.lastUsedAt,
    expiresAt: created.expiresAt,
    revokedAt: created.revokedAt,
    createdAt: created.createdAt,
    updatedAt: created.updatedAt,
  };

  return {
    key: keyItem,
    secret: fullKey, // Revealed ONCE
  };
}

/**
 * Lists API keys for an organization.
 * Strict tenant isolation enforced. Plaintext secrets and hashes are NEVER returned.
 */
export async function getOrganizationApiKeys(
  organizationId: string,
  options: { includeRevoked?: boolean } = {},
  dbInstance: DbClient = db as DbClient
): Promise<ApiKeyItem[]> {
  const conditions = [eq(apiKeys.organizationId, organizationId)];

  if (!options.includeRevoked) {
    conditions.push(isNull(apiKeys.revokedAt));
  }

  const rows = await dbInstance
    .select({
      id: apiKeys.id,
      organizationId: apiKeys.organizationId,
      name: apiKeys.name,
      keyPrefix: apiKeys.keyPrefix,
      scopes: apiKeys.scopes,
      createdById: apiKeys.createdById,
      lastUsedAt: apiKeys.lastUsedAt,
      expiresAt: apiKeys.expiresAt,
      revokedAt: apiKeys.revokedAt,
      createdAt: apiKeys.createdAt,
      updatedAt: apiKeys.updatedAt,
    })
    .from(apiKeys)
    .where(and(...conditions))
    .orderBy(desc(apiKeys.createdAt));

  return rows.map((r) => ({
    id: r.id,
    organizationId: r.organizationId,
    name: r.name,
    keyPrefix: r.keyPrefix,
    scopes: r.scopes,
    createdById: r.createdById,
    lastUsedAt: r.lastUsedAt,
    expiresAt: r.expiresAt,
    revokedAt: r.revokedAt,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
}

/**
 * Retrieves a single API key by ID within the organization.
 */
export async function getApiKeyById(
  organizationId: string,
  id: string,
  dbInstance: DbClient = db as DbClient
): Promise<ApiKeyItem> {
  const [row] = await dbInstance
    .select({
      id: apiKeys.id,
      organizationId: apiKeys.organizationId,
      name: apiKeys.name,
      keyPrefix: apiKeys.keyPrefix,
      scopes: apiKeys.scopes,
      createdById: apiKeys.createdById,
      lastUsedAt: apiKeys.lastUsedAt,
      expiresAt: apiKeys.expiresAt,
      revokedAt: apiKeys.revokedAt,
      createdAt: apiKeys.createdAt,
      updatedAt: apiKeys.updatedAt,
    })
    .from(apiKeys)
    .where(
      and(eq(apiKeys.id, id), eq(apiKeys.organizationId, organizationId))
    )
    .limit(1);

  if (!row) {
    throw new NotFoundError(
      `API key '${id}' not found in this organization.`
    );
  }

  return {
    id: row.id,
    organizationId: row.organizationId,
    name: row.name,
    keyPrefix: row.keyPrefix,
    scopes: row.scopes,
    createdById: row.createdById,
    lastUsedAt: row.lastUsedAt,
    expiresAt: row.expiresAt,
    revokedAt: row.revokedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Revokes an API key. Revocation is permanent and renders the key inactive.
 */
export async function revokeApiKey(
  organizationId: string,
  id: string,
  dbInstance: DbClient = db as DbClient
): Promise<ApiKeyItem> {
  const current = await getApiKeyById(organizationId, id, dbInstance);

  if (current.revokedAt) {
    return current; // already revoked
  }

  const revokedAt = new Date();

  await dbInstance
    .update(apiKeys)
    .set({
      revokedAt,
      updatedAt: revokedAt,
    })
    .where(
      and(eq(apiKeys.id, id), eq(apiKeys.organizationId, organizationId))
    );

  return {
    ...current,
    revokedAt,
    updatedAt: revokedAt,
  };
}

/**
 * Authenticates an incoming API key string (e.g. from Authorization or x-api-key header).
 * Enforces hash matching, revocation status, expiration, and updates lastUsedAt asynchronously.
 */
export async function authenticateApiKey(
  rawKey: string,
  dbInstance: DbClient = db as DbClient
): Promise<ApiKeyAuthContext> {
  if (!rawKey || typeof rawKey !== "string") {
    throw new UnauthorizedError("API key is missing.");
  }

  const trimmed = rawKey.trim();
  const token = trimmed.startsWith("Bearer ")
    ? trimmed.slice(7).trim()
    : trimmed;

  if (!token.startsWith(API_KEY_PREFIX)) {
    throw new UnauthorizedError("Invalid API key format.");
  }

  const hash = hashApiKey(token);

  const [keyRecord] = await dbInstance
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.keyHash, hash))
    .limit(1);

  if (!keyRecord) {
    throw new UnauthorizedError("API key is invalid.");
  }

  if (keyRecord.revokedAt) {
    throw new UnauthorizedError("API key has been revoked.");
  }

  if (keyRecord.expiresAt && keyRecord.expiresAt.getTime() < Date.now()) {
    throw new UnauthorizedError("API key has expired.");
  }

  // Update lastUsedAt asynchronously without blocking
  void dbInstance
    .update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, keyRecord.id))
    .catch((err) => {
      console.error("[ApiKeyService] Failed to update lastUsedAt:", err);
    });

  const scopeSet = new Set(keyRecord.scopes);

  return {
    isApiKey: true,
    apiKeyId: keyRecord.id,
    organizationId: keyRecord.organizationId,
    name: keyRecord.name,
    scopes: keyRecord.scopes,
    hasScope: (scope: ApiKeyScope | string) =>
      scopeSet.has(scope) || scopeSet.has("*"),
  };
}
