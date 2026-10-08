import {
  pgTable,
  text,
  timestamp,
  index,
  jsonb,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations } from "./organizations";
import { organizationIntegrations } from "./integrations";
import { contacts } from "./contacts";
import { leads } from "./leads";

// --- CONVERSATION ENUMS ---
export const CONVERSATION_STATUSES = ["active", "archived", "closed"] as const;
export type ConversationStatus = (typeof CONVERSATION_STATUSES)[number];

// --- MESSAGE ENUMS ---
export const MESSAGE_DIRECTIONS = ["inbound", "outbound"] as const;
export type MessageDirection = (typeof MESSAGE_DIRECTIONS)[number];

export const MESSAGE_TYPES = [
  "text",
  "image",
  "document",
  "audio",
  "video",
  "location",
  "template",
  "unsupported",
] as const;
export type MessageType = (typeof MESSAGE_TYPES)[number];

export const MESSAGE_STATUSES = [
  "pending",
  "sent",
  "delivered",
  "read",
  "failed",
] as const;
export type MessageStatus = (typeof MESSAGE_STATUSES)[number];

// --- CONVERSATIONS TABLE ---
export const conversations = pgTable(
  "conversations",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    integrationId: text("integration_id")
      .notNull()
      .references(() => organizationIntegrations.id, { onDelete: "cascade" }),
    channel: text("channel").notNull().default("whatsapp"),
    externalConversationId: text("external_conversation_id"),
    participantId: text("participant_id").notNull(),
    participantName: text("participant_name"),
    contactId: text("contact_id").references(() => contacts.id, {
      onDelete: "set null",
    }),
    leadId: text("lead_id").references(() => leads.id, {
      onDelete: "set null",
    }),
    status: text("status").notNull().default("active"),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("conversations_org_idx").on(table.organizationId),
    index("conversations_org_participant_channel_idx").on(
      table.organizationId,
      table.channel,
      table.participantId
    ),
    index("conversations_org_integration_idx").on(
      table.organizationId,
      table.integrationId
    ),
    index("conversations_contact_idx").on(table.contactId),
    index("conversations_lead_idx").on(table.leadId),
    index("conversations_last_msg_idx").on(
      table.organizationId,
      table.lastMessageAt
    ),
    index("conversations_created_idx").on(table.createdAt),
  ]
);

// --- MESSAGES TABLE ---
export const messages = pgTable(
  "messages",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    integrationId: text("integration_id")
      .notNull()
      .references(() => organizationIntegrations.id, { onDelete: "cascade" }),
    channel: text("channel").notNull(),
    direction: text("direction").notNull(),
    messageType: text("message_type").notNull().default("text"),
    externalMessageId: text("external_message_id"),
    sender: text("sender").notNull(),
    recipient: text("recipient").notNull(),
    body: text("body"),
    status: text("status").notNull().default("pending"),
    mediaUrl: text("media_url"),
    mediaType: text("media_type"),
    mediaId: text("media_id"),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    readAt: timestamp("read_at", { withTimezone: true }),
    failedAt: timestamp("failed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("messages_org_idx").on(table.organizationId),
    index("messages_conv_idx").on(table.conversationId),
    index("messages_org_created_idx").on(table.organizationId, table.createdAt),
    index("messages_org_external_id_idx").on(
      table.organizationId,
      table.externalMessageId
    ),
    index("messages_status_idx").on(table.status),
  ]
);

// --- RELATIONS ---
export const conversationsRelations = relations(
  conversations,
  ({ one, many }) => ({
    organization: one(organizations, {
      fields: [conversations.organizationId],
      references: [organizations.id],
    }),
    integration: one(organizationIntegrations, {
      fields: [conversations.integrationId],
      references: [organizationIntegrations.id],
    }),
    contact: one(contacts, {
      fields: [conversations.contactId],
      references: [contacts.id],
    }),
    lead: one(leads, {
      fields: [conversations.leadId],
      references: [leads.id],
    }),
    messages: many(messages),
  })
);

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
  organization: one(organizations, {
    fields: [messages.organizationId],
    references: [organizations.id],
  }),
  integration: one(organizationIntegrations, {
    fields: [messages.integrationId],
    references: [organizationIntegrations.id],
  }),
}));
