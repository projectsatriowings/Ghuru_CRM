import { z } from "zod";
import {
  CONVERSATION_STATUSES,
  MESSAGE_STATUSES,
  MESSAGE_TYPES,
} from "@/lib/types/messaging";

export const sendMessageSchema = z.object({
  text: z
    .string()
    .min(1, "Message text cannot be empty")
    .max(4096, "Message exceeds maximum length of 4096 characters"),
  idempotencyKey: z.string().max(255).optional(),
});
export type SendMessageSchemaInput = z.infer<typeof sendMessageSchema>;

export const createConversationSchema = z.object({
  integrationId: z.string().min(1, "Integration ID is required"),
  channel: z.string().min(1).default("whatsapp"),
  participantId: z
    .string()
    .min(1, "Participant identifier / phone number is required")
    .max(50),
  participantName: z.string().max(100).optional(),
  contactId: z.string().optional(),
  leadId: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type CreateConversationSchemaInput = z.infer<
  typeof createConversationSchema
>;

export const conversationsQuerySchema = z.object({
  channel: z.string().optional(),
  status: z.enum(CONVERSATION_STATUSES).optional(),
  contactId: z.string().optional(),
  leadId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type ConversationsQueryInput = z.infer<typeof conversationsQuerySchema>;

export const messagesQuerySchema = z.object({
  status: z.enum(MESSAGE_STATUSES).optional(),
  type: z.enum(MESSAGE_TYPES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});
export type MessagesQueryInput = z.infer<typeof messagesQuerySchema>;
