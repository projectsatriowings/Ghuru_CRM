import { db } from "@/db";
import { DbClient } from "@/db/types";
import {
  organizationIntegrations,
  integrationProviders,
} from "@/db/schema/integrations";
import { connectorRegistry } from "@/lib/integrations/connectors/connector-registry";
import {
  OutboundApiResult,
} from "@/lib/types/connector";
import { IntegrationCapability } from "@/lib/types/integrations";
import { getDecryptedCredentials } from "./credential.service";
import { IntegrationError } from "./integration-errors";
import { eq, and } from "drizzle-orm";
import { NotFoundError, ValidationError } from "@/lib/errors";

// --- GENERIC JOB DISPATCHER ABSTRACTION ---

export interface IntegrationJob<TPayload = unknown> {
  id: string;
  type: string;
  organizationId: string;
  integrationId?: string;
  payload: TPayload;
  maxRetries?: number;
  retryDelayMs?: number;
}

export interface JobDispatchResult {
  accepted: boolean;
  jobId: string;
  mode: "in_process" | "queue";
  message?: string;
}

export interface IntegrationJobDispatcher {
  dispatch<TPayload>(
    job: IntegrationJob<TPayload>,
    handler: (job: IntegrationJob<TPayload>) => Promise<void>
  ): Promise<JobDispatchResult>;
}

/**
 * Default in-process dispatcher. Executes asynchronously without blocking caller,
 * with bounded error handling.
 */
export class InProcessJobDispatcher implements IntegrationJobDispatcher {
  public async dispatch<TPayload>(
    job: IntegrationJob<TPayload>,
    handler: (job: IntegrationJob<TPayload>) => Promise<void>
  ): Promise<JobDispatchResult> {
    // Non-blocking in-process promise dispatch
    void Promise.resolve()
      .then(async () => {
        try {
          await handler(job);
        } catch (err) {
          console.error(
            `[InProcessJobDispatcher] Job ${job.id} (${job.type}) failed:`,
            err
          );
        }
      })
      .catch((fatalErr) => {
        console.error(
          `[InProcessJobDispatcher] Fatal error processing job ${job.id}:`,
          fatalErr
        );
      });

    return {
      accepted: true,
      jobId: job.id,
      mode: "in_process",
      message: "Job dispatched asynchronously in-process.",
    };
  }
}

// Global active dispatcher instance (pluggable for future external queues)
let activeDispatcher: IntegrationJobDispatcher = new InProcessJobDispatcher();

export function setJobDispatcher(dispatcher: IntegrationJobDispatcher): void {
  activeDispatcher = dispatcher;
}

export function getJobDispatcher(): IntegrationJobDispatcher {
  return activeDispatcher;
}

// --- OUTBOUND CONNECTOR API EXECUTION ---

export interface ExecuteOutboundInput<TInput = unknown> {
  organizationId: string;
  integrationId: string;
  action: string;
  input: TInput;
  requiredCapability?: IntegrationCapability;
}

/**
 * Executes an outbound API call to a provider using its registered connector adapter.
 * Handles credential decryption, configuration resolution, timeout, and error classification.
 */
export async function executeOutboundConnectorCall<
  TInput = unknown,
  TOutput = unknown,
>(
  params: ExecuteOutboundInput<TInput>,
  dbInstance: DbClient = db as DbClient
): Promise<OutboundApiResult<TOutput>> {
  const { organizationId, integrationId, action, input, requiredCapability } =
    params;

  // 1. Resolve integration & provider
  const [row] = await dbInstance
    .select({
      id: organizationIntegrations.id,
      organizationId: organizationIntegrations.organizationId,
      status: organizationIntegrations.status,
      config: organizationIntegrations.config,
      providerId: organizationIntegrations.providerId,
      providerKey: integrationProviders.key,
      providerName: integrationProviders.name,
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

  // 2. Validate status
  if (row.status !== "connected") {
    throw new ValidationError(
      `Integration '${integrationId}' is not connected (current status: ${row.status}).`
    );
  }

  const providerKey = row.providerKey;

  // 3. Validate capability if specified
  const capabilities = (row.capabilities as string[]) || [];
  if (requiredCapability && !capabilities.includes(requiredCapability)) {
    throw new IntegrationError(
      "UNSUPPORTED_CAPABILITY",
      `Provider '${providerKey}' does not support required capability '${requiredCapability}'.`,
      { providerKey, statusCode: 400 }
    );
  }

  // 4. Resolve connector
  const connector = connectorRegistry.get(providerKey);
  if (!connector || !connector.executeOutboundApi) {
    throw new IntegrationError(
      "UNSUPPORTED_CAPABILITY",
      `No connector registered for provider '${providerKey}' implementing outbound API execution.`,
      { providerKey, statusCode: 501 }
    );
  }

  // 5. Decrypt credentials
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

  // 6. Execute outbound call via connector
  try {
    const result = await connector.executeOutboundApi<TInput, TOutput>({
      organizationId,
      integrationId,
      action,
      input,
      config: row.config as Record<string, unknown>,
      credentials: credentialsObj,
    });

    if (result.success) {
      await dbInstance
        .update(organizationIntegrations)
        .set({
          lastSuccessAt: new Date(),
          lastErrorAt: null,
          lastErrorCode: null,
          lastErrorMessage: null,
          updatedAt: new Date(),
        })
        .where(eq(organizationIntegrations.id, integrationId));
    } else {
      await dbInstance
        .update(organizationIntegrations)
        .set({
          lastErrorAt: new Date(),
          lastErrorCode: "OUTBOUND_API_ERROR",
          lastErrorMessage: result.error || "Outbound operation reported failure.",
          updatedAt: new Date(),
        })
        .where(eq(organizationIntegrations.id, integrationId));
    }

    return result;
  } catch (err: unknown) {
    const now = new Date();
    const errMsg =
      err instanceof Error ? err.message : "Outbound API execution failed.";

    await dbInstance
      .update(organizationIntegrations)
      .set({
        lastErrorAt: now,
        lastErrorCode: "OUTBOUND_EXECUTION_FAILED",
        lastErrorMessage: errMsg,
        updatedAt: now,
      })
      .where(eq(organizationIntegrations.id, integrationId));

    if (err instanceof IntegrationError) throw err;

    throw new IntegrationError("INTERNAL_ERROR", errMsg, {
      providerKey,
      statusCode: 500,
    });
  }
}
