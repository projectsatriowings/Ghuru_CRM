import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { createOrganization } from "@/lib/services/organization.service";
import { registerProvider } from "@/lib/services/integrations/provider-registry.service";
import {
  createOrganizationIntegration,
  testIntegrationConnection,
} from "@/lib/services/integrations/organization-integration.service";
import {
  whatsAppConnector,
  normalizeWhatsAppPhoneNumber,
} from "@/lib/connectors/whatsapp/whatsapp-connector";
import { connectorRegistry } from "@/lib/integrations/connectors/connector-registry";
import {
  findOrCreateConversation,
  getConversations,
  getConversationById,
  getMessages,
  sendMessage,
  saveInboundMessage,
} from "@/lib/services/messaging/messaging.service";
import {
  processInboundWebhook,
  verifyWebhookChallenge,
} from "@/lib/services/integrations/inbound-webhook.service";
import { IntegrationError } from "@/lib/services/integrations/integration-errors";
import { NotFoundError, ValidationError } from "@/lib/errors";

describe("Milestone 3.2A — Messaging Channel Foundation + WhatsApp Cloud API Connector Test Suite", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let testDb: any;
  let userAId: string;
  let userBId: string;
  let orgAId: string;
  let orgBId: string;

  let whatsappProviderId: string;
  let integrationAId: string;
  let integrationBId: string;

  const testAppSecret = "mock_meta_app_secret_abc123";
  const testVerifyToken = "mock_hub_verify_token_xyz987";
  const testPhoneNumberId = "100609346426456";
  const testAccessToken = "EAA_mock_whatsapp_access_token_token";

  beforeAll(async () => {
    // 1. Initialize PGlite instance
    const client = new PGlite();
    testDb = drizzle(client, { schema });

    // 2. Run migrations 0000 to 0018
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
        name: "Workspace Alpha",
        slug: `alpha-${crypto.randomUUID().slice(0, 8)}`,
        userId: userAId,
      },
      testDb
    );
    orgAId = orgA.organization.id;

    const orgB = await createOrganization(
      {
        name: "Workspace Beta",
        slug: `beta-${crypto.randomUUID().slice(0, 8)}`,
        userId: userBId,
      },
      testDb
    );
    orgBId = orgB.organization.id;

    // 5. Register WhatsApp Provider in system catalog
    const registered = await registerProvider(
      {
        key: "whatsapp",
        name: "WhatsApp Cloud API",
        category: "communication",
        authType: "api_key",
        capabilities: ["webhook_inbound", "api_write", "message_send", "outbound_api"],
        status: "active",
      },
      testDb
    );
    whatsappProviderId = registered.id;

    // 6. Connect WhatsApp in Org A
    const connA = await createOrganizationIntegration(
      orgAId,
      userAId,
      {
        providerId: whatsappProviderId,
        name: "Production WhatsApp",
        config: {
          phoneNumberId: testPhoneNumberId,
          verifyToken: testVerifyToken,
          apiVersion: "v20.0",
        },
        credentials: {
          credentialType: "api_key",
          secret: JSON.stringify({
            accessToken: testAccessToken,
            appSecret: testAppSecret,
            verifyToken: testVerifyToken,
          }),
        },
      },
      testDb
    );
    integrationAId = connA.id;

    // 7. Connect WhatsApp in Org B
    const connB = await createOrganizationIntegration(
      orgBId,
      userBId,
      {
        providerId: whatsappProviderId,
        name: "Beta WhatsApp",
        config: {
          phoneNumberId: "100609346499999",
          verifyToken: "beta_verify_token",
        },
        credentials: {
          credentialType: "api_key",
          secret: JSON.stringify({
            accessToken: "beta_access_token",
            appSecret: "beta_app_secret",
            verifyToken: "beta_verify_token",
          }),
        },
      },
      testDb
    );
    integrationBId = connB.id;

    // 8. Register WhatsApp connector
    connectorRegistry.register(whatsAppConnector);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================
  // 1. GENERIC MESSAGING SERVICE TESTS
  // ==========================================
  describe("1. Generic Messaging Service Foundation", () => {
    it("should find or create a conversation with normalized phone number", async () => {
      const conv = await findOrCreateConversation(
        orgAId,
        integrationAId,
        "whatsapp",
        "+1 (631) 555-0199",
        { participantName: "Alice Walker" },
        testDb
      );

      expect(conv).toBeDefined();
      expect(conv.organizationId).toBe(orgAId);
      expect(conv.integrationId).toBe(integrationAId);
      expect(conv.channel).toBe("whatsapp");
      expect(conv.participantId).toBe("16315550199");
      expect(conv.participantName).toBe("Alice Walker");
      expect(conv.status).toBe("active");

      // Finding again returns the identical record
      const convRepeat = await findOrCreateConversation(
        orgAId,
        integrationAId,
        "whatsapp",
        "16315550199",
        {},
        testDb
      );
      expect(convRepeat.id).toBe(conv.id);
    });

    it("should retrieve paginated conversations within organization", async () => {
      const res = await getConversations(orgAId, { page: 1, pageSize: 10 }, testDb);
      expect(res.total).toBeGreaterThanOrEqual(1);
      expect(res.items.some((c) => c.organizationId === orgAId)).toBe(true);
      expect(res.items.every((c) => c.organizationId === orgAId)).toBe(true);
    });

    it("should retrieve conversation by ID and enforce tenant isolation", async () => {
      const convA = await findOrCreateConversation(
        orgAId,
        integrationAId,
        "whatsapp",
        "15551234567",
        {},
        testDb
      );

      const found = await getConversationById(orgAId, convA.id, testDb);
      expect(found.id).toBe(convA.id);

      // Org B cannot access Org A conversation
      await expect(
        getConversationById(orgBId, convA.id, testDb)
      ).rejects.toThrow(NotFoundError);
    });

    it("should retrieve messages for a conversation in chronological order", async () => {
      const conv = await findOrCreateConversation(
        orgAId,
        integrationAId,
        "whatsapp",
        "15559876543",
        {},
        testDb
      );

      await saveInboundMessage(
        {
          organizationId: orgAId,
          integrationId: integrationAId,
          channel: "whatsapp",
          externalMessageId: "wamid.msg1",
          sender: "15559876543",
          recipient: testPhoneNumberId,
          body: "First message",
          timestamp: new Date(Date.now() - 5000),
        },
        testDb
      );

      await saveInboundMessage(
        {
          organizationId: orgAId,
          integrationId: integrationAId,
          channel: "whatsapp",
          externalMessageId: "wamid.msg2",
          sender: "15559876543",
          recipient: testPhoneNumberId,
          body: "Second message",
          timestamp: new Date(),
        },
        testDb
      );

      const res = await getMessages(orgAId, conv.id, { page: 1, pageSize: 10 }, testDb);
      expect(res.total).toBe(2);
      expect(res.items[0]?.body).toBe("First message");
      expect(res.items[1]?.body).toBe("Second message");
    });
  });

  // ==========================================
  // 2. WHATSAPP CONNECTOR ADAPTER TESTS
  // ==========================================
  describe("2. WhatsApp Cloud API Connector Adapter", () => {
    it("should validate phone number normalization helper", () => {
      expect(normalizeWhatsAppPhoneNumber("+1 (800) 555-0123")).toBe("18005550123");
      expect(normalizeWhatsAppPhoneNumber("44-7911-123456")).toBe("447911123456");
      expect(normalizeWhatsAppPhoneNumber("+91 98765 43210")).toBe("919876543210");
    });

    it("should validate connector metadata and capability declarations", () => {
      expect(whatsAppConnector.providerKey).toBe("whatsapp");
      expect(whatsAppConnector.name).toBe("WhatsApp Cloud API");
      expect(whatsAppConnector.capabilities).toContain("inbound_webhook");
      expect(whatsAppConnector.capabilities).toContain("outbound_api");
      expect(whatsAppConnector.capabilities).toContain("message_send");
      expect(whatsAppConnector.authType).toBe("api_key");
    });

    it("should test connection successfully with valid mock response", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            verified_name: "Ghuru Test Business",
            display_phone_number: "+1 555-0234567",
            id: testPhoneNumberId,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );

      const health = await whatsAppConnector.testConnection({
        organizationId: orgAId,
        integrationId: integrationAId,
        config: { phoneNumberId: testPhoneNumberId },
        credentials: { accessToken: testAccessToken },
        dbInstance: testDb,
      });

      expect(health.success).toBe(true);
      expect(health.message).toContain("verified successfully");
    });

    it("should report failure when Meta Graph API returns an error on testConnection", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: {
              message: "Invalid OAuth access token.",
              type: "OAuthException",
              code: 190,
            },
          }),
          { status: 401, headers: { "Content-Type": "application/json" } }
        )
      );

      const health = await whatsAppConnector.testConnection({
        organizationId: orgAId,
        integrationId: integrationAId,
        config: { phoneNumberId: testPhoneNumberId },
        credentials: { accessToken: "expired_token" },
        dbInstance: testDb,
      });

      expect(health.success).toBe(false);
      expect(health.message).toContain("Invalid OAuth access token");
    });

    it("should execute outbound text message send via executeOutboundApi", async () => {
      const mockWamid = "wamid.HBgLMTU1NTAyMzQ1NjcVAgARGBI1MjA3QTN";

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            messaging_product: "whatsapp",
            contacts: [{ input: "16315550199", wa_id: "16315550199" }],
            messages: [{ id: mockWamid }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );

      const result = await whatsAppConnector.executeOutboundApi({
        organizationId: orgAId,
        integrationId: integrationAId,
        action: "send_message",
        input: {
          to: "+1 (631) 555-0199",
          text: "Hello from Ghuru CRM connector test!",
        },
        config: { phoneNumberId: testPhoneNumberId },
        credentials: { accessToken: testAccessToken },
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        externalMessageId: mockWamid,
        recipient: "16315550199",
      });
    });

    it("should map Meta rate limit errors to normalized RATE_LIMITED IntegrationError", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: {
              message: "(#4) Application request limit reached",
              type: "OAuthException",
              code: 4,
            },
          }),
          { status: 429, headers: { "Content-Type": "application/json" } }
        )
      );

      await expect(
        whatsAppConnector.executeOutboundApi({
          organizationId: orgAId,
          integrationId: integrationAId,
          action: "send_message",
          input: {
            to: "16315550199",
            text: "Rate limited message",
          },
          config: { phoneNumberId: testPhoneNumberId },
          credentials: { accessToken: testAccessToken },
        })
      ).rejects.toThrow(IntegrationError);
    });
  });

  // ==========================================
  // 3. WEBHOOK VERIFICATION & CHALLENGE TESTS
  // ==========================================
  describe("3. Inbound Webhook Verification & Challenge Handshake", () => {
    it("should successfully verify Meta GET webhook challenge handshake", async () => {
      const result = await verifyWebhookChallenge(
        integrationAId,
        {
          query: {
            "hub.mode": "subscribe",
            "hub.verify_token": testVerifyToken,
            "hub.challenge": "1158201444",
          },
        },
        testDb
      );

      expect(result.success).toBe(true);
      expect(result.challenge).toBe("1158201444");
    });

    it("should reject Meta GET challenge when verify token does not match", async () => {
      const result = await verifyWebhookChallenge(
        integrationAId,
        {
          query: {
            "hub.mode": "subscribe",
            "hub.verify_token": "wrong_verify_token",
            "hub.challenge": "1158201444",
          },
        },
        testDb
      );

      expect(result.success).toBe(false);
      expect(result.reason).toContain("mismatch");
    });

    it("should verify valid X-Hub-Signature-256 HMAC digest on POST request", async () => {
      const payload = JSON.stringify({ test: "meta_payload" });
      const signature = crypto
        .createHmac("sha256", testAppSecret)
        .update(payload)
        .digest("hex");

      const verification = await whatsAppConnector.verifyInboundWebhook!({
        rawBody: payload,
        headers: { "x-hub-signature-256": `sha256=${signature}` },
        secret: testAppSecret,
      });

      expect(verification.valid).toBe(true);
    });

    it("should reject invalid X-Hub-Signature-256 signature", async () => {
      const payload = JSON.stringify({ test: "tampered_payload" });
      const invalidSignature = "sha256=0000000000000000000000000000000000000000000000000000000000000000";

      const verification = await whatsAppConnector.verifyInboundWebhook!({
        rawBody: payload,
        headers: { "x-hub-signature-256": invalidSignature },
        secret: testAppSecret,
      });

      expect(verification.valid).toBe(false);
      expect(verification.reason).toBeDefined();
    });
  });

  // ==========================================
  // 4. INBOUND PAYLOAD NORMALIZATION & IDEMPOTENCY
  // ==========================================
  describe("4. Inbound Message Normalization, Idempotency & Delivery", () => {
    it("should process inbound WhatsApp webhook and persist conversation & message", async () => {
      const wamid = `wamid.test_${crypto.randomUUID()}`;
      const payload = JSON.stringify({
        object: "whatsapp_business_account",
        entry: [
          {
            id: "WABA_123",
            changes: [
              {
                value: {
                  messaging_product: "whatsapp",
                  metadata: {
                    display_phone_number: "+1 555-0234567",
                    phone_number_id: testPhoneNumberId,
                  },
                  contacts: [
                    {
                      profile: { name: "Bob Martin" },
                      wa_id: "16315559988",
                    },
                  ],
                  messages: [
                    {
                      from: "16315559988",
                      id: wamid,
                      timestamp: Math.floor(Date.now() / 1000).toString(),
                      type: "text",
                      text: { body: "I am interested in your services." },
                    },
                  ],
                },
                field: "messages",
              },
            ],
          },
        ],
      });

      const signature = crypto
        .createHmac("sha256", testAppSecret)
        .update(payload)
        .digest("hex");

      const result = await processInboundWebhook(
        integrationAId,
        {
          rawBody: payload,
          headers: { "x-hub-signature-256": `sha256=${signature}` },
        },
        testDb
      );

      expect(result.success).toBe(true);
      expect(result.duplicate).toBe(false);
      expect(result.eventsProcessed).toBe(1);

      // Verify conversation created
      const conv = await findOrCreateConversation(
        orgAId,
        integrationAId,
        "whatsapp",
        "16315559988",
        {},
        testDb
      );
      expect(conv.participantName).toBe("Bob Martin");

      // Verify message created
      const messagesRes = await getMessages(orgAId, conv.id, { page: 1, pageSize: 10 }, testDb);
      const savedMsg = messagesRes.items.find((m) => m.externalMessageId === wamid);
      expect(savedMsg).toBeDefined();
      expect(savedMsg?.body).toBe("I am interested in your services.");
      expect(savedMsg?.direction).toBe("inbound");
      expect(savedMsg?.status).toBe("delivered");
    });

    it("should enforce idempotency when same inbound WhatsApp message is retried", async () => {
      const wamid = `wamid.retry_${crypto.randomUUID()}`;
      const payload = JSON.stringify({
        object: "whatsapp_business_account",
        entry: [
          {
            id: "WABA_123",
            changes: [
              {
                value: {
                  messaging_product: "whatsapp",
                  metadata: {
                    display_phone_number: "+1 555-0234567",
                    phone_number_id: testPhoneNumberId,
                  },
                  messages: [
                    {
                      from: "16315557766",
                      id: wamid,
                      timestamp: Math.floor(Date.now() / 1000).toString(),
                      type: "text",
                      text: { body: "Testing idempotency retry delivery" },
                    },
                  ],
                },
                field: "messages",
              },
            ],
          },
        ],
      });

      const signature = crypto
        .createHmac("sha256", testAppSecret)
        .update(payload)
        .digest("hex");

      // First delivery
      const res1 = await processInboundWebhook(
        integrationAId,
        {
          rawBody: payload,
          headers: { "x-hub-signature-256": `sha256=${signature}` },
        },
        testDb
      );
      expect(res1.success).toBe(true);
      expect(res1.duplicate).toBe(false);

      // Second delivery (retry)
      const res2 = await processInboundWebhook(
        integrationAId,
        {
          rawBody: payload,
          headers: { "x-hub-signature-256": `sha256=${signature}` },
        },
        testDb
      );
      expect(res2.success).toBe(true);
      expect(res2.duplicate).toBe(true);

      // Check messages count is exactly 1 (no duplicate messages in DB)
      const conv = await findOrCreateConversation(
        orgAId,
        integrationAId,
        "whatsapp",
        "16315557766",
        {},
        testDb
      );
      const messagesRes = await getMessages(orgAId, conv.id, { page: 1, pageSize: 50 }, testDb);
      const matchingMessages = messagesRes.items.filter((m) => m.externalMessageId === wamid);
      expect(matchingMessages.length).toBe(1);
    });

    it("should normalize and handle message delivery status events without duplicating messages", async () => {
      // 1. Pre-insert outbound message
      const conv = await findOrCreateConversation(
        orgAId,
        integrationAId,
        "whatsapp",
        "16315554321",
        {},
        testDb
      );

      const statusWamid = `wamid.status_test_${crypto.randomUUID()}`;
      await testDb.insert(schema.messages).values({
        id: crypto.randomUUID(),
        organizationId: orgAId,
        conversationId: conv.id,
        integrationId: integrationAId,
        channel: "whatsapp",
        direction: "outbound",
        messageType: "text",
        externalMessageId: statusWamid,
        sender: testPhoneNumberId,
        recipient: "16315554321",
        body: "Outbound message waiting for delivery",
        status: "sent",
        sentAt: new Date(),
      });

      // 2. Deliver "delivered" status update via webhook
      const statusPayload = JSON.stringify({
        object: "whatsapp_business_account",
        entry: [
          {
            id: "WABA_123",
            changes: [
              {
                value: {
                  messaging_product: "whatsapp",
                  metadata: {
                    display_phone_number: "+1 555-0234567",
                    phone_number_id: testPhoneNumberId,
                  },
                  statuses: [
                    {
                      id: statusWamid,
                      status: "delivered",
                      timestamp: Math.floor(Date.now() / 1000).toString(),
                      recipient_id: "16315554321",
                    },
                  ],
                },
                field: "messages",
              },
            ],
          },
        ],
      });

      const signature = crypto
        .createHmac("sha256", testAppSecret)
        .update(statusPayload)
        .digest("hex");

      const statusResult = await processInboundWebhook(
        integrationAId,
        {
          rawBody: statusPayload,
          headers: { "x-hub-signature-256": `sha256=${signature}` },
        },
        testDb
      );

      expect(statusResult.success).toBe(true);

      // Verify message status transitioned to "delivered"
      const messagesRes = await getMessages(orgAId, conv.id, { page: 1, pageSize: 10 }, testDb);
      const updatedMsg = messagesRes.items.find((m) => m.externalMessageId === statusWamid);
      expect(updatedMsg?.status).toBe("delivered");
      expect(updatedMsg?.deliveredAt).toBeDefined();

      // Verify no new message was created
      expect(messagesRes.total).toBe(1);
    });
  });

  // ==========================================
  // 5. CONTACT & LEAD MATCHING TESTS
  // ==========================================
  describe("5. CRM Contact & Lead Phone Number Association", () => {
    it("should associate conversation with existing contact when phone matches in same tenant", async () => {
      const contactId = crypto.randomUUID();
      await testDb.insert(schema.contacts).values({
        id: contactId,
        organizationId: orgAId,
        firstName: "Carol",
        lastName: "Danvers",
        phone: "+1 (631) 555-7000",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const conv = await findOrCreateConversation(
        orgAId,
        integrationAId,
        "whatsapp",
        "16315557000",
        {},
        testDb
      );

      expect(conv.contactId).toBe(contactId);
      expect(conv.leadId).toBeNull();
    });

    it("should associate conversation with existing lead when phone matches and no contact exists", async () => {
      const leadId = crypto.randomUUID();
      await testDb.insert(schema.leads).values({
        id: leadId,
        organizationId: orgAId,
        firstName: "Peter",
        lastName: "Parker",
        phone: "+1 631 555 8000",
        source: "other",
        status: "new",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const conv = await findOrCreateConversation(
        orgAId,
        integrationAId,
        "whatsapp",
        "16315558000",
        {},
        testDb
      );

      expect(conv.leadId).toBe(leadId);
      expect(conv.contactId).toBeNull();
    });

    it("should NEVER associate with contacts or leads belonging to another organization", async () => {
      const orgBContactId = crypto.randomUUID();
      await testDb.insert(schema.contacts).values({
        id: orgBContactId,
        organizationId: orgBId,
        firstName: "Beta",
        lastName: "Exclusive",
        phone: "+1 631 555 9999",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // An inbound conversation in Org A for the same phone number must not link Org B's contact
      const convA = await findOrCreateConversation(
        orgAId,
        integrationAId,
        "whatsapp",
        "16315559999",
        {},
        testDb
      );

      expect(convA.contactId).toBeNull();
      expect(convA.leadId).toBeNull();
    });
  });

  // ==========================================
  // 6. OUTBOUND MESSAGE SENDING & IDEMPOTENCY
  // ==========================================
  describe("6. Outbound Message Pipeline & Idempotency", () => {
    it("should successfully send an outbound message and log polymorphic activity", async () => {
      const conv = await findOrCreateConversation(
        orgAId,
        integrationAId,
        "whatsapp",
        "16315553333",
        {},
        testDb
      );

      const generatedWamid = "wamid.outbound_123456";

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            messaging_product: "whatsapp",
            messages: [{ id: generatedWamid }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );

      const sendRes = await sendMessage(
        orgAId,
        conv.id,
        { text: "Outbound proposal follow-up" },
        userAId,
        testDb
      );

      expect(sendRes.status).toBe("sent");
      expect(sendRes.externalMessageId).toBe(generatedWamid);
      expect(sendRes.message.body).toBe("Outbound proposal follow-up");
      expect(sendRes.message.status).toBe("sent");
    });

    it("should support outbound idempotency using idempotencyKey", async () => {
      const conv = await findOrCreateConversation(
        orgAId,
        integrationAId,
        "whatsapp",
        "16315554444",
        {},
        testDb
      );

      const generatedWamid = "wamid.idempotent_123";

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            messaging_product: "whatsapp",
            messages: [{ id: generatedWamid }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );

      const send1 = await sendMessage(
        orgAId,
        conv.id,
        { text: "Single delivery message", idempotencyKey: "idem_key_unique_1" },
        userAId,
        testDb
      );

      // Repeat with same idempotency key (fetch should NOT be called again)
      const send2 = await sendMessage(
        orgAId,
        conv.id,
        { text: "Single delivery message", idempotencyKey: "idem_key_unique_1" },
        userAId,
        testDb
      );

      expect(send1.message.id).toBe(send2.message.id);
      expect(send2.status).toBe("sent");

      const msgs = await getMessages(orgAId, conv.id, { page: 1, pageSize: 20 }, testDb);
      expect(msgs.total).toBe(1);
    });

    it("should reject sending messages in an archived conversation", async () => {
      const conv = await findOrCreateConversation(
        orgAId,
        integrationAId,
        "whatsapp",
        "16315555555",
        {},
        testDb
      );

      // Archive conversation
      await testDb
        .update(schema.conversations)
        .set({ status: "archived" })
        .where(eq(schema.conversations.id, conv.id));

      await expect(
        sendMessage(
          orgAId,
          conv.id,
          { text: "This should fail" },
          userAId,
          testDb
        )
      ).rejects.toThrow(ValidationError);
    });
  });

  // ==========================================
  // 7. SECURITY & TENANT ISOLATION TESTS
  // ==========================================
  describe("7. Security & Multi-Tenant Isolation", () => {
    it("should reject cross-tenant conversation querying", async () => {
      const convA = await findOrCreateConversation(
        orgAId,
        integrationAId,
        "whatsapp",
        "16315556666",
        {},
        testDb
      );

      await expect(
        getMessages(orgBId, convA.id, { page: 1, pageSize: 10 }, testDb)
      ).rejects.toThrow(NotFoundError);
    });

    it("should reject outbound message sending using another organization's integration", async () => {
      // Create conversation in Org A maliciously mapped to Org B's integration
      const convCross = await testDb
        .insert(schema.conversations)
        .values({
          id: crypto.randomUUID(),
          organizationId: orgAId,
          integrationId: integrationBId,
          channel: "whatsapp",
          participantId: "16315558877",
          status: "active",
        })
        .returning();

      await expect(
        sendMessage(
          orgAId,
          convCross[0]!.id,
          { text: "Cross tenant hijack attempt" },
          userAId,
          testDb
        )
      ).rejects.toThrow(NotFoundError);
    });

    it("should never leak credentials or secrets in connection test responses", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            verified_name: "Ghuru Test",
            id: testPhoneNumberId,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );

      const testResult = await testIntegrationConnection(orgAId, integrationAId, testDb);
      expect(testResult.success).toBe(true);

      const jsonStr = JSON.stringify(testResult);
      expect(jsonStr).not.toContain(testAccessToken);
      expect(jsonStr).not.toContain(testAppSecret);
    });

    it("should reject inbound webhooks targeted at disabled integrations", async () => {
      // Disable integration
      await testDb
        .update(schema.organizationIntegrations)
        .set({ status: "disabled" })
        .where(eq(schema.organizationIntegrations.id, integrationAId));

      await expect(
        processInboundWebhook(
          integrationAId,
          {
            rawBody: JSON.stringify({ test: "data" }),
            headers: {},
          },
          testDb
        )
      ).rejects.toThrow(IntegrationError);

      // Re-enable for subsequent tests
      await testDb
        .update(schema.organizationIntegrations)
        .set({ status: "connected" })
        .where(eq(schema.organizationIntegrations.id, integrationAId));
    });

    it("should handle Meta API outbound send failures gracefully and mark message failed", async () => {
      const conv = await findOrCreateConversation(
        orgAId,
        integrationAId,
        "whatsapp",
        "16315551122",
        {},
        testDb
      );

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: {
              message: "(#131009) Parameter value is not valid",
              type: "OAuthException",
              code: 131009,
            },
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        )
      );

      await expect(
        sendMessage(
          orgAId,
          conv.id,
          { text: "Invalid parameter payload" },
          userAId,
          testDb
        )
      ).rejects.toThrow(IntegrationError);

      const msgs = await getMessages(orgAId, conv.id, { page: 1, pageSize: 10 }, testDb);
      const failedMsg = msgs.items.find((m) => m.body === "Invalid parameter payload");
      expect(failedMsg?.status).toBe("failed");
      expect(failedMsg?.failedAt).toBeDefined();
    });

    it("should reject conversation lookup for nonexistent conversation ID", async () => {
      await expect(
        getConversationById(orgAId, "nonexistent-conversation-uuid", testDb)
      ).rejects.toThrow(NotFoundError);
    });
  });
});

