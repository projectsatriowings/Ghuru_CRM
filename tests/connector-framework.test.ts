import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "@/db/schema";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { createOrganization } from "@/lib/services/organization.service";
import {
  registerProvider,
} from "@/lib/services/integrations/provider-registry.service";
import {
  createOrganizationIntegration,
  getOrganizationIntegrationById,
  testIntegrationConnection,
  toggleIntegrationStatus,
} from "@/lib/services/integrations/organization-integration.service";
import {
  getDecryptedCredentials,
} from "@/lib/services/integrations/credential.service";
import { connectorRegistry } from "@/lib/integrations/connectors/connector-registry";
import {
  IntegrationConnector,
  ConnectorContext,
  ConnectorHealthResult,
  WebhookVerificationContext,
  WebhookVerificationResult,
  InboundWebhookParseContext,
  NormalizedIntegrationEvent,
  OAuthAuthorizeContext,
  OAuthAuthorizeResult,
  OAuthTokenExchangeContext,
  OAuthTokenResult,
  OutboundApiContext,
  OutboundApiResult,
} from "@/lib/types/connector";
import {
  processInboundWebhook,
  getInboundEvents,
} from "@/lib/services/integrations/inbound-webhook.service";
import {
  initiateOAuthFlow,
  handleOAuthCallback,
} from "@/lib/services/integrations/oauth.service";
import {
  validateTargetUrl,
} from "@/lib/services/integrations/http/safe-http-client";
import {
  executeOutboundConnectorCall,
  InProcessJobDispatcher,
} from "@/lib/services/integrations/connector-dispatcher.service";
import {
  IntegrationError,
} from "@/lib/services/integrations/integration-errors";
import { NotFoundError } from "@/lib/errors";
import { IntegrationCapability } from "@/lib/types/integrations";

// --- TEST MOCK CONNECTOR IMPLEMENTATION ---
class MockTestConnector implements IntegrationConnector {
  public readonly providerKey = "mock_test_connector";
  public readonly name = "Mock Test Connector";
  public readonly capabilities = [
    "webhook_inbound",
    "webhook_outbound",
    "oauth",
    "api_read",
    "api_write",
  ] as const;
  public readonly authType = "oauth2" as const;

  public async testConnection(
    context: ConnectorContext
  ): Promise<ConnectorHealthResult> {
    if (context.config?.failHealth === true) {
      return {
        success: false,
        message: "Simulated mock health check failure.",
        testedAt: new Date(),
      };
    }
    return {
      success: true,
      message: "Mock test connector is healthy.",
      testedAt: new Date(),
    };
  }

  public async verifyInboundWebhook(
    context: WebhookVerificationContext
  ): Promise<WebhookVerificationResult> {
    const signature =
      typeof context.headers.get === "function"
        ? context.headers.get("x-mock-signature")
        : (context.headers as Record<string, string>)["x-mock-signature"];

    if (signature === "valid_mock_signature" || signature === context.secret) {
      return { valid: true };
    }
    return { valid: false, reason: "Mock signature mismatch" };
  }

  public async parseInboundWebhook(
    context: InboundWebhookParseContext
  ): Promise<NormalizedIntegrationEvent[]> {
    const body = context.parsedBody;
    const externalId = (body.event_id as string) || "mock_ext_default";

    return [
      {
        id: crypto.randomUUID(),
        organizationId: context.organizationId,
        integrationId: context.integrationId,
        providerKey: context.providerKey,
        externalEventId: externalId,
        eventType: (body.event_type as string) || "mock.inbound.event",
        occurredAt: new Date(),
        payload: body,
      },
    ];
  }

  public async buildAuthorizationUrl(
    context: OAuthAuthorizeContext
  ): Promise<OAuthAuthorizeResult> {
    return {
      authorizationUrl: `https://auth.mock-provider.com/oauth/authorize?state=${context.state}&redirect_uri=${encodeURIComponent(context.redirectUri)}`,
      codeVerifier: "mock_code_verifier_123",
    };
  }

  public async exchangeOAuthCode(
    context: OAuthTokenExchangeContext
  ): Promise<OAuthTokenResult> {
    if (context.code === "invalid_code") {
      throw new Error("Invalid mock authorization code.");
    }

    return {
      accessToken: "mock_access_token_xyz987",
      refreshToken: "mock_refresh_token_abc123",
      tokenType: "Bearer",
      expiresIn: 3600,
      scope: "read write",
    };
  }

  public async executeOutboundApi<TInput, TOutput>(
    context: OutboundApiContext<TInput>
  ): Promise<OutboundApiResult<TOutput>> {
    if (context.action === "error_action") {
      return {
        success: false,
        error: "Simulated outbound error.",
      };
    }

    return {
      success: true,
      data: { action: context.action, input: context.input } as TOutput,
    };
  }
}

describe("Milestone 3.1 — Connector & Inbound Integration Framework Test Suite", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let testDb: any;
  let userAId: string;
  let userBId: string;
  let orgAId: string;
  let orgBId: string;

  let providerRecordId: string;
  let integrationAId: string;
  let integrationBId: string;
  const mockConnector = new MockTestConnector();

  beforeAll(async () => {
    // 1. Initialize PGlite instance
    const client = new PGlite();
    testDb = drizzle(client, { schema });

    // 2. Run migrations 0000 to 0017
    const migrationFiles = [
      "0000_moaning_vector.sql",
      "0001_flashy_king_bedlam.sql",
      "0002_lowly_shape.sql",
      "0003_furry_fixer.sql",
      "0004_glamorous_natasha_romanoff.sql",
      "0005_eminent_red_ghost.sql",
      "0006_new_kinsey_walden.sql",
      "0007_shiny_hellcat.sql",
      "0008_neat_terrax.sql",
      "0009_talented_bastion.sql",
      "0010_amused_gambit.sql",
      "0011_chubby_pete_wisdom.sql",
      "0012_amused_sheva_callister.sql",
      "0013_regular_silk_fever.sql",
      "0014_flimsy_gorilla_man.sql",
      "0015_puzzling_swarm.sql",
      "0016_salty_the_liberteens.sql",
      "0017_minor_starfox.sql",
      "0018_mute_boom_boom.sql",
    ];

    for (const file of migrationFiles) {
      const filePath = path.resolve(__dirname, `../drizzle/${file}`);
      if (fs.existsSync(filePath)) {
        const sqlContent = fs.readFileSync(filePath, "utf-8");
        const statements = sqlContent
          .split("--> statement-breakpoint")
          .map((s) => s.trim())
          .filter((s) => s.length > 0);

        for (const stmt of statements) {
          await client.exec(stmt);
        }
      }
    }

    // 3. Create test users
    userAId = crypto.randomUUID();
    userBId = crypto.randomUUID();
    await testDb.insert(schema.users).values([
      {
        id: userAId,
        name: "Admin User A",
        email: "admin_a_31@test.com",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: userBId,
        name: "Admin User B",
        email: "admin_b_31@test.com",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    // 4. Create isolated test organizations
    const orgA = await createOrganization(
      {
        name: "Organization Alpha 3.1",
        slug: `org-alpha-${crypto.randomUUID().slice(0, 8)}`,
        userId: userAId,
      },
      testDb
    );
    orgAId = orgA.organization.id;

    const orgB = await createOrganization(
      {
        name: "Organization Beta 3.1",
        slug: `org-beta-${crypto.randomUUID().slice(0, 8)}`,
        userId: userBId,
      },
      testDb
    );
    orgBId = orgB.organization.id;

    // 5. Register provider in catalog
    const provider = await registerProvider(
      {
        key: mockConnector.providerKey,
        name: mockConnector.name,
        category: "communication",
        authType: "oauth2",
        capabilities: ["webhook_inbound", "webhook_outbound", "oauth", "api_read", "api_write"],
        status: "active",
      },
      testDb
    );
    providerRecordId = provider.id;

    // 6. Connect integration for Org A
    const intA = await createOrganizationIntegration(
      orgAId,
      userAId,
      {
        providerId: providerRecordId,
        name: "Org A Mock Integration",
        credentials: {
          credentialType: "signing_secret",
          secret: "whsec_mock_secret_org_a",
        },
      },
      testDb
    );
    integrationAId = intA.id;

    // 7. Connect integration for Org B
    const intB = await createOrganizationIntegration(
      orgBId,
      userBId,
      {
        providerId: providerRecordId,
        name: "Org B Mock Integration",
        credentials: {
          credentialType: "signing_secret",
          secret: "whsec_mock_secret_org_b",
        },
      },
      testDb
    );
    integrationBId = intB.id;
  });

  beforeEach(() => {
    // Ensure mock connector is registered in registry
    connectorRegistry.register(mockConnector);
  });

  // ==========================================
  // 1. CONNECTOR REGISTRY
  // ==========================================
  describe("1. Connector Registry & Capability Discovery", () => {
    it("should register and resolve connector by providerKey", () => {
      expect(connectorRegistry.has("mock_test_connector")).toBe(true);
      const resolved = connectorRegistry.get("mock_test_connector");
      expect(resolved).toBeDefined();
      expect(resolved?.name).toBe("Mock Test Connector");
    });

    it("should return undefined for unregistered provider keys", () => {
      expect(connectorRegistry.has("unknown_provider_xyz")).toBe(false);
      expect(connectorRegistry.get("unknown_provider_xyz")).toBeUndefined();
    });

    it("should accurately validate supported and unsupported capabilities", () => {
      expect(
        connectorRegistry.supportsCapability(
          "mock_test_connector",
          "webhook_inbound"
        )
      ).toBe(true);
      expect(
        connectorRegistry.supportsCapability("mock_test_connector", "oauth")
      ).toBe(true);
      expect(
        connectorRegistry.supportsCapability(
          "mock_test_connector",
          "calendar_sync" as unknown as IntegrationCapability
        )
      ).toBe(false);
    });

    it("should list all registered connectors", () => {
      const list = connectorRegistry.list();
      expect(list.some((c) => c.providerKey === "mock_test_connector")).toBe(
        true
      );
    });
  });

  // ==========================================
  // 2. CONNECTOR HEALTH CHECK & TEST INTEGRATION
  // ==========================================
  describe("2. Connector Health Check Abstraction", () => {
    it("should execute connector testConnection and report healthy status", async () => {
      const result = await testIntegrationConnection(
        orgAId,
        integrationAId,
        testDb
      );
      expect(result.success).toBe(true);
      expect(result.message).toBe("Mock test connector is healthy.");

      const updated = await getOrganizationIntegrationById(
        orgAId,
        integrationAId,
        testDb
      );
      expect(updated.lastSuccessAt).toBeDefined();
      expect(updated.lastErrorAt).toBeNull();
    });

    it("should capture and record simulated connector health check failure", async () => {
      // Create failing integration
      const failingInt = await createOrganizationIntegration(
        orgAId,
        userAId,
        {
          providerId: providerRecordId,
          name: "Failing Health Integration",
          config: { failHealth: true },
        },
        testDb
      );

      const result = await testIntegrationConnection(
        orgAId,
        failingInt.id,
        testDb
      );
      expect(result.success).toBe(false);
      expect(result.message).toBe("Simulated mock health check failure.");

      const updated = await getOrganizationIntegrationById(
        orgAId,
        failingInt.id,
        testDb
      );
      expect(updated.lastErrorAt).toBeDefined();
      expect(updated.lastErrorCode).toBe("CONNECTION_FAILED");
    });
  });

  // ==========================================
  // 3. INBOUND WEBHOOK PROCESSING & SECURITY
  // ==========================================
  describe("3. Inbound Webhook Processing & Security", () => {
    it("should successfully process a valid inbound webhook", async () => {
      const payload = {
        event_id: "evt_unique_101",
        event_type: "lead.created",
        lead_name: "John Doe",
      };

      const result = await processInboundWebhook(
        integrationAId,
        {
          rawBody: JSON.stringify(payload),
          headers: { "x-mock-signature": "valid_mock_signature" },
        },
        testDb
      );

      expect(result.success).toBe(true);
      expect(result.duplicate).toBe(false);
      expect(result.eventsProcessed).toBe(1);
      expect(result.organizationId).toBe(orgAId);
    });

    it("should reject inbound webhook with invalid signature", async () => {
      const payload = { event_id: "evt_tampered_999", amount: 100 };

      await expect(
        processInboundWebhook(
          integrationAId,
          {
            rawBody: JSON.stringify(payload),
            headers: { "x-mock-signature": "invalid_forged_sig" },
          },
          testDb
        )
      ).rejects.toThrow(IntegrationError);
    });

    it("should reject inbound webhook with malformed JSON body", async () => {
      await expect(
        processInboundWebhook(
          integrationAId,
          {
            rawBody: "NOT_VALID_JSON{{{",
            headers: { "x-mock-signature": "valid_mock_signature" },
          },
          testDb
        )
      ).rejects.toThrow(IntegrationError);
    });

    it("should throw NotFoundError for non-existent integration endpoint", async () => {
      await expect(
        processInboundWebhook(
          crypto.randomUUID(),
          {
            rawBody: JSON.stringify({}),
            headers: {},
          },
          testDb
        )
      ).rejects.toThrow(NotFoundError);
    });

    it("should reject inbound webhook when integration is disabled", async () => {
      // Toggle integration to disabled
      await toggleIntegrationStatus(orgAId, integrationAId, false, testDb);

      await expect(
        processInboundWebhook(
          integrationAId,
          {
            rawBody: JSON.stringify({ event_id: "evt_1" }),
            headers: { "x-mock-signature": "valid_mock_signature" },
          },
          testDb
        )
      ).rejects.toThrow(IntegrationError);

      // Re-enable for subsequent tests
      await toggleIntegrationStatus(orgAId, integrationAId, true, testDb);
    });
  });

  // ==========================================
  // 4. INBOUND IDEMPOTENCY & DEDUPLICATION
  // ==========================================
  describe("4. Inbound Idempotency & Deduplication", () => {
    it("should acknowledge duplicate webhook deliveries safely without re-processing", async () => {
      const stableEventId = "evt_idempotent_retry_500";
      const payload = {
        event_id: stableEventId,
        event_type: "customer.update",
        detail: "initial delivery",
      };

      // 1. Initial delivery
      const firstDelivery = await processInboundWebhook(
        integrationAId,
        {
          rawBody: JSON.stringify(payload),
          headers: { "x-mock-signature": "valid_mock_signature" },
        },
        testDb
      );
      expect(firstDelivery.success).toBe(true);
      expect(firstDelivery.duplicate).toBe(false);

      // 2. Retry delivery #1 (same externalEventId)
      const retry1 = await processInboundWebhook(
        integrationAId,
        {
          rawBody: JSON.stringify(payload),
          headers: { "x-mock-signature": "valid_mock_signature" },
        },
        testDb
      );
      expect(retry1.success).toBe(true);
      expect(retry1.duplicate).toBe(true);

      // 3. Retry delivery #2 (same externalEventId)
      const retry2 = await processInboundWebhook(
        integrationAId,
        {
          rawBody: JSON.stringify(payload),
          headers: { "x-mock-signature": "valid_mock_signature" },
        },
        testDb
      );
      expect(retry2.success).toBe(true);
      expect(retry2.duplicate).toBe(true);

      // 4. Verify inbound events in database
      const events = await getInboundEvents(
        orgAId,
        { integrationId: integrationAId },
        testDb
      );
      const matched = events.items.find(
        (e) => e.externalEventId === stableEventId
      );
      expect(matched).toBeDefined();
      expect(matched?.status).toBe("processed");
      expect(matched?.attemptCount).toBe(3); // Initial + 2 retries
    });
  });

  // ==========================================
  // 5. TENANT ISOLATION FOR INBOUND EVENTS
  // ==========================================
  describe("5. Multi-Tenant Isolation for Inbound Events", () => {
    it("should strictly enforce tenant boundaries: Org B cannot see Org A inbound events", async () => {
      const payload = {
        event_id: "evt_org_a_secret",
        event_type: "sensitive.event",
      };

      await processInboundWebhook(
        integrationAId,
        {
          rawBody: JSON.stringify(payload),
          headers: { "x-mock-signature": "valid_mock_signature" },
        },
        testDb
      );

      // Org A should see it
      const orgAEvents = await getInboundEvents(orgAId, {}, testDb);
      expect(
        orgAEvents.items.some((e) => e.externalEventId === "evt_org_a_secret")
      ).toBe(true);

      // Org B must NEVER see Org A's inbound event
      expect(integrationBId).toBeDefined();
      const orgBEvents = await getInboundEvents(orgBId, { integrationId: integrationBId }, testDb);
      expect(
        orgBEvents.items.some((e) => e.externalEventId === "evt_org_a_secret")
      ).toBe(false);
    });
  });

  // ==========================================
  // 6. GENERIC OAUTH2 FLOW & SECURITY
  // ==========================================
  describe("6. Generic OAuth2 Flow & CSRF Security", () => {
    it("should initiate OAuth flow with secure, expiring state parameter", async () => {
      const redirectUri = "https://app.ghuru.com/oauth/callback";
      const result = await initiateOAuthFlow(
        orgAId,
        integrationAId,
        redirectUri,
        testDb
      );

      expect(result.authorizationUrl).toContain("https://auth.mock-provider.com/oauth/authorize");
      expect(result.authorizationUrl).toContain(`state=${result.state}`);
      expect(result.state).toHaveLength(64); // 32 random bytes hex
      expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it("should exchange code, encrypt tokens, and mark integration connected", async () => {
      const redirectUri = "https://app.ghuru.com/oauth/callback";
      const init = await initiateOAuthFlow(
        orgAId,
        integrationAId,
        redirectUri,
        testDb
      );

      const callbackResult = await handleOAuthCallback(
        {
          state: init.state,
          code: "valid_auth_code_123",
          redirectUri,
        },
        testDb
      );

      expect(callbackResult.success).toBe(true);
      expect(callbackResult.organizationId).toBe(orgAId);
      expect(callbackResult.integrationId).toBe(integrationAId);

      // Verify tokens were encrypted at rest
      const creds = await getDecryptedCredentials(
        orgAId,
        integrationAId,
        testDb
      );
      expect(creds).toBeDefined();
      const parsedTokens = JSON.parse(creds!);
      expect(parsedTokens.accessToken).toBe("mock_access_token_xyz987");
    });

    it("should reject replay attempts using already-used OAuth state", async () => {
      const redirectUri = "https://app.ghuru.com/oauth/callback";
      const init = await initiateOAuthFlow(
        orgAId,
        integrationAId,
        redirectUri,
        testDb
      );

      // First use succeeds
      await handleOAuthCallback(
        {
          state: init.state,
          code: "valid_auth_code_123",
          redirectUri,
        },
        testDb
      );

      // Second use MUST fail with AUTHORIZATION_FAILED
      await expect(
        handleOAuthCallback(
          {
            state: init.state,
            code: "valid_auth_code_123",
            redirectUri,
          },
          testDb
        )
      ).rejects.toThrow(IntegrationError);
    });

    it("should reject unknown or forged OAuth states", async () => {
      await expect(
        handleOAuthCallback(
          {
            state: "forged_state_parameter_not_in_db",
            code: "any_code",
          },
          testDb
        )
      ).rejects.toThrow(IntegrationError);
    });
  });

  // ==========================================
  // 7. SSRF & SAFE HTTP DEFENSE LAYER
  // ==========================================
  describe("7. Safe HTTP & SSRF Defense Layer", () => {
    it("should permit valid public HTTPS endpoints", () => {
      const result = validateTargetUrl("https://api.example.com/webhooks");
      expect(result.safe).toBe(true);
      expect(result.url?.protocol).toBe("https:");
    });

    it("should block localhost and loopback IPv4 addresses", () => {
      expect(validateTargetUrl("http://localhost:3000/api").safe).toBe(false);
      expect(validateTargetUrl("https://127.0.0.1/admin").safe).toBe(false);
      expect(validateTargetUrl("https://127.1.2.3:8080").safe).toBe(false);
    });

    it("should block AWS/GCP/Azure link-local metadata service (169.254.169.254)", () => {
      const meta = validateTargetUrl("https://169.254.169.254/latest/meta-data/");
      expect(meta.safe).toBe(false);
      expect(meta.reason).toMatch(/blocked for security reasons|private\/local IP range/);
    });

    it("should block private network IP ranges (RFC 1918)", () => {
      expect(validateTargetUrl("https://10.0.0.5/internal").safe).toBe(false);
      expect(validateTargetUrl("https://172.16.0.1/service").safe).toBe(false);
      expect(validateTargetUrl("https://192.168.1.1/router").safe).toBe(false);
    });

    it("should reject plain HTTP protocol when allowHttpInDev is false", () => {
      const res = validateTargetUrl("http://example.com/webhook", {
        allowHttpInDev: false,
      });
      expect(res.safe).toBe(false);
      expect(res.reason).toContain("Only HTTPS is allowed");
    });
  });

  // ==========================================
  // 8. OUTBOUND CONNECTOR API EXECUTION
  // ==========================================
  describe("8. Outbound Connector Execution & Dispatcher", () => {
    it("should execute outbound connector call successfully", async () => {
      const result = await executeOutboundConnectorCall(
        {
          organizationId: orgAId,
          integrationId: integrationAId,
          action: "send_message",
          input: { recipient: "+1234567890", text: "Hello from CRM" },
          requiredCapability: "api_write",
        },
        testDb
      );

      expect(result.success).toBe(true);
      expect((result.data as { action: string })?.action).toBe("send_message");
    });

    it("should reject outbound call if provider lacks required capability", async () => {
      await expect(
        executeOutboundConnectorCall(
          {
            organizationId: orgAId,
            integrationId: integrationAId,
            action: "sync_calendar",
            input: {},
            requiredCapability: "calendar_sync" as unknown as IntegrationCapability,
          },
          testDb
        )
      ).rejects.toThrow(IntegrationError);
    });

    it("should capture and normalize outbound connector errors safely", async () => {
      const result = await executeOutboundConnectorCall(
        {
          organizationId: orgAId,
          integrationId: integrationAId,
          action: "error_action",
          input: {},
        },
        testDb
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Simulated outbound error.");

      const updated = await getOrganizationIntegrationById(
        orgAId,
        integrationAId,
        testDb
      );
      expect(updated.lastErrorAt).toBeDefined();
      expect(updated.lastErrorCode).toBe("OUTBOUND_API_ERROR");
    });

    it("should dispatch jobs asynchronously via InProcessJobDispatcher", async () => {
      const dispatcher = new InProcessJobDispatcher();
      let handled = false;

      const dispatchResult = await dispatcher.dispatch(
        {
          id: "job_123",
          type: "webhook.send",
          organizationId: orgAId,
          payload: { foo: "bar" },
        },
        async () => {
          handled = true;
        }
      );

      expect(dispatchResult.accepted).toBe(true);
      expect(dispatchResult.mode).toBe("in_process");
      // Allow async tick to complete
      await new Promise((r) => setTimeout(r, 10));
      expect(handled).toBe(true);
    });
  });

  // ==========================================
  // 9. ERROR NORMALIZATION & SENSITIVE DATA PROTECTION
  // ==========================================
  describe("9. Error Normalization & Sanitization", () => {
    it("should sanitize bearer tokens and secrets from IntegrationError messages", () => {
      const error = new IntegrationError(
        "AUTHENTICATION_FAILED",
        "Failed request with Bearer secret_token_value123456789 and key=super_secret_api_key",
        { providerKey: "mock_test_connector" }
      );

      expect(error.message).not.toContain("secret_token_value123456789");
      expect(error.message).not.toContain("super_secret_api_key");
      expect(error.message).toContain("[REDACTED]");
    });
  });
});
