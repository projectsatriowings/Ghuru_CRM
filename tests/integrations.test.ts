import { describe, it, expect, beforeAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "@/db/schema";
import { eq } from "drizzle-orm";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { createOrganization } from "@/lib/services/organization.service";
import {
  registerProvider,
  getProviders,
  getProviderById,
  getProviderByKey,
  updateProvider,
} from "@/lib/services/integrations/provider-registry.service";
import {
  createOrganizationIntegration,
  getOrganizationIntegrationById,
  updateOrganizationIntegration,
  toggleIntegrationStatus,
  disconnectOrganizationIntegration,
  testIntegrationConnection,
} from "@/lib/services/integrations/organization-integration.service";
import {
  encryptCredential,
  decryptCredential,
  getDecryptedCredentials,
  maskSecret,
} from "@/lib/services/integrations/credential.service";
import {
  createApiKey,
  getOrganizationApiKeys,
  getApiKeyById,
  revokeApiKey,
  authenticateApiKey,
} from "@/lib/services/integrations/api-key.service";
import {
  createWebhook,
  getWebhookById,
  updateWebhook,
  deleteWebhook,
  getWebhookDeliveries,
  generateWebhookSignature,
} from "@/lib/services/integrations/webhook.service";
import {
  publishIntegrationEvent,
  testWebhookPing,
} from "@/lib/services/integrations/integration-event.service";
import { authenticateApiKeyFromRequest } from "@/lib/context/api-key-auth";
import { NextRequest } from "next/server";
import { ALL_PERMISSION_KEYS } from "@/lib/permissions";
import { createRole } from "@/lib/services/role.service";
import {
  createWebhookSchema,
} from "@/lib/validations/integrations";
import {
  NotFoundError,
  UnauthorizedError,
  ConflictError,
  ValidationError,
} from "@/lib/errors";

describe("Milestone 3.0 — Integration Platform Foundation Test Suite", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let testDb: any;
  let userAId: string;
  let userBId: string;
  let orgAId: string;
  let orgBId: string;

  beforeAll(async () => {
    // 1. Initialize in-memory PGlite instance
    const client = new PGlite();
    testDb = drizzle(client, { schema });

    // 2. Read and apply all DDL migrations from 0000 to 0016
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

    // 3. Pre-create test users
    userAId = crypto.randomUUID();
    userBId = crypto.randomUUID();

    await testDb.insert(schema.users).values([
      {
        id: userAId,
        name: "Admin User A",
        email: "admin-a@org-a.com",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: userBId,
        name: "Admin User B",
        email: "admin-b@org-b.com",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    // 4. Create distinct test organizations
    const orgA = await createOrganization(
      {
        name: "Acme Org A",
        slug: `org-a-${crypto.randomUUID().slice(0, 8)}`,
        userId: userAId,
      },
      testDb
    );
    orgAId = orgA.organization.id;

    const orgB = await createOrganization(
      {
        name: "Beta Org B",
        slug: `org-b-${crypto.randomUUID().slice(0, 8)}`,
        userId: userBId,
      },
      testDb
    );
    orgBId = orgB.organization.id;
  });

  // ==========================================
  // 1. PROVIDER REGISTRY TESTS
  // ==========================================
  describe("1. Integration Provider Registry", () => {
    let testProviderId: string;

    it("should register a new provider with capabilities and configuration schema", async () => {
      const provider = await registerProvider(
        {
          key: "generic_webhook_relay",
          name: "Generic Webhook Relay",
          description: "Relays CRM domain events to external HTTP endpoints",
          category: "communication",
          authType: "hmac",
          capabilities: ["webhook_outbound", "event_push"],
          status: "active",
          configSchema: {
            endpointUrl: { type: "string", required: true },
          },
        },
        testDb
      );

      expect(provider).toBeDefined();
      expect(provider.id).toBeDefined();
      expect(provider.key).toBe("generic_webhook_relay");
      expect(provider.capabilities).toContain("webhook_outbound");
      testProviderId = provider.id;
    });

    it("should reject duplicate provider keys with ConflictError", async () => {
      await expect(
        registerProvider(
          {
            key: "generic_webhook_relay",
            name: "Duplicate Relay",
            category: "custom",
            authType: "none",
            capabilities: [],
            status: "active",
          },
          testDb
        )
      ).rejects.toThrow(ConflictError);
    });

    it("should look up provider by ID and by key", async () => {
      const byId = await getProviderById(testProviderId, testDb);
      expect(byId.name).toBe("Generic Webhook Relay");

      const byKey = await getProviderByKey("generic_webhook_relay", testDb);
      expect(byKey).not.toBeNull();
      expect(byKey?.id).toBe(testProviderId);
    });

    it("should filter providers by category and status", async () => {
      const commProviders = await getProviders(
        { category: "communication" },
        testDb
      );
      expect(commProviders.length).toBeGreaterThanOrEqual(1);

      const emptyFilter = await getProviders({ category: "payments" }, testDb);
      expect(emptyFilter.length).toBe(0);
    });

    it("should update provider metadata", async () => {
      const updated = await updateProvider(
        testProviderId,
        { description: "Updated relay description" },
        testDb
      );
      expect(updated.description).toBe("Updated relay description");
    });
  });

  // ==========================================
  // 2. ORGANIZATION INTEGRATIONS & LIFECYCLE
  // ==========================================
  describe("2. Organization Integration Connections & Lifecycle", () => {
    let providerId: string;
    let integrationAId: string;

    beforeAll(async () => {
      const p = await registerProvider(
        {
          key: "custom_rest_gateway",
          name: "Custom REST Gateway",
          category: "custom",
          authType: "api_key",
          capabilities: ["api_read", "api_write"],
          status: "active",
        },
        testDb
      );
      providerId = p.id;
    });

    it("should create an organization connection in pending state when no credentials provided", async () => {
      const conn = await createOrganizationIntegration(
        orgAId,
        userAId,
        {
          providerId,
          name: "Org A Custom Gateway",
          config: { baseUrl: "https://api.gateway.example.com" },
        },
        testDb
      );

      expect(conn).toBeDefined();
      expect(conn.organizationId).toBe(orgAId);
      expect(conn.status).toBe("pending");
      expect(conn.hasCredentials).toBe(false);
      integrationAId = conn.id;
    });

    it("should store encrypted credentials and transition to connected state", async () => {
      const updated = await updateOrganizationIntegration(
        orgAId,
        integrationAId,
        {
          credentials: {
            credentialType: "api_key",
            secret: "sk_live_super_secret_token_12345",
          },
        },
        testDb
      );

      expect(updated.hasCredentials).toBe(true);
    });

    it("should support test connection action", async () => {
      const testResult = await testIntegrationConnection(
        orgAId,
        integrationAId,
        testDb
      );
      expect(testResult.success).toBe(true);

      const conn = await getOrganizationIntegrationById(
        orgAId,
        integrationAId,
        testDb
      );
      expect(conn.lastSuccessAt).not.toBeNull();
    });

    it("should toggle integration between disabled and enabled states", async () => {
      // Disable
      const disabled = await toggleIntegrationStatus(
        orgAId,
        integrationAId,
        false,
        testDb
      );
      expect(disabled.status).toBe("disabled");

      // Attempting to test disabled connection throws ValidationError
      await expect(
        testIntegrationConnection(orgAId, integrationAId, testDb)
      ).rejects.toThrow(ValidationError);

      // Re-enable
      const enabled = await toggleIntegrationStatus(
        orgAId,
        integrationAId,
        true,
        testDb
      );
      expect(enabled.status).toBe("connected");
    });

    it("should disconnect integration and purge credentials", async () => {
      const disconnected = await disconnectOrganizationIntegration(
        orgAId,
        integrationAId,
        testDb
      );
      expect(disconnected.status).toBe("disconnected");
      expect(disconnected.hasCredentials).toBe(false);

      // Server-side credential lookup returns null
      const secret = await getDecryptedCredentials(
        orgAId,
        integrationAId,
        testDb
      );
      expect(secret).toBeNull();
    });
  });

  // ==========================================
  // 3. SECURE CREDENTIAL ABSTRACTION
  // ==========================================
  describe("3. Secure Credential Abstraction & Encryption", () => {
    it("should encrypt plaintext using AES-256-GCM and decrypt accurately", () => {
      const rawSecret = "my_super_secret_oauth_token_xyz987";
      const encrypted = encryptCredential(rawSecret);

      expect(encrypted).not.toBe(rawSecret);
      expect(encrypted).not.toContain(rawSecret);
      expect(encrypted.split(":").length).toBe(3); // iv:tag:ciphertext

      const decrypted = decryptCredential(encrypted);
      expect(decrypted).toBe(rawSecret);
    });

    it("should safely mask secret strings without leaking token bodies", () => {
      const maskLong = maskSecret("whsec_9876543210fedcba");
      expect(maskLong).toBe("whse****dcba");

      const maskShort = maskSecret("abc");
      expect(maskShort).toBe("****bc");
    });
  });

  // ==========================================
  // 4. STRICT TENANT ISOLATION
  // ==========================================
  describe("4. Strict Tenant Isolation Verification", () => {
    let orgAConnId: string;
    let orgAWebhookId: string;
    let orgAKeyId: string;
    let providerId: string;

    beforeAll(async () => {
      const p = await registerProvider(
        {
          key: "tenant_isolation_provider",
          name: "Tenant Isolation Provider",
          category: "productivity",
          authType: "none",
          capabilities: [],
          status: "active",
        },
        testDb
      );
      providerId = p.id;

      // Create integration in Org A
      const conn = await createOrganizationIntegration(
        orgAId,
        userAId,
        { providerId, name: "Org A Connection" },
        testDb
      );
      orgAConnId = conn.id;

      // Create webhook in Org A
      const wh = await createWebhook(
        orgAId,
        userAId,
        {
          name: "Org A Webhook",
          url: "https://org-a.com/webhook",
          subscribedEvents: ["lead.created"],
        },
        testDb
      );
      orgAWebhookId = wh.id;

      // Create API Key in Org A
      const ak = await createApiKey(
        orgAId,
        userAId,
        {
          name: "Org A Key",
          scopes: ["leads.read"],
        },
        testDb
      );
      orgAKeyId = ak.key.id;
    });

    it("Org B cannot read Org A integration connection", async () => {
      await expect(
        getOrganizationIntegrationById(orgBId, orgAConnId, testDb)
      ).rejects.toThrow(NotFoundError);
    });

    it("Org B cannot update Org A integration connection", async () => {
      await expect(
        updateOrganizationIntegration(
          orgBId,
          orgAConnId,
          { name: "Hacked by Org B" },
          testDb
        )
      ).rejects.toThrow(NotFoundError);
    });

    it("Org B cannot disconnect or delete Org A integration connection", async () => {
      await expect(
        disconnectOrganizationIntegration(orgBId, orgAConnId, testDb)
      ).rejects.toThrow(NotFoundError);
    });

    it("Org B cannot access Org A credentials", async () => {
      const creds = await getDecryptedCredentials(orgBId, orgAConnId, testDb);
      expect(creds).toBeNull();
    });

    it("Org B cannot read or delete Org A webhook", async () => {
      await expect(
        getWebhookById(orgBId, orgAWebhookId, testDb)
      ).rejects.toThrow(NotFoundError);

      await expect(
        deleteWebhook(orgBId, orgAWebhookId, testDb)
      ).rejects.toThrow(NotFoundError);
    });

    it("Org B cannot read or revoke Org A API key", async () => {
      await expect(
        getApiKeyById(orgBId, orgAKeyId, testDb)
      ).rejects.toThrow(NotFoundError);

      await expect(
        revokeApiKey(orgBId, orgAKeyId, testDb)
      ).rejects.toThrow(NotFoundError);
    });
  });

  // ==========================================
  // 5. API KEY SECURITY & AUTHENTICATION
  // ==========================================
  describe("5. API Key Generation, Hashing & Scopes", () => {
    let createdPlaintextSecret: string;
    let apiKeyId: string;

    it("should return plaintext secret only once at creation time", async () => {
      const res = await createApiKey(
        orgAId,
        userAId,
        {
          name: "Analytics Service Key",
          scopes: ["leads.read", "deals.read"],
          expiresInDays: 30,
        },
        testDb
      );

      expect(res.secret).toBeDefined();
      expect(res.secret.startsWith("ghk_live_")).toBe(true);
      expect(res.key.id).toBeDefined();
      expect(res.key.keyPrefix.startsWith("ghk_live_")).toBe(true);
      expect(res.key.scopes).toEqual(["leads.read", "deals.read"]);

      createdPlaintextSecret = res.secret;
      apiKeyId = res.key.id;
    });

    it("should never expose plaintext secret or secret hash in subsequent GET", async () => {
      const fetched = await getApiKeyById(orgAId, apiKeyId, testDb);
      expect(fetched).not.toHaveProperty("secret");
      expect(fetched).not.toHaveProperty("keyHash");
      expect(fetched.keyPrefix).toBeDefined();

      const allKeys = await getOrganizationApiKeys(orgAId, {}, testDb);
      const match = allKeys.find((k) => k.id === apiKeyId);
      expect(match).toBeDefined();
      expect(match).not.toHaveProperty("secret");
      expect(match).not.toHaveProperty("keyHash");
    });

    it("should authenticate active API key and verify scopes", async () => {
      const authCtx = await authenticateApiKey(createdPlaintextSecret, testDb);
      expect(authCtx.isApiKey).toBe(true);
      expect(authCtx.organizationId).toBe(orgAId);
      expect(authCtx.hasScope("leads.read")).toBe(true);
      expect(authCtx.hasScope("deals.read")).toBe(true);
      expect(authCtx.hasScope("deals.write")).toBe(false);
    });

    it("should reject invalid, malformed, or fake API keys", async () => {
      await expect(authenticateApiKey("not_a_key", testDb)).rejects.toThrow(
        UnauthorizedError
      );
      await expect(
        authenticateApiKey("ghk_live_fake_key_0000000000000000", testDb)
      ).rejects.toThrow(UnauthorizedError);
    });

    it("should reject revoked API keys immediately", async () => {
      await revokeApiKey(orgAId, apiKeyId, testDb);

      await expect(
        authenticateApiKey(createdPlaintextSecret, testDb)
      ).rejects.toThrow("API key has been revoked.");
    });

    it("should reject expired API keys", async () => {
      // Create key expired yesterday
      const expiredRes = await createApiKey(
        orgAId,
        userAId,
        {
          name: "Expired Key",
          scopes: ["leads.read"],
        },
        testDb
      );

      // Manually backdate expiration in DB
      await testDb
        .update(schema.apiKeys)
        .set({ expiresAt: new Date(Date.now() - 86400000) })
        .where(eq(schema.apiKeys.id, expiredRes.key.id));

      await expect(
        authenticateApiKey(expiredRes.secret, testDb)
      ).rejects.toThrow("API key has expired.");
    });
  });

  // ==========================================
  // 6. OUTBOUND WEBHOOKS & HMAC SIGNING
  // ==========================================
  describe("6. Outbound Webhooks & HMAC Signatures", () => {
    let webhookId: string;
    let webhookSecret: string;

    it("should validate webhook destination URL", () => {
      expect(() =>
        createWebhookSchema.parse({
          name: "Invalid URL Webhook",
          url: "not-a-valid-url",
          subscribedEvents: ["lead.created"],
        })
      ).toThrow();

      expect(() =>
        createWebhookSchema.parse({
          name: "Valid Webhook",
          url: "https://api.example.com/events",
          subscribedEvents: ["lead.created"],
        })
      ).not.toThrow();
    });

    it("should create webhook with masked secret in query and full secret once at creation", async () => {
      const created = await createWebhook(
        orgAId,
        userAId,
        {
          name: "Outbound Lead Dispatcher",
          url: "https://webhook.site/test-org-a",
          subscribedEvents: ["lead.created", "deal.won"],
        },
        testDb
      );

      expect(created.id).toBeDefined();
      expect(created.secret.startsWith("whsec_")).toBe(true);
      expect(created.secretMasked.startsWith("whse****")).toBe(true);

      webhookId = created.id;
      webhookSecret = created.secret;
    });

    it("should compute deterministic HMAC-SHA256 signature for payload verification", () => {
      const timestamp = 1710000000;
      const payload = JSON.stringify({ event: "lead.created", id: "lead_123" });
      const sig = generateWebhookSignature(payload, webhookSecret, timestamp);

      expect(sig.startsWith("t=1710000000,v1=")).toBe(true);

      // Verify recipient HMAC computation matches
      const expectedHmac = crypto
        .createHmac("sha256", webhookSecret)
        .update(`${timestamp}.${payload}`)
        .digest("hex");

      expect(sig).toBe(`t=${timestamp},v1=${expectedHmac}`);
    });

    it("should update webhook URL and event subscriptions", async () => {
      const updated = await updateWebhook(
        orgAId,
        webhookId,
        {
          subscribedEvents: ["lead.created", "lead.updated", "deal.won"],
        },
        testDb
      );

      expect(updated.subscribedEvents).toContain("lead.updated");
    });
  });

  // ==========================================
  // 7. GENERIC CRM INTEGRATION EVENTS & DELIVERIES
  // ==========================================
  describe("7. Generic Integration Events & Idempotency", () => {
    let subscribedWebhookId: string;

    beforeAll(async () => {
      const wh = await createWebhook(
        orgAId,
        userAId,
        {
          name: "Deal Lifecycle Listener",
          url: "https://example.com/deal-listener",
          subscribedEvents: ["deal.won"],
        },
        testDb
      );
      subscribedWebhookId = wh.id;
    });

    it("should match active webhook subscriptions and create delivery records without blocking", async () => {
      const stableEventId = crypto.randomUUID();

      const result = await publishIntegrationEvent(
        {
          id: stableEventId,
          organizationId: orgAId,
          eventType: "deal.won",
          entityType: "deal",
          entityId: "deal_999",
          payload: { dealName: "Enterprise Tier Contract", amount: 50000 },
          metadata: { actorUserId: userAId },
        },
        testDb
      );

      expect(result.eventId).toBe(stableEventId);
      expect(result.matchedWebhooksCount).toBeGreaterThanOrEqual(1);
      expect(result.deliveryIds.length).toBeGreaterThanOrEqual(1);

      // Verify delivery record was created in database
      const deliveries = await getWebhookDeliveries(
        orgAId,
        subscribedWebhookId,
        10,
        testDb
      );

      const matchingDelivery = deliveries.find(
        (d) => d.eventId === stableEventId
      );
      expect(matchingDelivery).toBeDefined();
      expect(matchingDelivery?.eventType).toBe("deal.won");
      expect(matchingDelivery?.status).toBe("pending");
      expect(matchingDelivery?.attemptCount).toBe(0);
    });

    it("should ignore webhooks that do not match the published event type", async () => {
      await publishIntegrationEvent(
        {
          organizationId: orgAId,
          eventType: "unsubscribed.topic",
          entityType: "custom",
          entityId: "custom_1",
          payload: {},
        },
        testDb
      );

      // Deal Lifecycle Listener only subscribes to "deal.won"
      // Any generic wildcard webhook might match, but if only deal.won is subscribed, matchedCount is 0
      const deliveries = await getWebhookDeliveries(
        orgAId,
        subscribedWebhookId,
        10,
        testDb
      );
      const match = deliveries.find(
        (d) => d.eventType === "unsubscribed.topic"
      );
      expect(match).toBeUndefined();
    });

    it("should enforce tenant isolation for integration events", async () => {
      // Event published in Org B should NEVER create delivery records for Org A webhooks
      await publishIntegrationEvent(
        {
          organizationId: orgBId,
          eventType: "deal.won",
          entityType: "deal",
          entityId: "deal_org_b",
          payload: { dealName: "Org B Deal" },
        },
        testDb
      );

      // Org A's webhook should not have received this event
      const deliveries = await getWebhookDeliveries(
        orgAId,
        subscribedWebhookId,
        20,
        testDb
      );
      const crossTenantDelivery = deliveries.find(
        (d) => (d.payload as Record<string, unknown>)?.entityId === "deal_org_b"
      );
      expect(crossTenantDelivery).toBeUndefined();
    });
  });

  // ==========================================
  // 8. RBAC PERMISSIONS VERIFICATION
  // ==========================================
  describe("8. RBAC & Integration Permissions", () => {
    it("should include all new integration permissions in ALL_PERMISSION_KEYS", () => {
      const expectedPerms = [
        "integrations.view",
        "integrations.connect",
        "integrations.update",
        "integrations.disconnect",
        "integrations.test",
        "webhooks.manage",
        "api_keys.manage",
      ];

      for (const perm of expectedPerms) {
        expect(ALL_PERMISSION_KEYS).toContain(perm);
      }
    });

    it("should allow creating custom role with specific integration permissions", async () => {
      const customRole = await createRole(
        {
          organizationId: orgAId,
          name: "Integration Specialist",
          description: "Can view and test integrations only",
          permissionKeys: ["integrations.view", "integrations.test"],
        },
        testDb
      );

      const permKeys = customRole.permissions.map((p) => p.key);
      expect(permKeys).toContain("integrations.view");
      expect(permKeys).toContain("integrations.test");
      expect(permKeys).not.toContain("integrations.connect");
      expect(permKeys).not.toContain("api_keys.manage");
    });
  });

  // ==========================================
  // 9. API KEY REQUEST AUTH ABSTRACTION
  // ==========================================
  describe("9. API Key Request Authentication Abstraction", () => {
    let rawTestKey: string;

    beforeAll(async () => {
      const res = await createApiKey(
        orgAId,
        userAId,
        {
          name: "Header Test Key",
          scopes: ["leads.read", "deals.write"],
        },
        testDb
      );
      rawTestKey = res.secret;
    });

    it("should authenticate Bearer token from NextRequest Authorization header", async () => {
      const req = new NextRequest("https://api.example.com/api/v1/leads", {
        headers: {
          authorization: `Bearer ${rawTestKey}`,
        },
      });

      const authCtx = await authenticateApiKeyFromRequest(req, "leads.read", testDb);
      expect(authCtx.isApiKey).toBe(true);
      expect(authCtx.organizationId).toBe(orgAId);
      expect(authCtx.hasScope("leads.read")).toBe(true);
    });

    it("should authenticate x-api-key header from NextRequest", async () => {
      const req = new NextRequest("https://api.example.com/api/v1/deals", {
        headers: {
          "x-api-key": rawTestKey,
        },
      });

      const authCtx = await authenticateApiKeyFromRequest(req, "deals.write", testDb);
      expect(authCtx.isApiKey).toBe(true);
      expect(authCtx.hasScope("deals.write")).toBe(true);
    });

    it("should reject request when required scope is missing", async () => {
      const req = new NextRequest("https://api.example.com/api/v1/webhooks", {
        headers: {
          authorization: `Bearer ${rawTestKey}`,
        },
      });

      await expect(
        authenticateApiKeyFromRequest(req, "webhooks.write", testDb)
      ).rejects.toThrow("Forbidden: API key does not have required scope [webhooks.write].");
    });
  });

  // ==========================================
  // 10. WEBHOOK TEST PING
  // ==========================================
  describe("10. Webhook Test Ping Diagnostics", () => {
    it("should record test ping delivery attempt without throwing", async () => {
      const wh = await createWebhook(
        orgAId,
        userAId,
        {
          name: "Diagnostics Webhook",
          url: "https://httpbin.org/post",
          subscribedEvents: ["*"],
        },
        testDb
      );

      const pingResult = await testWebhookPing(orgAId, wh.id, testDb);
      expect(pingResult.deliveryId).toBeDefined();
      expect(pingResult.eventId).toBeDefined();

      const deliveries = await getWebhookDeliveries(orgAId, wh.id, 5, testDb);
      const pingDelivery = deliveries.find((d) => d.id === pingResult.deliveryId);
      expect(pingDelivery).toBeDefined();
      expect(pingDelivery?.eventType).toBe("test.ping");
    });
  });
});
