import crypto from "crypto";
import { db } from "@/db";
import { DbClient } from "@/db/types";
import {
  organizationIntegrations,
  integrationProviders,
  integrationInboundEvents,
  InboundEventStatus,
} from "@/db/schema/integrations";
import { connectorRegistry } from "@/lib/integrations/connectors/connector-registry";
import {
  NormalizedIntegrationEvent,
} from "@/lib/types/connector";
import { InboundIntegrationEventItem } from "@/lib/types/integrations";
import { getDecryptedCredentials } from "./credential.service";
import { publishIntegrationEvent } from "./integration-event.service";
import { IntegrationError } from "./integration-errors";
import { eq, and, desc, count } from "drizzle-orm";
import { NotFoundError } from "@/lib/errors";

export interface ProcessInboundWebhookRequest {
  rawBody: string;
  headers: Headers | Record<string, string>;
  query?: Record<string, string>;
}

export interface InboundWebhookProcessResult {
  success: boolean;
  duplicate: boolean;
  integrationId: string;
  providerKey: string;
  organizationId: string;
  eventsProcessed: number;
  eventIds: string[];
  message: string;
}

/**
 * Handles an inbound webhook delivered to an integration endpoint.
 *
 * Enforces:
 * 1. Integration existence and active 'connected' status.
 * 2. Connector resolution from registry.
 * 3. Signature verification via connector.
 * 4. Normalization of provider payload into NormalizedIntegrationEvents.
 * 5. Idempotent deduplication against integration_inbound_events.
 * 6. Non-blocking event publication to CRM consumers.
 */
export async function processInboundWebhook(
  integrationId: string,
  request: ProcessInboundWebhookRequest,
  dbInstance: DbClient = db as DbClient
): Promise<InboundWebhookProcessResult> {
  // 1. Resolve integration with provider details
  const [row] = await dbInstance
    .select({
      id: organizationIntegrations.id,
      organizationId: organizationIntegrations.organizationId,
      status: organizationIntegrations.status,
      config: organizationIntegrations.config,
      providerId: organizationIntegrations.providerId,
      providerKey: integrationProviders.key,
      providerName: integrationProviders.name,
    })
    .from(organizationIntegrations)
    .innerJoin(
      integrationProviders,
      eq(organizationIntegrations.providerId, integrationProviders.id)
    )
    .where(eq(organizationIntegrations.id, integrationId))
    .limit(1);

  if (!row) {
    throw new NotFoundError(
      `Integration endpoint '${integrationId}' does not exist.`
    );
  }

  // Tenant identity is strictly derived from the registered integration row
  const organizationId = row.organizationId;
  const providerKey = row.providerKey;

  // 2. Enforce active connection status
  if (row.status !== "connected") {
    throw new IntegrationError(
      "INVALID_CONFIGURATION",
      `Integration '${integrationId}' is not active (current status: ${row.status}). Inbound events are rejected.`,
      { providerKey, statusCode: 400 }
    );
  }

  // 3. Resolve connector implementation
  const connector = connectorRegistry.get(providerKey);
  if (!connector) {
    throw new IntegrationError(
      "UNSUPPORTED_CAPABILITY",
      `No connector registered for provider '${providerKey}'.`,
      { providerKey, statusCode: 501 }
    );
  }

  // 4. Retrieve decrypted credentials (signing secret, api key, etc.)
  const rawCredentials = await getDecryptedCredentials(
    organizationId,
    integrationId,
    dbInstance
  );

  let resolvedSecret: string | undefined = rawCredentials || undefined;
  if (rawCredentials) {
    try {
      const parsed = JSON.parse(rawCredentials);
      if (typeof parsed === "object" && parsed !== null) {
        resolvedSecret = parsed.signing_secret || parsed.api_key || rawCredentials;
      }
    } catch {
      resolvedSecret = rawCredentials;
    }
  }

  // 5. Verify inbound webhook signature
  if (connector.verifyInboundWebhook) {
    const verification = await connector.verifyInboundWebhook({
      rawBody: request.rawBody,
      headers: request.headers,
      query: request.query,
      secret: resolvedSecret,
      config: row.config as Record<string, unknown>,
    });

    if (!verification.valid) {
      throw new IntegrationError(
        "SIGNATURE_INVALID",
        `Webhook signature verification failed: ${verification.reason || "Invalid signature"}`,
        { providerKey, statusCode: 401 }
      );
    }
  }

  // 6. Parse JSON body safely
  let parsedBody: Record<string, unknown> = {};
  if (request.rawBody) {
    try {
      parsedBody = JSON.parse(request.rawBody);
    } catch {
      throw new IntegrationError(
        "INVALID_PROVIDER_RESPONSE",
        "Malformed request body: Invalid JSON.",
        { providerKey, statusCode: 400 }
      );
    }
  }

  // 7. Normalize provider payload into standard IntegrationEvents
  let normalizedEvents: NormalizedIntegrationEvent[] = [];
  if (connector.parseInboundWebhook) {
    normalizedEvents = await connector.parseInboundWebhook({
      rawBody: request.rawBody,
      parsedBody,
      headers: request.headers,
      query: request.query,
      organizationId,
      integrationId,
      providerKey,
    });
  } else {
    // Default fallback normalization
    const externalId =
      (parsedBody.id as string) ||
      (parsedBody.event_id as string) ||
      crypto.randomUUID();
    normalizedEvents = [
      {
        id: crypto.randomUUID(),
        organizationId,
        integrationId,
        providerKey,
        externalEventId: String(externalId),
        eventType: `${providerKey}.inbound`,
        occurredAt: new Date(),
        payload: parsedBody,
      },
    ];
  }

  if (normalizedEvents.length === 0) {
    return {
      success: true,
      duplicate: false,
      integrationId,
      providerKey,
      organizationId,
      eventsProcessed: 0,
      eventIds: [],
      message: "No events extracted from payload.",
    };
  }

  const processedEventIds: string[] = [];
  let isAllDuplicates = true;

  // 8. Process each normalized event with idempotency guarantees
  for (const event of normalizedEvents) {
    // Idempotency check: lookup by (organizationId, providerKey, externalEventId)
    const [existing] = await dbInstance
      .select()
      .from(integrationInboundEvents)
      .where(
        and(
          eq(integrationInboundEvents.organizationId, organizationId),
          eq(integrationInboundEvents.providerKey, providerKey),
          eq(integrationInboundEvents.externalEventId, event.externalEventId)
        )
      )
      .limit(1);

    if (existing) {
      if (existing.status === "processed" || existing.status === "duplicate") {
        // Idempotent duplicate: record attempt count and acknowledge safely
        await dbInstance
          .update(integrationInboundEvents)
          .set({
            attemptCount: existing.attemptCount + 1,
            updatedAt: new Date(),
          })
          .where(eq(integrationInboundEvents.id, existing.id));

        processedEventIds.push(existing.id);
        continue;
      }
    }

    isAllDuplicates = false;
    const inboundEventId = existing ? existing.id : crypto.randomUUID();

    if (!existing) {
      await dbInstance.insert(integrationInboundEvents).values({
        id: inboundEventId,
        organizationId,
        integrationId,
        providerKey,
        externalEventId: event.externalEventId,
        eventType: event.eventType,
        payload: event.payload,
        status: "received",
        attemptCount: 1,
        receivedAt: new Date(),
      });
    }

    try {
      // Dispatch normalized event to subscribers (CRM event bus & webhooks)
      await publishIntegrationEvent(
        {
          organizationId,
          eventType: event.eventType,
          entityType: "integration",
          entityId: integrationId,
          payload: {
            ...event.payload,
            providerKey,
            externalEventId: event.externalEventId,
          },
          metadata: {
            ...event.metadata,
            inboundEventId,
            occurredAt: event.occurredAt.toISOString(),
          },
        },
        dbInstance
      );

      // Mark processed
      await dbInstance
        .update(integrationInboundEvents)
        .set({
          status: "processed",
          processedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(integrationInboundEvents.id, inboundEventId));

      processedEventIds.push(inboundEventId);
    } catch (processErr: unknown) {
      const errMessage =
        processErr instanceof Error ? processErr.message : "Processing error";

      await dbInstance
        .update(integrationInboundEvents)
        .set({
          status: "processing_failed",
          error: errMessage,
          updatedAt: new Date(),
        })
        .where(eq(integrationInboundEvents.id, inboundEventId));

      throw new IntegrationError(
        "INTERNAL_ERROR",
        `Failed to process inbound event '${event.externalEventId}': ${errMessage}`,
        { providerKey, statusCode: 500 }
      );
    }
  }

  // Update integration lastSuccessAt
  await dbInstance
    .update(organizationIntegrations)
    .set({
      lastSuccessAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(organizationIntegrations.id, integrationId));

  return {
    success: true,
    duplicate: isAllDuplicates && normalizedEvents.length > 0,
    integrationId,
    providerKey,
    organizationId,
    eventsProcessed: normalizedEvents.length,
    eventIds: processedEventIds,
    message: isAllDuplicates
      ? "Webhook delivery acknowledged as duplicate."
      : "Inbound webhook processed successfully.",
  };
}

/**
 * Retrieves paginated inbound events for an organization.
 * Strict tenant isolation enforced.
 */
export async function getInboundEvents(
  organizationId: string,
  options: {
    integrationId?: string;
    status?: InboundEventStatus;
    page?: number;
    pageSize?: number;
  } = {},
  dbInstance: DbClient = db as DbClient
): Promise<{
  items: InboundIntegrationEventItem[];
  total: number;
}> {
  const conditions = [
    eq(integrationInboundEvents.organizationId, organizationId),
  ];

  if (options.integrationId) {
    conditions.push(
      eq(integrationInboundEvents.integrationId, options.integrationId)
    );
  }
  if (options.status) {
    conditions.push(eq(integrationInboundEvents.status, options.status));
  }

  const page = options.page || 1;
  const pageSize = options.pageSize || 20;
  const offset = (page - 1) * pageSize;

  const [countRes] = await dbInstance
    .select({ total: count() })
    .from(integrationInboundEvents)
    .where(and(...conditions));

  const total = Number(countRes?.total || 0);

  const rows = await dbInstance
    .select()
    .from(integrationInboundEvents)
    .where(and(...conditions))
    .orderBy(desc(integrationInboundEvents.createdAt))
    .limit(pageSize)
    .offset(offset);

  const items: InboundIntegrationEventItem[] = rows.map((r) => ({
    id: r.id,
    organizationId: r.organizationId,
    integrationId: r.integrationId,
    providerKey: r.providerKey,
    externalEventId: r.externalEventId,
    eventType: r.eventType,
    payload: r.payload as Record<string, unknown>,
    status: r.status as InboundEventStatus,
    attemptCount: r.attemptCount,
    error: r.error,
    receivedAt: r.receivedAt,
    processedAt: r.processedAt,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));

  return { items, total };
}

/**
 * Retrieves a single inbound event by ID within an organization.
 */
export async function getInboundEventById(
  organizationId: string,
  eventId: string,
  dbInstance: DbClient = db as DbClient
): Promise<InboundIntegrationEventItem> {
  const [row] = await dbInstance
    .select()
    .from(integrationInboundEvents)
    .where(
      and(
        eq(integrationInboundEvents.id, eventId),
        eq(integrationInboundEvents.organizationId, organizationId)
      )
    )
    .limit(1);

  if (!row) {
    throw new NotFoundError(`Inbound event '${eventId}' not found.`);
  }

  return {
    id: row.id,
    organizationId: row.organizationId,
    integrationId: row.integrationId,
    providerKey: row.providerKey,
    externalEventId: row.externalEventId,
    eventType: row.eventType,
    payload: row.payload as Record<string, unknown>,
    status: row.status as InboundEventStatus,
    attemptCount: row.attemptCount,
    error: row.error,
    receivedAt: row.receivedAt,
    processedAt: row.processedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
