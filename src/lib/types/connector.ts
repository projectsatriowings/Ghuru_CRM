import {
  IntegrationAuthType,
  IntegrationCapability,
} from "./integrations";
import { DbClient } from "@/db/types";

// --- CONNECTOR CONTEXT ---
export interface ConnectorContext {
  organizationId: string;
  integrationId: string;
  config: Record<string, unknown>;
  credentials?: Record<string, string>;
  dbInstance?: DbClient;
}

// --- CONNECTOR HEALTH CHECK RESULT ---
export interface ConnectorHealthResult {
  success: boolean;
  message: string;
  details?: Record<string, unknown>;
  testedAt: Date;
}

// --- INBOUND WEBHOOK VERIFICATION & PARSING ---
export interface WebhookVerificationContext {
  rawBody: string;
  headers: Headers | Record<string, string>;
  query?: Record<string, string>;
  secret?: string;
  config?: Record<string, unknown>;
}

export interface WebhookVerificationResult {
  valid: boolean;
  reason?: string;
}

export interface InboundWebhookParseContext {
  rawBody: string;
  parsedBody: Record<string, unknown>;
  headers: Headers | Record<string, string>;
  query?: Record<string, string>;
  organizationId: string;
  integrationId: string;
  providerKey: string;
}

export interface NormalizedIntegrationEvent {
  id: string; // Deterministic or generated UUID
  organizationId: string;
  integrationId: string;
  providerKey: string;
  externalEventId: string; // Used for idempotency deduplication
  eventType: string; // e.g., "lead.inbound", "contact.synced", "message.received"
  occurredAt: Date;
  payload: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

// --- OAUTH2 AUTHORIZE & TOKEN EXCHANGE ---
export interface OAuthAuthorizeContext {
  state: string;
  redirectUri: string;
  config: Record<string, unknown>;
  credentials?: Record<string, string>;
}

export interface OAuthAuthorizeResult {
  authorizationUrl: string;
  codeVerifier?: string; // If PKCE
}

export interface OAuthTokenExchangeContext {
  code: string;
  state: string;
  redirectUri?: string;
  codeVerifier?: string;
  config: Record<string, unknown>;
  credentials?: Record<string, string>;
}

export interface OAuthTokenResult {
  accessToken: string;
  refreshToken?: string;
  tokenType?: string;
  expiresIn?: number; // seconds
  scope?: string;
  rawPayload?: Record<string, unknown>;
}

// --- OUTBOUND API EXECUTION ---
export interface OutboundApiContext<TInput = unknown> {
  organizationId: string;
  integrationId: string;
  action: string;
  input: TInput;
  config: Record<string, unknown>;
  credentials?: Record<string, string>;
}

export interface OutboundApiResult<TOutput = unknown> {
  success: boolean;
  statusCode?: number;
  data?: TOutput;
  error?: string;
  rateLimitRemaining?: number;
  rateLimitResetAt?: Date;
}

// --- MAIN INTEGRATION CONNECTOR INTERFACE ---
export interface IntegrationConnector {
  readonly providerKey: string;
  readonly name: string;
  readonly capabilities: readonly IntegrationCapability[];
  readonly authType: IntegrationAuthType;

  /**
   * Health and connectivity diagnostic check.
   */
  testConnection(context: ConnectorContext): Promise<ConnectorHealthResult>;

  /**
   * Verify signature and authenticity of inbound provider webhook.
   */
  verifyInboundWebhook?(
    context: WebhookVerificationContext
  ): Promise<WebhookVerificationResult>;

  /**
   * Normalize inbound provider payload into standardized IntegrationEvents.
   */
  parseInboundWebhook?(
    context: InboundWebhookParseContext
  ): Promise<NormalizedIntegrationEvent[]>;

  /**
   * Build OAuth authorization URL for OAuth2 providers.
   */
  buildAuthorizationUrl?(
    context: OAuthAuthorizeContext
  ): Promise<OAuthAuthorizeResult>;

  /**
   * Exchange OAuth authorization code for access/refresh tokens.
   */
  exchangeOAuthCode?(
    context: OAuthTokenExchangeContext
  ): Promise<OAuthTokenResult>;

  /**
   * Execute an outbound API operation to the provider.
   */
  executeOutboundApi?<TInput = unknown, TOutput = unknown>(
    context: OutboundApiContext<TInput>
  ): Promise<OutboundApiResult<TOutput>>;
}
