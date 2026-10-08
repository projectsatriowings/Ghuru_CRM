// --- WHATSAPP CLOUD API CONSTANTS ---
export const WHATSAPP_PROVIDER_KEY = "whatsapp";
export const DEFAULT_WHATSAPP_API_VERSION = "v20.0";
export const WHATSAPP_API_BASE_URL = "https://graph.facebook.com";

// --- CONFIGURATION & CREDENTIALS ---

export interface WhatsAppConnectorConfig {
  phoneNumberId: string;
  wabaId?: string;
  verifyToken?: string;
  apiVersion?: string;
}

export interface WhatsAppConnectorCredentials {
  accessToken: string;
  appSecret?: string;
}

// --- OUTBOUND REQUEST SHAPES ---

export interface SendWhatsAppTextMessageInput {
  to: string; // Recipient phone number (E.164, without leading '+')
  text: string;
  previewUrl?: boolean;
}

export interface WhatsAppGraphApiResponse {
  messaging_product: string;
  contacts?: Array<{
    input: string;
    wa_id: string;
  }>;
  messages?: Array<{
    id: string; // "wamid.HBg..."
  }>;
  error?: {
    message: string;
    type: string;
    code: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
}

// --- INBOUND WEBHOOK SHAPES ---

export interface WhatsAppWebhookMessage {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: { body: string };
  image?: { id: string; mime_type?: string; sha256?: string; caption?: string };
  document?: { id: string; filename?: string; mime_type?: string };
  audio?: { id: string; mime_type?: string };
  video?: { id: string; mime_type?: string };
  location?: { latitude: number; longitude: number; name?: string; address?: string };
  interactive?: Record<string, unknown>;
}

export interface WhatsAppWebhookStatus {
  id: string;
  status: "sent" | "delivered" | "read" | "failed";
  timestamp: string;
  recipient_id: string;
  errors?: Array<{ code: number; title: string; message?: string }>;
}

export interface WhatsAppWebhookPayload {
  object: string;
  entry?: Array<{
    id: string;
    changes?: Array<{
      value: {
        messaging_product: string;
        metadata: {
          display_phone_number: string;
          phone_number_id: string;
        };
        contacts?: Array<{
          profile?: { name?: string };
          wa_id: string;
        }>;
        messages?: WhatsAppWebhookMessage[];
        statuses?: WhatsAppWebhookStatus[];
      };
      field: string;
    }>;
  }>;
}
