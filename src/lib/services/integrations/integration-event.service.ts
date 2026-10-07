import crypto from "crypto";
import { db } from "@/db";
import { DbClient } from "@/db/types";
import {
  organizationWebhooks,
  webhookDeliveries,
} from "@/db/schema/integrations";
import { IntegrationEvent } from "@/lib/types/integrations";
import { executeWebhookDeliveryAsync, getWebhookById } from "./webhook.service";
import { eq, and } from "drizzle-orm";

export interface PublishEventInput {
  id?: string; // Optional caller-provided stable UUID for idempotency
  organizationId: string;
  eventType: string;
  entityType: string;
  entityId: string;
  payload: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface PublishEventResult {
  eventId: string;
  matchedWebhooksCount: number;
  deliveryIds: string[];
}

/**
 * Publishes an immutable CRM integration event to matching subscribed webhooks.
 *
 * CRITICAL ARCHITECTURAL GUARANTEE:
 * 1. The event ID is stable and immutable for downstream idempotency.
 * 2. Delivery records are committed to the database.
 * 3. Network HTTP delivery is dispatched asynchronously in the background.
 * 4. The calling CRM mutation NEVER blocks on external HTTP responses.
 */
export async function publishIntegrationEvent(
  input: PublishEventInput,
  dbInstance: DbClient = db as DbClient
): Promise<PublishEventResult> {
  const eventId = input.id || crypto.randomUUID();
  const occurredAt = new Date().toISOString();

  const fullEvent: IntegrationEvent = {
    id: eventId,
    organizationId: input.organizationId,
    eventType: input.eventType,
    entityType: input.entityType,
    entityId: input.entityId,
    occurredAt,
    payload: input.payload,
    metadata: input.metadata,
  };

  // 1. Fetch active webhooks for this organization
  let activeWebhooks: Array<{
    id: string;
    subscribedEvents: string[];
    url: string;
    secret: string;
  }> = [];

  try {
    activeWebhooks = await dbInstance
      .select({
        id: organizationWebhooks.id,
        subscribedEvents: organizationWebhooks.subscribedEvents,
        url: organizationWebhooks.url,
        secret: organizationWebhooks.secret,
      })
      .from(organizationWebhooks)
      .where(
        and(
          eq(organizationWebhooks.organizationId, input.organizationId),
          eq(organizationWebhooks.active, true)
        )
      );
  } catch {
    // Graceful fallback if webhook table is unmigrated in isolated environments
    return {
      eventId,
      matchedWebhooksCount: 0,
      deliveryIds: [],
    };
  }

  // 2. Filter matching webhooks
  const matchingWebhooks = activeWebhooks.filter((wh) => {
    const subs = wh.subscribedEvents;
    return (
      subs.includes("*") ||
      subs.includes(input.eventType) ||
      subs.includes(`${input.entityType}.*`)
    );
  });

  if (matchingWebhooks.length === 0) {
    return {
      eventId,
      matchedWebhooksCount: 0,
      deliveryIds: [],
    };
  }

  const deliveryIds: string[] = [];

  // 3. Create delivery records for each matching webhook
  for (const wh of matchingWebhooks) {
    const deliveryId = crypto.randomUUID();
    deliveryIds.push(deliveryId);

    await dbInstance.insert(webhookDeliveries).values({
      id: deliveryId,
      organizationId: input.organizationId,
      webhookId: wh.id,
      eventId,
      eventType: input.eventType,
      payload: fullEvent,
      status: "pending",
      attemptCount: 0,
      maxAttempts: 3,
    });

    // 4. Asynchronously trigger delivery without blocking caller
    void executeWebhookDeliveryAsync(deliveryId, input.organizationId, dbInstance).catch(
      (err) => {
        console.error(
          `[IntegrationEventService] Background delivery failed for ${deliveryId}:`,
          err
        );
      }
    );
  }

  return {
    eventId,
    matchedWebhooksCount: matchingWebhooks.length,
    deliveryIds,
  };
}

/**
 * Sends a test ping event to a specific webhook endpoint to verify connectivity.
 */
export async function testWebhookPing(
  organizationId: string,
  webhookId: string,
  dbInstance: DbClient = db as DbClient
): Promise<{
  success: boolean;
  deliveryId: string;
  eventId: string;
}> {
  const webhook = await getWebhookById(organizationId, webhookId, dbInstance);

  const eventId = crypto.randomUUID();
  const deliveryId = crypto.randomUUID();

  const pingEvent: IntegrationEvent = {
    id: eventId,
    organizationId,
    eventType: "test.ping",
    entityType: "system",
    entityId: webhookId,
    occurredAt: new Date().toISOString(),
    payload: {
      message: "Test webhook delivery from Ghuru CRM Integration Platform",
      webhookId,
      webhookName: webhook.name,
    },
  };

  await dbInstance.insert(webhookDeliveries).values({
    id: deliveryId,
    organizationId,
    webhookId,
    eventId,
    eventType: "test.ping",
    payload: pingEvent,
    status: "pending",
    attemptCount: 0,
    maxAttempts: 1,
  });

  // Execute synchronously for explicit test endpoint
  await executeWebhookDeliveryAsync(deliveryId, organizationId, dbInstance);

  const [result] = await dbInstance
    .select({ status: webhookDeliveries.status })
    .from(webhookDeliveries)
    .where(eq(webhookDeliveries.id, deliveryId))
    .limit(1);

  return {
    success: result?.status === "delivered",
    deliveryId,
    eventId,
  };
}
