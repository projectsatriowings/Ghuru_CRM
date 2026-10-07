import crypto from "crypto";
import { db } from "@/db";
import { DbClient } from "@/db/types";
import {
  organizationIntegrations,
  integrationProviders,
  integrationOAuthStates,
} from "@/db/schema/integrations";
import { connectorRegistry } from "@/lib/integrations/connectors/connector-registry";
import {
  setIntegrationCredentials,
  getDecryptedCredentials,
} from "./credential.service";
import { IntegrationError } from "./integration-errors";
import { eq, and } from "drizzle-orm";
import { NotFoundError, ValidationError } from "@/lib/errors";

const OAUTH_STATE_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes

export interface InitiateOAuthFlowResult {
  authorizationUrl: string;
  state: string;
  expiresAt: Date;
}

export interface HandleOAuthCallbackInput {
  state: string;
  code: string;
  redirectUri?: string;
}

export interface HandleOAuthCallbackResult {
  success: boolean;
  organizationId: string;
  integrationId: string;
  providerKey: string;
  message: string;
}

/**
 * Initiates an OAuth2 connection flow for an organization integration.
 * Generates cryptographically secure, tenant-bound state with 15-minute expiration.
 */
export async function initiateOAuthFlow(
  organizationId: string,
  integrationId: string,
  redirectUri: string,
  dbInstance: DbClient = db as DbClient
): Promise<InitiateOAuthFlowResult> {
  // 1. Resolve integration and provider
  const [row] = await dbInstance
    .select({
      id: organizationIntegrations.id,
      organizationId: organizationIntegrations.organizationId,
      status: organizationIntegrations.status,
      config: organizationIntegrations.config,
      providerId: organizationIntegrations.providerId,
      providerKey: integrationProviders.key,
      providerName: integrationProviders.name,
      authType: integrationProviders.authType,
      capabilities: integrationProviders.capabilities,
    })
    .from(organizationIntegrations)
    .innerJoin(
      integrationProviders,
      eq(organizationIntegrations.providerId, integrationProviders.id)
    )
    .where(
      and(
        eq(organizationIntegrations.id, integrationId),
        eq(organizationIntegrations.organizationId, organizationId)
      )
    )
    .limit(1);

  if (!row) {
    throw new NotFoundError(
      `Integration '${integrationId}' not found in organization.`
    );
  }

  // 2. Validate provider supports OAuth
  const capabilities = (row.capabilities as string[]) || [];
  if (row.authType !== "oauth2" && !capabilities.includes("oauth")) {
    throw new ValidationError(
      `Provider '${row.providerName}' does not support OAuth authentication.`
    );
  }

  // 3. Resolve connector
  const connector = connectorRegistry.get(row.providerKey);
  if (!connector || !connector.buildAuthorizationUrl) {
    throw new IntegrationError(
      "UNSUPPORTED_CAPABILITY",
      `Connector for '${row.providerKey}' does not implement OAuth authorization URL generation.`,
      { providerKey: row.providerKey, statusCode: 501 }
    );
  }

  // 4. Generate cryptographically random state
  const rawState = crypto.randomBytes(32).toString("hex");
  const stateId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + OAUTH_STATE_EXPIRY_MS);

  // 5. Retrieve existing client credentials if stored
  const rawCreds = await getDecryptedCredentials(
    organizationId,
    integrationId,
    dbInstance
  );

  let credentialsObj: Record<string, string> = {};
  if (rawCreds) {
    try {
      credentialsObj = JSON.parse(rawCreds);
    } catch {
      credentialsObj = { secret: rawCreds };
    }
  }

  // 6. Build authorization URL via connector
  const authUrlResult = await connector.buildAuthorizationUrl({
    state: rawState,
    redirectUri,
    config: row.config as Record<string, unknown>,
    credentials: credentialsObj,
  });

  // 7. Persist OAuth state in DB (tenant-bound, single-use, expiring)
  await dbInstance.insert(integrationOAuthStates).values({
    id: stateId,
    organizationId,
    integrationId,
    providerKey: row.providerKey,
    state: rawState,
    redirectUri,
    codeVerifier: authUrlResult.codeVerifier || null,
    expiresAt,
  });

  return {
    authorizationUrl: authUrlResult.authorizationUrl,
    state: rawState,
    expiresAt,
  };
}

/**
 * Handles the OAuth2 redirect callback.
 * Validates state single-use and expiration, exchanges code via connector,
 * and securely encrypts access/refresh tokens in integration_credentials.
 */
export async function handleOAuthCallback(
  input: HandleOAuthCallbackInput,
  dbInstance: DbClient = db as DbClient
): Promise<HandleOAuthCallbackResult> {
  if (!input.state || !input.code) {
    throw new ValidationError("Both 'state' and 'code' query parameters are required.");
  }

  // 1. Look up state record
  const [stateRecord] = await dbInstance
    .select()
    .from(integrationOAuthStates)
    .where(eq(integrationOAuthStates.state, input.state))
    .limit(1);

  if (!stateRecord) {
    throw new IntegrationError(
      "AUTHORIZATION_FAILED",
      "Invalid or unknown OAuth state parameter. Possible CSRF attempt.",
      { statusCode: 403 }
    );
  }

  // 2. Enforce single-use
  if (stateRecord.usedAt !== null) {
    throw new IntegrationError(
      "AUTHORIZATION_FAILED",
      "OAuth state parameter has already been used. Replay attempt detected.",
      { statusCode: 403 }
    );
  }

  // 3. Enforce expiration
  const now = new Date();
  if (stateRecord.expiresAt < now) {
    throw new IntegrationError(
      "AUTHORIZATION_FAILED",
      "OAuth state parameter has expired. Please initiate authentication again.",
      { statusCode: 403 }
    );
  }

  // 4. Mark state used immediately
  await dbInstance
    .update(integrationOAuthStates)
    .set({ usedAt: now })
    .where(eq(integrationOAuthStates.id, stateRecord.id));

  const { organizationId, integrationId, providerKey } = stateRecord;

  // 5. Resolve connector
  const connector = connectorRegistry.get(providerKey);
  if (!connector || !connector.exchangeOAuthCode) {
    throw new IntegrationError(
      "UNSUPPORTED_CAPABILITY",
      `Connector for '${providerKey}' does not implement OAuth code exchange.`,
      { providerKey, statusCode: 501 }
    );
  }

  // 6. Retrieve integration config & credentials
  const [integration] = await dbInstance
    .select()
    .from(organizationIntegrations)
    .where(
      and(
        eq(organizationIntegrations.id, integrationId),
        eq(organizationIntegrations.organizationId, organizationId)
      )
    )
    .limit(1);

  if (!integration) {
    throw new NotFoundError("Associated organization integration no longer exists.");
  }

  const existingCredentials = await getDecryptedCredentials(
    organizationId,
    integrationId,
    dbInstance
  );

  let credentialsObj: Record<string, string> = {};
  if (existingCredentials) {
    try {
      credentialsObj = JSON.parse(existingCredentials);
    } catch {
      credentialsObj = { secret: existingCredentials };
    }
  }

  // 7. Exchange code for tokens via connector
  let tokenResult;
  try {
    tokenResult = await connector.exchangeOAuthCode({
      code: input.code,
      state: input.state,
      redirectUri: input.redirectUri || stateRecord.redirectUri || undefined,
      codeVerifier: stateRecord.codeVerifier || undefined,
      config: integration.config as Record<string, unknown>,
      credentials: credentialsObj,
    });
  } catch (exchangeErr: unknown) {
    const errMessage =
      exchangeErr instanceof Error
        ? exchangeErr.message
        : "Failed to exchange authorization code with provider.";

    await dbInstance
      .update(organizationIntegrations)
      .set({
        status: "error",
        lastErrorAt: now,
        lastErrorCode: "OAUTH_EXCHANGE_FAILED",
        lastErrorMessage: errMessage,
        updatedAt: now,
      })
      .where(eq(organizationIntegrations.id, integrationId));

    throw new IntegrationError("AUTHENTICATION_FAILED", errMessage, {
      providerKey,
      statusCode: 401,
    });
  }

  // 8. Safely encrypt OAuth tokens at rest
  const tokenPayload = JSON.stringify({
    accessToken: tokenResult.accessToken,
    refreshToken: tokenResult.refreshToken || null,
    tokenType: tokenResult.tokenType || "Bearer",
    expiresIn: tokenResult.expiresIn || null,
    scope: tokenResult.scope || null,
    obtainedAt: now.toISOString(),
  });

  await setIntegrationCredentials(
    organizationId,
    integrationId,
    "oauth_tokens",
    tokenPayload,
    dbInstance
  );

  // 9. Update integration to connected
  await dbInstance
    .update(organizationIntegrations)
    .set({
      status: "connected",
      lastSuccessAt: now,
      lastErrorAt: null,
      lastErrorCode: null,
      lastErrorMessage: null,
      updatedAt: now,
    })
    .where(eq(organizationIntegrations.id, integrationId));

  return {
    success: true,
    organizationId,
    integrationId,
    providerKey,
    message: "OAuth connection established successfully.",
  };
}
