import crypto from "crypto";
import { db } from "@/db";
import { DbClient } from "@/db/types";
import {
  organizationWebhooks,
  webhookDeliveries,
} from "@/db/schema/integrations";
import {
  CreateWebhookInput,
  UpdateWebhookInput,
} from "@/lib/validations/integrations";
import {
  OrganizationWebhookItem,
  WebhookDeliveryItem,
} from "@/lib/types/integrations";
import { maskSecret } from "./credential.service";
import { safeFetch } from "./http/safe-http-client";
import { eq, and, desc, count } from "drizzle-orm";
import { NotFoundError } from "@/lib/errors";

const WEBHOOK_SECRET_PREFIX = "whsec_";
const WEBHOOK_TIMEOUT_MS = 8000; // 8-second HTTP timeout

/**
 * Computes the HMAC-SHA256 signature for a webhook payload.
 * Format: sha256=HEX_DIGEST
 */
export function generateWebhookSignature(
  payloadString: string,
  secret: string,
  timestamp: number
): string {
  const signedPayload = `${timestamp}.${payloadString}`;
  const hmac = crypto
    .createHmac("sha256", secret)
    .update(signedPayload)
    .digest("hex");
  return `t=${timestamp},v1=${hmac}`;
}

/**
 * Creates a new organization webhook endpoint.
 * Automatically generates a cryptographically secure HMAC secret.
 */
export async function createWebhook(
  organizationId: string,
  userId: string | null,
  input: CreateWebhookInput,
  dbInstance: DbClient = db as DbClient
): Promise<OrganizationWebhookItem & { secret: string }> {
  const rawSecret = `${WEBHOOK_SECRET_PREFIX}${crypto.randomBytes(24).toString("hex")}`;
  const id = crypto.randomUUID();

  const [created] = await dbInstance
    .insert(organizationWebhooks)
    .values({
      id,
      organizationId,
      name: input.name,
      url: input.url,
      secret: rawSecret,
      subscribedEvents: input.subscribedEvents,
      active: input.active ?? true,
      createdById: userId,
    })
    .returning();

  return {
    id: created.id,
    organizationId: created.organizationId,
    name: created.name,
    url: created.url,
    secretMasked: maskSecret(created.secret),
    secret: rawSecret, // Returned once upon creation so the receiver can configure verification
    subscribedEvents: created.subscribedEvents,
    active: created.active,
    createdById: created.createdById,
    createdAt: created.createdAt,
    updatedAt: created.updatedAt,
  };
}

/**
 * Retrieves all webhooks for an organization.
 * Strict tenant isolation enforced. Secrets are always masked.
 */
export async function getWebhooks(
  organizationId: string,
  options: { active?: boolean; page?: number; pageSize?: number } = {},
  dbInstance: DbClient = db as DbClient
): Promise<{
  items: OrganizationWebhookItem[];
  total: number;
}> {
  const conditions = [eq(organizationWebhooks.organizationId, organizationId)];

  if (options.active !== undefined) {
    conditions.push(eq(organizationWebhooks.active, options.active));
  }

  const page = options.page || 1;
  const pageSize = options.pageSize || 20;
  const offset = (page - 1) * pageSize;

  const [countResult] = await dbInstance
    .select({ total: count() })
    .from(organizationWebhooks)
    .where(and(...conditions));

  const total = Number(countResult?.total || 0);

  const rows = await dbInstance
    .select()
    .from(organizationWebhooks)
    .where(and(...conditions))
    .orderBy(desc(organizationWebhooks.createdAt))
    .limit(pageSize)
    .offset(offset);

  const items: OrganizationWebhookItem[] = rows.map((r) => ({
    id: r.id,
    organizationId: r.organizationId,
    name: r.name,
    url: r.url,
    secretMasked: maskSecret(r.secret),
    subscribedEvents: r.subscribedEvents,
    active: r.active,
    createdById: r.createdById,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));

  return { items, total };
}

/**
 * Retrieves a single webhook by ID within an organization.
 */
export async function getWebhookById(
  organizationId: string,
  id: string,
  dbInstance: DbClient = db as DbClient
): Promise<OrganizationWebhookItem> {
  const [row] = await dbInstance
    .select()
    .from(organizationWebhooks)
    .where(
      and(
        eq(organizationWebhooks.id, id),
        eq(organizationWebhooks.organizationId, organizationId)
      )
    )
    .limit(1);

  if (!row) {
    throw new NotFoundError(
      `Webhook '${id}' not found in this organization.`
    );
  }

  return {
    id: row.id,
    organizationId: row.organizationId,
    name: row.name,
    url: row.url,
    secretMasked: maskSecret(row.secret),
    subscribedEvents: row.subscribedEvents,
    active: row.active,
    createdById: row.createdById,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Updates an organization webhook.
 */
export async function updateWebhook(
  organizationId: string,
  id: string,
  input: UpdateWebhookInput,
  dbInstance: DbClient = db as DbClient
): Promise<OrganizationWebhookItem> {
  await getWebhookById(organizationId, id, dbInstance);

  const updateValues: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (input.name !== undefined) updateValues.name = input.name;
  if (input.url !== undefined) updateValues.url = input.url;
  if (input.subscribedEvents !== undefined)
    updateValues.subscribedEvents = input.subscribedEvents;
  if (input.active !== undefined) updateValues.active = input.active;

  const [updated] = await dbInstance
    .update(organizationWebhooks)
    .set(updateValues)
    .where(
      and(
        eq(organizationWebhooks.id, id),
        eq(organizationWebhooks.organizationId, organizationId)
      )
    )
    .returning();

  return {
    id: updated.id,
    organizationId: updated.organizationId,
    name: updated.name,
    url: updated.url,
    secretMasked: maskSecret(updated.secret),
    subscribedEvents: updated.subscribedEvents,
    active: updated.active,
    createdById: updated.createdById,
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt,
  };
}

/**
 * Deletes a webhook from an organization.
 */
export async function deleteWebhook(
  organizationId: string,
  id: string,
  dbInstance: DbClient = db as DbClient
): Promise<void> {
  await getWebhookById(organizationId, id, dbInstance);

  await dbInstance
    .delete(organizationWebhooks)
    .where(
      and(
        eq(organizationWebhooks.id, id),
        eq(organizationWebhooks.organizationId, organizationId)
      )
    );
}

/**
 * Retrieves delivery history for a webhook.
 */
export async function getWebhookDeliveries(
  organizationId: string,
  webhookId: string,
  limit: number = 50,
  dbInstance: DbClient = db as DbClient
): Promise<WebhookDeliveryItem[]> {
  // Confirm webhook belongs to org
  await getWebhookById(organizationId, webhookId, dbInstance);

  const rows = await dbInstance
    .select()
    .from(webhookDeliveries)
    .where(
      and(
        eq(webhookDeliveries.organizationId, organizationId),
        eq(webhookDeliveries.webhookId, webhookId)
      )
    )
    .orderBy(desc(webhookDeliveries.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    organizationId: r.organizationId,
    webhookId: r.webhookId,
    eventId: r.eventId,
    eventType: r.eventType,
    payload: r.payload as Record<string, unknown>,
    status: r.status,
    attemptCount: r.attemptCount,
    maxAttempts: r.maxAttempts,
    responseStatus: r.responseStatus,
    responseBody: r.responseBody,
    failureReason: r.failureReason,
    nextAttemptAt: r.nextAttemptAt,
    deliveredAt: r.deliveredAt,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
}

/**
 * Executes a single webhook HTTP delivery attempt asynchronously.
 * Signs the request using HMAC-SHA256 and captures response headers / status code.
 * Updates the delivery record with outcomes.
 */
export async function executeWebhookDeliveryAsync(
  deliveryId: string,
  organizationId: string,
  dbInstance: DbClient = db as DbClient
): Promise<void> {
  try {
    const [delivery] = await dbInstance
      .select()
      .from(webhookDeliveries)
      .where(
        and(
          eq(webhookDeliveries.id, deliveryId),
          eq(webhookDeliveries.organizationId, organizationId)
        )
      )
      .limit(1);

    if (!delivery || delivery.status === "delivered") return;

    const [webhook] = await dbInstance
      .select()
      .from(organizationWebhooks)
      .where(
        and(
          eq(organizationWebhooks.id, delivery.webhookId),
          eq(organizationWebhooks.organizationId, organizationId)
        )
      )
      .limit(1);

    if (!webhook || !webhook.active) {
      await dbInstance
        .update(webhookDeliveries)
        .set({
          status: "failed",
          failureReason: "Webhook endpoint is deleted or inactive.",
          updatedAt: new Date(),
        })
        .where(eq(webhookDeliveries.id, deliveryId));
      return;
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const payloadString = JSON.stringify(delivery.payload);
    const signature = generateWebhookSignature(
      payloadString,
      webhook.secret,
      timestamp
    );

    let responseStatus: number | null = null;
    let responseBodyText: string | null = null;
    let isSuccess = false;
    let failureReason: string | null = null;

    try {
      const res = await safeFetch(webhook.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Ghuru-CRM-Webhook/1.0",
          "X-Ghuru-Signature": signature,
          "X-Ghuru-Timestamp": String(timestamp),
          "X-Ghuru-Event-Id": delivery.eventId,
          "X-Ghuru-Delivery-Id": delivery.id,
        },
        body: payloadString,
        timeoutMs: WEBHOOK_TIMEOUT_MS,
        allowHttpInDev: true,
      });

      responseStatus = res.status;
      const text = await res.text();
      responseBodyText = text.slice(0, 500); // Truncate response safely

      if (res.ok) {
        isSuccess = true;
      } else {
        failureReason = `HTTP error status ${res.status}`;
      }
    } catch (fetchErr: unknown) {
      const errMessage =
        fetchErr instanceof Error ? fetchErr.message : "Network/Connection error";
      failureReason = errMessage;
    }

    const newAttemptCount = delivery.attemptCount + 1;
    const now = new Date();

    if (isSuccess) {
      await dbInstance
        .update(webhookDeliveries)
        .set({
          status: "delivered",
          attemptCount: newAttemptCount,
          responseStatus,
          responseBody: responseBodyText,
          failureReason: null,
          deliveredAt: now,
          updatedAt: now,
        })
        .where(eq(webhookDeliveries.id, deliveryId));
    } else {
      const willRetry = newAttemptCount < delivery.maxAttempts;
      const nextAttempt = willRetry
        ? new Date(Date.now() + 60000 * Math.pow(2, newAttemptCount)) // exponential backoff
        : null;

      await dbInstance
        .update(webhookDeliveries)
        .set({
          status: willRetry ? "pending" : "failed",
          attemptCount: newAttemptCount,
          responseStatus,
          responseBody: responseBodyText,
          failureReason,
          nextAttemptAt: nextAttempt,
          updatedAt: now,
        })
        .where(eq(webhookDeliveries.id, deliveryId));
    }
  } catch (outerErr) {
    console.error("[WebhookService] Unexpected delivery failure:", outerErr);
  }
}
