import {
  type ConversationStatus,
  type MessageDirection,
  type MessageType,
  type MessageStatus,
  CONVERSATION_STATUSES,
  MESSAGE_DIRECTIONS,
  MESSAGE_TYPES,
  MESSAGE_STATUSES,
} from "@/db/schema/messaging";

export type {
  ConversationStatus,
  MessageDirection,
  MessageType,
  MessageStatus,
};

export {
  CONVERSATION_STATUSES,
  MESSAGE_DIRECTIONS,
  MESSAGE_TYPES,
  MESSAGE_STATUSES,
};

// --- DOMAIN ITEMS ---

export interface ConversationItem {
  id: string;
  organizationId: string;
  integrationId: string;
  channel: string;
  externalConversationId: string | null;
  participantId: string;
  participantName: string | null;
  contactId: string | null;
  leadId: string | null;
  status: ConversationStatus;
  lastMessageAt: Date | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface MessageItem {
  id: string;
  organizationId: string;
  conversationId: string;
  integrationId: string;
  channel: string;
  direction: MessageDirection;
  messageType: MessageType;
  externalMessageId: string | null;
  sender: string;
  recipient: string;
  body: string | null;
  status: MessageStatus;
  mediaUrl: string | null;
  mediaType: string | null;
  mediaId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  metadata: Record<string, unknown>;
  sentAt: Date | null;
  deliveredAt: Date | null;
  readAt: Date | null;
  failedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// --- SEND MESSAGE INPUT ---

export interface SendMessageInput {
  text: string;
  idempotencyKey?: string;
}

export interface SendMessageResult {
  message: MessageItem;
  externalMessageId?: string;
  status: MessageStatus;
}

// --- INBOUND HOOK PARAMS ---

export interface InboundMessageParams {
  organizationId: string;
  integrationId: string;
  channel: string;
  externalMessageId: string;
  sender: string;
  recipient: string;
  senderName?: string;
  messageType?: MessageType;
  body?: string;
  mediaUrl?: string;
  mediaType?: string;
  mediaId?: string;
  metadata?: Record<string, unknown>;
  timestamp?: Date;
}

export interface MessageStatusUpdateParams {
  organizationId: string;
  integrationId: string;
  externalMessageId: string;
  status: MessageStatus;
  timestamp?: Date;
  errorCode?: string;
  errorMessage?: string;
}
