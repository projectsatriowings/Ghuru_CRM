import crypto from "crypto";
import {
  IntegrationConnector,
  ConnectorContext,
  ConnectorHealthResult,
  WebhookVerificationContext,
  WebhookVerificationResult,
  InboundWebhookParseContext,
  NormalizedIntegrationEvent,
  OutboundApiContext,
  OutboundApiResult,
} from "@/lib/types/connector";
import { IntegrationCapability } from "@/lib/types/integrations";
import {
  WHATSAPP_PROVIDER_KEY,
  DEFAULT_WHATSAPP_API_VERSION,
  WHATSAPP_API_BASE_URL,
  WhatsAppConnectorConfig,
  WhatsAppConnectorCredentials,
  WhatsAppWebhookPayload,
  SendWhatsAppTextMessageInput,
  WhatsAppGraphApiResponse,
} from "./whatsapp-types";
import { safeFetch } from "@/lib/services/integrations/http/safe-http-client";
import { IntegrationError } from "@/lib/services/integrations/integration-errors";

/**
 * Normalizes phone numbers by stripping whitespace, dashes, parens, and leading '+'.
 * Meta Cloud API requires recipient numbers without leading '+'.
 */
export function normalizeWhatsAppPhoneNumber(phone: string): string {
  return phone.replace(/[\s\-\(\)\.]/g, "").replace(/^\+/, "");
}

/**
 * Production-ready WhatsApp Cloud API connector adapter.
 * Implements IntegrationConnector for the Meta WhatsApp Cloud API.
 */
export class WhatsAppConnector implements IntegrationConnector {
  public readonly providerKey = WHATSAPP_PROVIDER_KEY;
  public readonly name = "WhatsApp Cloud API";
  public readonly capabilities: readonly IntegrationCapability[] = [
    "inbound_webhook",
    "outbound_api",
    "message_send",
  ];
  public readonly authType = "api_key";

  /**
   * Health and connectivity diagnostic check against Meta Graph API.
   */
  public async testConnection(
    context: ConnectorContext
  ): Promise<ConnectorHealthResult> {
    const config = (context.config || {}) as Partial<WhatsAppConnectorConfig>;
    const creds = (context.credentials || {}) as Partial<WhatsAppConnectorCredentials>;

    const phoneNumberId = config.phoneNumberId;
    const accessToken = creds.accessToken || (creds as Record<string, string>).secret;
    const apiVersion = config.apiVersion || DEFAULT_WHATSAPP_API_VERSION;

    if (!phoneNumberId) {
      return {
        success: false,
        message: "Missing Phone Number ID in WhatsApp integration configuration.",
        testedAt: new Date(),
      };
    }

    if (!accessToken) {
      return {
        success: false,
        message: "Missing Access Token in WhatsApp integration credentials.",
        testedAt: new Date(),
      };
    }

    const testUrl = `${WHATSAPP_API_BASE_URL}/${apiVersion}/${phoneNumberId}`;

    try {
      const response = await safeFetch(testUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
        timeoutMs: 8000,
      });

      if (!response.ok) {
        let errorMsg = `Meta API returned HTTP ${response.status}`;
        try {
          const errData = (await response.json()) as WhatsAppGraphApiResponse;
          if (errData.error?.message) {
            errorMsg = errData.error.message;
          }
        } catch {
          // ignore json parse error
        }

        return {
          success: false,
          message: `WhatsApp connection verification failed: ${errorMsg}`,
          testedAt: new Date(),
        };
      }

      return {
        success: true,
        message: "WhatsApp Cloud API connection verified successfully.",
        testedAt: new Date(),
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Network error";
      return {
        success: false,
        message: `WhatsApp Cloud API connection test failed: ${msg}`,
        testedAt: new Date(),
      };
    }
  }

  /**
   * Verifies authenticity of Meta WhatsApp webhook requests.
   * Handles:
   * 1. GET verification challenge (hub.mode, hub.verify_token, hub.challenge)
   * 2. POST event HMAC signature (X-Hub-Signature-256)
   */
  public async verifyInboundWebhook(
    context: WebhookVerificationContext
  ): Promise<WebhookVerificationResult> {
    const query = context.query || {};

    // 1. Meta Webhook Verification Handshake (GET)
    if (query["hub.mode"] === "subscribe") {
      const receivedToken = query["hub.verify_token"];
      const config = (context.config || {}) as Partial<WhatsAppConnectorConfig>;
      const expectedToken = config.verifyToken || context.secret;

      if (!expectedToken) {
        return {
          valid: false,
          reason: "No verify_token configured on integration to validate challenge.",
        };
      }

      if (receivedToken !== expectedToken) {
        return {
          valid: false,
          reason: "Webhook challenge verify_token mismatch.",
        };
      }

      return { valid: true };
    }

    // 2. Meta POST Event Signature Verification (X-Hub-Signature-256)
    let signatureHeader: string | undefined = undefined;

    if (context.headers instanceof Headers) {
      signatureHeader =
        context.headers.get("x-hub-signature-256") ||
        context.headers.get("X-Hub-Signature-256") ||
        undefined;
    } else if (context.headers) {
      signatureHeader =
        context.headers["x-hub-signature-256"] ||
        context.headers["X-Hub-Signature-256"];
    }

    const secret = context.secret;
    if (!secret) {
      // In development/testing if no secret is configured, reject for security
      return {
        valid: false,
        reason: "Missing App Secret for WhatsApp webhook signature verification.",
      };
    }

    if (!signatureHeader) {
      return {
        valid: false,
        reason: "Missing X-Hub-Signature-256 header in webhook request.",
      };
    }

    const cleanSignature = signatureHeader.replace(/^sha256=/, "");
    const expectedHash = crypto
      .createHmac("sha256", secret)
      .update(context.rawBody || "")
      .digest("hex");

    if (cleanSignature.length !== expectedHash.length) {
      return {
        valid: false,
        reason: "Signature length mismatch.",
      };
    }

    const valid = crypto.timingSafeEqual(
      Buffer.from(cleanSignature, "hex"),
      Buffer.from(expectedHash, "hex")
    );

    return {
      valid,
      reason: valid ? undefined : "X-Hub-Signature-256 HMAC digest does not match.",
    };
  }

  /**
   * Normalizes Meta WhatsApp webhook payloads into NormalizedIntegrationEvents.
   * Extracts inbound messages and status updates without exposing raw Meta shapes.
   */
  public async parseInboundWebhook(
    context: InboundWebhookParseContext
  ): Promise<NormalizedIntegrationEvent[]> {
    const payload = context.parsedBody as unknown as WhatsAppWebhookPayload;
    const events: NormalizedIntegrationEvent[] = [];

    if (!payload || !payload.entry || !Array.isArray(payload.entry)) {
      return events;
    }

    for (const entry of payload.entry) {
      if (!entry.changes || !Array.isArray(entry.changes)) continue;

      for (const change of entry.changes) {
        const val = change.value;
        if (!val || val.messaging_product !== "whatsapp") continue;

        const metadata = val.metadata || {
          display_phone_number: "",
          phone_number_id: "",
        };

        // Build contact profile mapping (wa_id -> profile name)
        const profileNames = new Map<string, string>();
        if (val.contacts && Array.isArray(val.contacts)) {
          for (const c of val.contacts) {
            if (c.wa_id && c.profile?.name) {
              profileNames.set(c.wa_id, c.profile.name);
            }
          }
        }

        // 1. Process Inbound Messages
        if (val.messages && Array.isArray(val.messages)) {
          for (const msg of val.messages) {
            const timestampMs = Number(msg.timestamp) * 1000;
            const occurredAt = !isNaN(timestampMs)
              ? new Date(timestampMs)
              : new Date();

            let textBody: string | undefined = undefined;
            const mediaUrl: string | undefined = undefined;
            let mediaType: string | undefined = undefined;
            let mediaId: string | undefined = undefined;

            switch (msg.type) {
              case "text":
                textBody = msg.text?.body || "";
                break;
              case "image":
                textBody = msg.image?.caption || "[Image]";
                mediaType = msg.image?.mime_type || "image/jpeg";
                mediaId = msg.image?.id;
                break;
              case "document":
                textBody = msg.document?.filename || "[Document]";
                mediaType = msg.document?.mime_type || "application/pdf";
                mediaId = msg.document?.id;
                break;
              case "audio":
                textBody = "[Audio Message]";
                mediaType = msg.audio?.mime_type || "audio/ogg";
                mediaId = msg.audio?.id;
                break;
              case "video":
                textBody = "[Video Message]";
                mediaType = msg.video?.mime_type || "video/mp4";
                mediaId = msg.video?.id;
                break;
              case "location":
                textBody = msg.location?.name
                  ? `Location: ${msg.location.name} (${msg.location.latitude}, ${msg.location.longitude})`
                  : `Location: (${msg.location?.latitude}, ${msg.location?.longitude})`;
                break;
              default:
                textBody = `[Unsupported Message: ${msg.type}]`;
                break;
            }

            const senderProfile = profileNames.get(msg.from);

            events.push({
              id: crypto.randomUUID(),
              organizationId: context.organizationId,
              integrationId: context.integrationId,
              providerKey: WHATSAPP_PROVIDER_KEY,
              externalEventId: msg.id, // wamid
              eventType: "message.received",
              occurredAt,
              payload: {
                channel: "whatsapp",
                direction: "inbound",
                externalMessageId: msg.id,
                sender: msg.from,
                recipient: metadata.display_phone_number || metadata.phone_number_id,
                senderName: senderProfile,
                messageType: msg.type,
                body: textBody,
                mediaUrl,
                mediaType,
                mediaId,
                timestamp: occurredAt.toISOString(),
              },
              metadata: {
                phone_number_id: metadata.phone_number_id,
                display_phone_number: metadata.display_phone_number,
              },
            });
          }
        }

        // 2. Process Delivery Status Updates
        if (val.statuses && Array.isArray(val.statuses)) {
          for (const st of val.statuses) {
            const timestampMs = Number(st.timestamp) * 1000;
            const occurredAt = !isNaN(timestampMs)
              ? new Date(timestampMs)
              : new Date();

            let errorMessage: string | undefined = undefined;
            if (st.errors && st.errors.length > 0) {
              errorMessage =
                st.errors[0]?.message ||
                st.errors[0]?.title ||
                `Meta Error code ${st.errors[0]?.code}`;
            }

            events.push({
              id: crypto.randomUUID(),
              organizationId: context.organizationId,
              integrationId: context.integrationId,
              providerKey: WHATSAPP_PROVIDER_KEY,
              externalEventId: `${st.id}:${st.status}:${st.timestamp}`,
              eventType: "message.status_updated",
              occurredAt,
              payload: {
                channel: "whatsapp",
                externalMessageId: st.id,
                recipient: st.recipient_id,
                status: st.status, // "sent" | "delivered" | "read" | "failed"
                error: errorMessage,
                timestamp: occurredAt.toISOString(),
              },
              metadata: {
                phone_number_id: metadata.phone_number_id,
              },
            });
          }
        }
      }
    }

    return events;
  }

  /**
   * Executes outbound API operations (e.g. sending a WhatsApp text message).
   */
  public async executeOutboundApi<TInput = unknown, TOutput = unknown>(
    context: OutboundApiContext<TInput>
  ): Promise<OutboundApiResult<TOutput>> {
    const config = (context.config || {}) as Partial<WhatsAppConnectorConfig>;
    const creds = (context.credentials || {}) as Partial<WhatsAppConnectorCredentials>;

    const phoneNumberId = config.phoneNumberId;
    const accessToken = creds.accessToken || (creds as Record<string, string>).secret;
    const apiVersion = config.apiVersion || DEFAULT_WHATSAPP_API_VERSION;

    if (!phoneNumberId) {
      throw new IntegrationError(
        "INVALID_CONFIGURATION",
        "Missing Phone Number ID in WhatsApp integration configuration.",
        { providerKey: WHATSAPP_PROVIDER_KEY, statusCode: 400 }
      );
    }

    if (!accessToken) {
      throw new IntegrationError(
        "AUTHENTICATION_FAILED",
        "Missing Access Token in WhatsApp integration credentials.",
        { providerKey: WHATSAPP_PROVIDER_KEY, statusCode: 401 }
      );
    }

    if (context.action !== "send_message") {
      throw new IntegrationError(
        "UNSUPPORTED_CAPABILITY",
        `Unsupported outbound action '${context.action}' for WhatsApp connector.`,
        { providerKey: WHATSAPP_PROVIDER_KEY, statusCode: 400 }
      );
    }

    const input = context.input as SendWhatsAppTextMessageInput;
    if (!input || !input.to || !input.text) {
      throw new IntegrationError(
        "INVALID_CONFIGURATION",
        "Recipient phone number ('to') and message text ('text') are required.",
        { providerKey: WHATSAPP_PROVIDER_KEY, statusCode: 400 }
      );
    }

    const cleanRecipient = normalizeWhatsAppPhoneNumber(input.to);
    const sendUrl = `${WHATSAPP_API_BASE_URL}/${apiVersion}/${phoneNumberId}/messages`;

    const requestBody = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: cleanRecipient,
      type: "text",
      text: {
        preview_url: input.previewUrl ?? false,
        body: input.text,
      },
    };

    const response = await safeFetch(sendUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
      timeoutMs: 10000,
    });

    const responseData = (await response.json()) as WhatsAppGraphApiResponse;

    if (!response.ok) {
      const errInfo = responseData.error;
      const errorMsg = errInfo?.message || `Meta API error HTTP ${response.status}`;

      if (response.status === 401 || errInfo?.code === 190) {
        throw new IntegrationError("AUTHENTICATION_FAILED", errorMsg, {
          providerKey: WHATSAPP_PROVIDER_KEY,
          statusCode: 401,
        });
      }

      if (response.status === 429 || errInfo?.code === 4 || errInfo?.code === 80007) {
        throw new IntegrationError("RATE_LIMITED", errorMsg, {
          providerKey: WHATSAPP_PROVIDER_KEY,
          statusCode: 429,
        });
      }

      if (errInfo?.code === 100 || errInfo?.code === 131009) {
        throw new IntegrationError("INVALID_CONFIGURATION", errorMsg, {
          providerKey: WHATSAPP_PROVIDER_KEY,
          statusCode: 400,
        });
      }

      return {
        success: false,
        statusCode: response.status,
        error: errorMsg,
      };
    }

    const messageId = responseData.messages?.[0]?.id;
    if (!messageId) {
      throw new IntegrationError(
        "INVALID_PROVIDER_RESPONSE",
        "Meta API response missing message ID.",
        { providerKey: WHATSAPP_PROVIDER_KEY, statusCode: 502 }
      );
    }

    return {
      success: true,
      statusCode: response.status,
      data: {
        externalMessageId: messageId,
        recipient: cleanRecipient,
      } as TOutput,
    };
  }
}

export const whatsAppConnector = new WhatsAppConnector();
