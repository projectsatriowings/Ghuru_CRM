import crypto from "crypto";
import { db } from "@/db";
import { DbClient } from "@/db/types";
import {
  conversations,
  messages,
  ConversationStatus,
  MessageStatus,
  MessageType,
} from "@/db/schema/messaging";
import {
  contacts,
  leads,
} from "@/db/schema";
import {
  ConversationItem,
  MessageItem,
  SendMessageInput,
  SendMessageResult,
  InboundMessageParams,
  MessageStatusUpdateParams,
} from "@/lib/types/messaging";
import {
  ConversationsQueryInput,
  MessagesQueryInput,
} from "@/lib/validations/messaging";
import { getOrganizationIntegrationById } from "@/lib/services/integrations/organization-integration.service";
import { executeOutboundConnectorCall } from "@/lib/services/integrations/connector-dispatcher.service";
import { createActivity } from "@/lib/services/activity.service";
import { normalizeWhatsAppPhoneNumber } from "@/lib/connectors/whatsapp/whatsapp-connector";
import { eq, and, desc, asc, count } from "drizzle-orm";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { IntegrationError } from "@/lib/services/integrations/integration-errors";

/**
 * Finds an existing conversation or creates a new one with contact/lead matching.
 * Strict tenant isolation enforced.
 */
export async function findOrCreateConversation(
  organizationId: string,
  integrationId: string,
  channel: string,
  participantId: string,
  options: {
    participantName?: string;
    contactId?: string;
    leadId?: string;
    metadata?: Record<string, unknown>;
  } = {},
  dbInstance: DbClient = db as DbClient
): Promise<ConversationItem> {
  const cleanParticipantId = normalizeWhatsAppPhoneNumber(participantId);

  // 1. Search existing conversation
  const [existing] = await dbInstance
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.organizationId, organizationId),
        eq(conversations.channel, channel),
        eq(conversations.participantId, cleanParticipantId)
      )
    )
    .limit(1);

  if (existing) {
    if (options.participantName && !existing.participantName) {
      await dbInstance
        .update(conversations)
        .set({
          participantName: options.participantName,
          updatedAt: new Date(),
        })
        .where(eq(conversations.id, existing.id));

      existing.participantName = options.participantName;
    }

    return {
      id: existing.id,
      organizationId: existing.organizationId,
      integrationId: existing.integrationId,
      channel: existing.channel,
      externalConversationId: existing.externalConversationId,
      participantId: existing.participantId,
      participantName: existing.participantName,
      contactId: existing.contactId,
      leadId: existing.leadId,
      status: existing.status as ConversationStatus,
      lastMessageAt: existing.lastMessageAt,
      metadata: existing.metadata as Record<string, unknown>,
      createdAt: existing.createdAt,
      updatedAt: existing.updatedAt,
    };
  }

  // 2. Perform safe, tenant-scoped phone matching for Contact or Lead association
  let matchedContactId: string | null = options.contactId || null;
  let matchedLeadId: string | null = options.leadId || null;

  if (!matchedContactId && !matchedLeadId) {
    // Search active contacts in this organization
    const activeContacts = await dbInstance
      .select({ id: contacts.id, phone: contacts.phone })
      .from(contacts)
      .where(
        and(
          eq(contacts.organizationId, organizationId)
        )
      );

    const matchingContacts = activeContacts.filter(
      (c) => c.phone && normalizeWhatsAppPhoneNumber(c.phone) === cleanParticipantId
    );

    if (matchingContacts.length === 1 && matchingContacts[0]) {
      matchedContactId = matchingContacts[0].id;
    } else if (matchingContacts.length === 0) {
      // Search active leads in this organization
      const activeLeads = await dbInstance
        .select({ id: leads.id, phone: leads.phone })
        .from(leads)
        .where(
          and(
            eq(leads.organizationId, organizationId)
          )
        );

      const matchingLeads = activeLeads.filter(
        (l) => l.phone && normalizeWhatsAppPhoneNumber(l.phone) === cleanParticipantId
      );

      if (matchingLeads.length === 1 && matchingLeads[0]) {
        matchedLeadId = matchingLeads[0].id;
      }
    }
  }

  // 3. Create new conversation
  const id = crypto.randomUUID();
  const [created] = await dbInstance
    .insert(conversations)
    .values({
      id,
      organizationId,
      integrationId,
      channel,
      participantId: cleanParticipantId,
      participantName: options.participantName || null,
      contactId: matchedContactId,
      leadId: matchedLeadId,
      status: "active",
      metadata: options.metadata || {},
    })
    .returning();

  return {
    id: created.id,
    organizationId: created.organizationId,
    integrationId: created.integrationId,
    channel: created.channel,
    externalConversationId: created.externalConversationId,
    participantId: created.participantId,
    participantName: created.participantName,
    contactId: created.contactId,
    leadId: created.leadId,
    status: created.status as ConversationStatus,
    lastMessageAt: created.lastMessageAt,
    metadata: created.metadata as Record<string, unknown>,
    createdAt: created.createdAt,
    updatedAt: created.updatedAt,
  };
}

/**
 * Retrieves paginated conversations for an organization.
 * Strict tenant isolation enforced.
 */
export async function getConversations(
  organizationId: string,
  options: ConversationsQueryInput = { page: 1, pageSize: 20 },
  dbInstance: DbClient = db as DbClient
): Promise<{ items: ConversationItem[]; total: number }> {
  const conditions = [eq(conversations.organizationId, organizationId)];

  if (options.channel) {
    conditions.push(eq(conversations.channel, options.channel));
  }
  if (options.status) {
    conditions.push(eq(conversations.status, options.status));
  }
  if (options.contactId) {
    conditions.push(eq(conversations.contactId, options.contactId));
  }
  if (options.leadId) {
    conditions.push(eq(conversations.leadId, options.leadId));
  }

  const page = options.page || 1;
  const pageSize = options.pageSize || 20;
  const offset = (page - 1) * pageSize;

  const [countRes] = await dbInstance
    .select({ total: count() })
    .from(conversations)
    .where(and(...conditions));

  const total = Number(countRes?.total || 0);

  const rows = await dbInstance
    .select()
    .from(conversations)
    .where(and(...conditions))
    .orderBy(desc(conversations.lastMessageAt), desc(conversations.createdAt))
    .limit(pageSize)
    .offset(offset);

  const items: ConversationItem[] = rows.map((r) => ({
    id: r.id,
    organizationId: r.organizationId,
    integrationId: r.integrationId,
    channel: r.channel,
    externalConversationId: r.externalConversationId,
    participantId: r.participantId,
    participantName: r.participantName,
    contactId: r.contactId,
    leadId: r.leadId,
    status: r.status as ConversationStatus,
    lastMessageAt: r.lastMessageAt,
    metadata: r.metadata as Record<string, unknown>,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));

  return { items, total };
}

/**
 * Retrieves a single conversation by ID.
 * Strict tenant isolation enforced.
 */
export async function getConversationById(
  organizationId: string,
  id: string,
  dbInstance: DbClient = db as DbClient
): Promise<ConversationItem> {
  const [row] = await dbInstance
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.id, id),
        eq(conversations.organizationId, organizationId)
      )
    )
    .limit(1);

  if (!row) {
    throw new NotFoundError(`Conversation '${id}' not found in this organization.`);
  }

  return {
    id: row.id,
    organizationId: row.organizationId,
    integrationId: row.integrationId,
    channel: row.channel,
    externalConversationId: row.externalConversationId,
    participantId: row.participantId,
    participantName: row.participantName,
    contactId: row.contactId,
    leadId: row.leadId,
    status: row.status as ConversationStatus,
    lastMessageAt: row.lastMessageAt,
    metadata: row.metadata as Record<string, unknown>,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Retrieves paginated messages for a conversation.
 * Strict tenant isolation enforced.
 */
export async function getMessages(
  organizationId: string,
  conversationId: string,
  options: MessagesQueryInput = { page: 1, pageSize: 50 },
  dbInstance: DbClient = db as DbClient
): Promise<{ items: MessageItem[]; total: number }> {
  // Validate conversation exists in this organization
  await getConversationById(organizationId, conversationId, dbInstance);

  const conditions = [
    eq(messages.organizationId, organizationId),
    eq(messages.conversationId, conversationId),
  ];

  if (options.status) {
    conditions.push(eq(messages.status, options.status));
  }
  if (options.type) {
    conditions.push(eq(messages.messageType, options.type));
  }

  const page = options.page || 1;
  const pageSize = options.pageSize || 50;
  const offset = (page - 1) * pageSize;

  const [countRes] = await dbInstance
    .select({ total: count() })
    .from(messages)
    .where(and(...conditions));

  const total = Number(countRes?.total || 0);

  const rows = await dbInstance
    .select()
    .from(messages)
    .where(and(...conditions))
    .orderBy(asc(messages.createdAt))
    .limit(pageSize)
    .offset(offset);

  const items: MessageItem[] = rows.map((r) => ({
    id: r.id,
    organizationId: r.organizationId,
    conversationId: r.conversationId,
    integrationId: r.integrationId,
    channel: r.channel,
    direction: r.direction as "inbound" | "outbound",
    messageType: r.messageType as MessageType,
    externalMessageId: r.externalMessageId,
    sender: r.sender,
    recipient: r.recipient,
    body: r.body,
    status: r.status as MessageStatus,
    mediaUrl: r.mediaUrl,
    mediaType: r.mediaType,
    mediaId: r.mediaId,
    errorCode: r.errorCode,
    errorMessage: r.errorMessage,
    metadata: r.metadata as Record<string, unknown>,
    sentAt: r.sentAt,
    deliveredAt: r.deliveredAt,
    readAt: r.readAt,
    failedAt: r.failedAt,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));

  return { items, total };
}

/**
 * Saves an inbound message from a provider webhook with idempotency protection.
 */
export async function saveInboundMessage(
  params: InboundMessageParams,
  dbInstance: DbClient = db as DbClient
): Promise<MessageItem> {
  const {
    organizationId,
    integrationId,
    channel,
    externalMessageId,
    sender,
    recipient,
    senderName,
    messageType = "text",
    body = "",
    mediaUrl,
    mediaType,
    mediaId,
    metadata = {},
    timestamp = new Date(),
  } = params;

  // 1. Find or create conversation
  const conv = await findOrCreateConversation(
    organizationId,
    integrationId,
    channel,
    sender,
    { participantName: senderName },
    dbInstance
  );

  // 2. Idempotency deduplication check: check if message already exists
  const [existingMsg] = await dbInstance
    .select()
    .from(messages)
    .where(
      and(
        eq(messages.organizationId, organizationId),
        eq(messages.externalMessageId, externalMessageId)
      )
    )
    .limit(1);

  if (existingMsg) {
    return {
      id: existingMsg.id,
      organizationId: existingMsg.organizationId,
      conversationId: existingMsg.conversationId,
      integrationId: existingMsg.integrationId,
      channel: existingMsg.channel,
      direction: existingMsg.direction as "inbound" | "outbound",
      messageType: existingMsg.messageType as MessageType,
      externalMessageId: existingMsg.externalMessageId,
      sender: existingMsg.sender,
      recipient: existingMsg.recipient,
      body: existingMsg.body,
      status: existingMsg.status as MessageStatus,
      mediaUrl: existingMsg.mediaUrl,
      mediaType: existingMsg.mediaType,
      mediaId: existingMsg.mediaId,
      errorCode: existingMsg.errorCode,
      errorMessage: existingMsg.errorMessage,
      metadata: existingMsg.metadata as Record<string, unknown>,
      sentAt: existingMsg.sentAt,
      deliveredAt: existingMsg.deliveredAt,
      readAt: existingMsg.readAt,
      failedAt: existingMsg.failedAt,
      createdAt: existingMsg.createdAt,
      updatedAt: existingMsg.updatedAt,
    };
  }

  // 3. Insert inbound message
  const msgId = crypto.randomUUID();
  const [created] = await dbInstance
    .insert(messages)
    .values({
      id: msgId,
      organizationId,
      conversationId: conv.id,
      integrationId,
      channel,
      direction: "inbound",
      messageType,
      externalMessageId,
      sender,
      recipient,
      body,
      status: "delivered",
      mediaUrl: mediaUrl || null,
      mediaType: mediaType || null,
      mediaId: mediaId || null,
      metadata,
      deliveredAt: timestamp,
    })
    .returning();

  // 4. Update conversation lastMessageAt
  await dbInstance
    .update(conversations)
    .set({
      lastMessageAt: timestamp,
      updatedAt: new Date(),
    })
    .where(eq(conversations.id, conv.id));

  // 5. CRM Unified Timeline Activity Integration (if linked to Contact or Lead)
  if (conv.contactId || conv.leadId) {
    try {
      const integration = await getOrganizationIntegrationById(
        organizationId,
        integrationId,
        dbInstance
      );

      const actingUserId = integration.connectedByUserId;
      if (actingUserId) {
        await createActivity(
          organizationId,
          actingUserId,
          {
            entityType: conv.contactId ? "contact" : "lead",
            entityId: conv.contactId || conv.leadId!,
            type: "note",
            title: `Inbound ${channel.toUpperCase()} message`,
            description: body || `[${messageType}]`,
            status: "completed",
          },
          dbInstance
        );
      }
    } catch (actErr) {
      // Activity logging is non-blocking to prevent dropping inbound messages
      console.warn(
        `[MessagingService] Could not log activity for inbound message:`,
        actErr
      );
    }
  }

  return {
    id: created.id,
    organizationId: created.organizationId,
    conversationId: created.conversationId,
    integrationId: created.integrationId,
    channel: created.channel,
    direction: created.direction as "inbound" | "outbound",
    messageType: created.messageType as MessageType,
    externalMessageId: created.externalMessageId,
    sender: created.sender,
    recipient: created.recipient,
    body: created.body,
    status: created.status as MessageStatus,
    mediaUrl: created.mediaUrl,
    mediaType: created.mediaType,
    mediaId: created.mediaId,
    errorCode: created.errorCode,
    errorMessage: created.errorMessage,
    metadata: created.metadata as Record<string, unknown>,
    sentAt: created.sentAt,
    deliveredAt: created.deliveredAt,
    readAt: created.readAt,
    failedAt: created.failedAt,
    createdAt: created.createdAt,
    updatedAt: created.updatedAt,
  };
}

/**
 * Updates delivery status of a previously sent/received message.
 */
export async function updateMessageDeliveryStatus(
  params: MessageStatusUpdateParams,
  dbInstance: DbClient = db as DbClient
): Promise<MessageItem | null> {
  const {
    organizationId,
    externalMessageId,
    status,
    timestamp = new Date(),
    errorCode,
    errorMessage,
  } = params;

  const [row] = await dbInstance
    .select()
    .from(messages)
    .where(
      and(
        eq(messages.organizationId, organizationId),
        eq(messages.externalMessageId, externalMessageId)
      )
    )
    .limit(1);

  if (!row) {
    return null;
  }

  const updates: Record<string, unknown> = {
    status,
    updatedAt: new Date(),
  };

  if (status === "sent") updates.sentAt = timestamp;
  if (status === "delivered") updates.deliveredAt = timestamp;
  if (status === "read") updates.readAt = timestamp;
  if (status === "failed") {
    updates.failedAt = timestamp;
    if (errorCode) updates.errorCode = errorCode;
    if (errorMessage) updates.errorMessage = errorMessage;
  }

  const [updated] = await dbInstance
    .update(messages)
    .set(updates)
    .where(eq(messages.id, row.id))
    .returning();

  return {
    id: updated.id,
    organizationId: updated.organizationId,
    conversationId: updated.conversationId,
    integrationId: updated.integrationId,
    channel: updated.channel,
    direction: updated.direction as "inbound" | "outbound",
    messageType: updated.messageType as MessageType,
    externalMessageId: updated.externalMessageId,
    sender: updated.sender,
    recipient: updated.recipient,
    body: updated.body,
    status: updated.status as MessageStatus,
    mediaUrl: updated.mediaUrl,
    mediaType: updated.mediaType,
    mediaId: updated.mediaId,
    errorCode: updated.errorCode,
    errorMessage: updated.errorMessage,
    metadata: updated.metadata as Record<string, unknown>,
    sentAt: updated.sentAt,
    deliveredAt: updated.deliveredAt,
    readAt: updated.readAt,
    failedAt: updated.failedAt,
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt,
  };
}

/**
 * Sends an outbound message through the generic connector pipeline.
 * Persists pending message, calls connector via safe outbound HTTP, and updates status.
 */
export async function sendMessage(
  organizationId: string,
  conversationId: string,
  input: SendMessageInput,
  userId: string,
  dbInstance: DbClient = db as DbClient
): Promise<SendMessageResult> {
  // 1. Resolve conversation with tenant check
  const conv = await getConversationById(organizationId, conversationId, dbInstance);

  if (conv.status === "archived") {
    throw new ValidationError(
      "Cannot send message in an archived conversation. Please unarchive it first."
    );
  }

  // 2. Resolve integration connection
  const integration = await getOrganizationIntegrationById(
    organizationId,
    conv.integrationId,
    dbInstance
  );

  if (integration.status !== "connected") {
    throw new ValidationError(
      `Integration '${integration.name}' is not connected (current status: ${integration.status}).`
    );
  }

  // 3. Outbound Idempotency Check
  if (input.idempotencyKey) {
    const existingMessages = await dbInstance
      .select()
      .from(messages)
      .where(
        and(
          eq(messages.organizationId, organizationId),
          eq(messages.conversationId, conversationId)
        )
      );

    const dup = existingMessages.find((m) => {
      const meta = m.metadata as Record<string, unknown>;
      return meta?.idempotencyKey === input.idempotencyKey;
    });

    if (dup) {
      return {
        message: {
          id: dup.id,
          organizationId: dup.organizationId,
          conversationId: dup.conversationId,
          integrationId: dup.integrationId,
          channel: dup.channel,
          direction: dup.direction as "inbound" | "outbound",
          messageType: dup.messageType as MessageType,
          externalMessageId: dup.externalMessageId,
          sender: dup.sender,
          recipient: dup.recipient,
          body: dup.body,
          status: dup.status as MessageStatus,
          mediaUrl: dup.mediaUrl,
          mediaType: dup.mediaType,
          mediaId: dup.mediaId,
          errorCode: dup.errorCode,
          errorMessage: dup.errorMessage,
          metadata: dup.metadata as Record<string, unknown>,
          sentAt: dup.sentAt,
          deliveredAt: dup.deliveredAt,
          readAt: dup.readAt,
          failedAt: dup.failedAt,
          createdAt: dup.createdAt,
          updatedAt: dup.updatedAt,
        },
        externalMessageId: dup.externalMessageId || undefined,
        status: dup.status as MessageStatus,
      };
    }
  }

  // 4. Create pending message record in database
  const msgId = crypto.randomUUID();
  const config = integration.config as Record<string, unknown>;
  const senderId = (config.phoneNumberId as string) || integration.name;

  await dbInstance.insert(messages).values({
    id: msgId,
    organizationId,
    conversationId: conv.id,
    integrationId: conv.integrationId,
    channel: conv.channel,
    direction: "outbound",
    messageType: "text",
    sender: senderId,
    recipient: conv.participantId,
    body: input.text,
    status: "pending",
    metadata: input.idempotencyKey
      ? { idempotencyKey: input.idempotencyKey }
      : {},
  });

  // 5. Execute outbound call via generic connector dispatcher
  try {
    const result = await executeOutboundConnectorCall<{
      to: string;
      text: string;
    }, { externalMessageId: string }>(
      {
        organizationId,
        integrationId: conv.integrationId,
        action: "send_message",
        requiredCapability: "message_send",
        input: {
          to: conv.participantId,
          text: input.text,
        },
      },
      dbInstance
    );

    if (!result.success) {
      await dbInstance
        .update(messages)
        .set({
          status: "failed",
          failedAt: new Date(),
          errorMessage: result.error || "Outbound operation reported failure.",
          updatedAt: new Date(),
        })
        .where(eq(messages.id, msgId));

      throw new IntegrationError(
        "INVALID_PROVIDER_RESPONSE",
        result.error || "Failed to send outbound message via provider connector.",
        { providerKey: conv.channel, statusCode: 502 }
      );
    }

    const externalMessageId = result.data?.externalMessageId || null;
    const now = new Date();

    const [updated] = await dbInstance
      .update(messages)
      .set({
        externalMessageId,
        status: "sent",
        sentAt: now,
        updatedAt: now,
      })
      .where(eq(messages.id, msgId))
      .returning();

    // Update conversation lastMessageAt
    await dbInstance
      .update(conversations)
      .set({
        lastMessageAt: now,
        updatedAt: now,
      })
      .where(eq(conversations.id, conv.id));

    // Polymorphic CRM Activity logging
    if (conv.contactId || conv.leadId) {
      try {
        await createActivity(
          organizationId,
          userId,
          {
            entityType: conv.contactId ? "contact" : "lead",
            entityId: conv.contactId || conv.leadId!,
            type: "note",
            title: `Outbound ${conv.channel.toUpperCase()} message`,
            description: input.text,
            status: "completed",
          },
          dbInstance
        );
      } catch (actErr) {
        console.warn("[MessagingService] Could not log outbound activity:", actErr);
      }
    }

    return {
      message: {
        id: updated.id,
        organizationId: updated.organizationId,
        conversationId: updated.conversationId,
        integrationId: updated.integrationId,
        channel: updated.channel,
        direction: updated.direction as "inbound" | "outbound",
        messageType: updated.messageType as MessageType,
        externalMessageId: updated.externalMessageId,
        sender: updated.sender,
        recipient: updated.recipient,
        body: updated.body,
        status: updated.status as MessageStatus,
        mediaUrl: updated.mediaUrl,
        mediaType: updated.mediaType,
        mediaId: updated.mediaId,
        errorCode: updated.errorCode,
        errorMessage: updated.errorMessage,
        metadata: updated.metadata as Record<string, unknown>,
        sentAt: updated.sentAt,
        deliveredAt: updated.deliveredAt,
        readAt: updated.readAt,
        failedAt: updated.failedAt,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      },
      externalMessageId: externalMessageId || undefined,
      status: "sent",
    };
  } catch (err: unknown) {
    await dbInstance
      .update(messages)
      .set({
        status: "failed",
        failedAt: new Date(),
        errorMessage: err instanceof Error ? err.message : "Outbound call threw error.",
        updatedAt: new Date(),
      })
      .where(eq(messages.id, msgId));

    if (err instanceof IntegrationError) throw err;

    throw new IntegrationError(
      "INTERNAL_ERROR",
      err instanceof Error ? err.message : "Unexpected error during outbound message dispatch.",
      { providerKey: conv.channel, statusCode: 500 }
    );
  }
}
