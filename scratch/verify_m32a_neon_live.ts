import { db } from "@/db";
import {
  organizations,
  users,
  contacts,
  integrationProviders,
  organizationIntegrations,
  integrationCredentials,
  conversations,
  messages,
} from "@/db/schema";
import { createOrganization } from "@/lib/services/organization.service";
import { registerProvider, getProviderByKey } from "@/lib/services/integrations/provider-registry.service";
import { createOrganizationIntegration } from "@/lib/services/integrations/organization-integration.service";
import { connectorRegistry } from "@/lib/integrations/connectors/connector-registry";
import {
  findOrCreateConversation,
  getConversations,
  getConversationById,
  getMessages,
  saveInboundMessage,
  updateMessageDeliveryStatus,
} from "@/lib/services/messaging/messaging.service";
import {
  processInboundWebhook,
  verifyWebhookChallenge,
} from "@/lib/services/integrations/inbound-webhook.service";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";

async function runNeonLiveVerification() {
  console.log("=== VERIFYING MILESTONE 3.2A ON LIVE NEON POSTGRESQL ===");

  // 1. Verify schema tables exist on Neon
  console.log("1. Verifying schema tables exist on Neon...");
  await db.select().from(conversations).limit(1);
  console.log("✓ Table conversations exists and is queryable.");
  await db.select().from(messages).limit(1);
  console.log("✓ Table messages exists and is queryable.");

  // 2. Create isolated test user & organization
  const randomSuffix = crypto.randomUUID().slice(0, 8);
  const testUserId = crypto.randomUUID();

  await db.insert(users).values({
    id: testUserId,
    name: `Live Neon Test User ${randomSuffix}`,
    email: `neon-test-${randomSuffix}@example.com`,
  });

  const { organization: testOrg } = await createOrganization({
    name: `Live Neon M32A Org ${randomSuffix}`,
    slug: `neon-m32a-${randomSuffix}`,
    userId: testUserId,
  });
  console.log(`✓ Created test organization on Neon: ${testOrg.id}`);

  // 3. Register or resolve WhatsApp provider on live Neon
  let provider = await getProviderByKey("whatsapp");
  if (!provider) {
    provider = await registerProvider({
      key: "whatsapp",
      name: "WhatsApp Cloud API",
      category: "communication",
      authType: "api_key",
      capabilities: ["webhook_inbound", "api_write", "message_send", "outbound_api"],
      status: "active",
    });
  }
  console.log(`✓ WhatsApp provider active on Neon: ${provider.id} (${provider.key})`);

  // 4. Verify WhatsApp connector in registry
  const connector = connectorRegistry.get("whatsapp");
  if (!connector) {
    throw new Error("WhatsApp connector not found in connector registry.");
  }
  console.log(`✓ WhatsApp connector verified in registry: ${connector.name}`);

  // 5. Connect WhatsApp in test organization
  const testAppSecret = "neon_test_app_secret_123";
  const testVerifyToken = "neon_test_verify_token_456";
  const testPhoneNumberId = "100609346426456";
  const testAccessToken = "EAA_neon_test_access_token_789";

  const conn = await createOrganizationIntegration(
    testOrg.id,
    testUserId,
    {
      providerId: provider.id,
      name: "Live Test WhatsApp Integration",
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
    }
  );
  console.log(`✓ Created WhatsApp integration on Neon: ${conn.id}`);

  // 6. Test GET Webhook challenge verification on live Neon
  const challengeResult = await verifyWebhookChallenge(conn.id, {
    query: {
      "hub.mode": "subscribe",
      "hub.verify_token": testVerifyToken,
      "hub.challenge": "neon_challenge_999",
    },
  });
  if (!challengeResult.success || challengeResult.challenge !== "neon_challenge_999") {
    throw new Error(`Webhook challenge verification failed on Neon: ${challengeResult.reason}`);
  }
  console.log("✓ Webhook challenge verification succeeded on live Neon.");

  // 7. Test Contact matching in same tenant on live Neon
  const testContactId = crypto.randomUUID();
  await db.insert(contacts).values({
    id: testContactId,
    organizationId: testOrg.id,
    firstName: "Diana",
    lastName: "Prince",
    phone: "+1 631 555 4321",
  });

  const conv = await findOrCreateConversation(
    testOrg.id,
    conn.id,
    "whatsapp",
    "16315554321",
    { participantName: "Diana Prince" }
  );
  if (conv.contactId !== testContactId) {
    throw new Error(`Expected contactId to match ${testContactId}, got ${conv.contactId}`);
  }
  console.log(`✓ Conversation created with contact matching on Neon: ${conv.id}`);

  // 8. Test Inbound Message Webhook processing & persistence on live Neon
  const wamid = `wamid.neon_live_${crypto.randomUUID()}`;
  const inboundPayload = JSON.stringify({
    object: "whatsapp_business_account",
    entry: [
      {
        id: "WABA_NEON",
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
                  profile: { name: "Diana Prince" },
                  wa_id: "16315554321",
                },
              ],
              messages: [
                {
                  from: "16315554321",
                  id: wamid,
                  timestamp: Math.floor(Date.now() / 1000).toString(),
                  type: "text",
                  text: { body: "Live Neon message ingestion test" },
                },
              ],
            },
            field: "messages",
          },
        ],
      },
    ],
  });

  const hmacSig = crypto
    .createHmac("sha256", testAppSecret)
    .update(inboundPayload)
    .digest("hex");

  const procResult = await processInboundWebhook(conn.id, {
    rawBody: inboundPayload,
    headers: { "x-hub-signature-256": `sha256=${hmacSig}` },
  });

  if (!procResult.success || procResult.duplicate) {
    throw new Error("Failed to process live inbound webhook on Neon.");
  }
  console.log("✓ Inbound WhatsApp webhook processed and verified on live Neon.");

  // 9. Verify message persisted in Neon
  const msgs = await getMessages(testOrg.id, conv.id);
  const foundMsg = msgs.items.find((m) => m.externalMessageId === wamid);
  if (!foundMsg || foundMsg.body !== "Live Neon message ingestion test") {
    throw new Error("Persisted message not found or body mismatch on Neon.");
  }
  console.log(`✓ Message persisted and queryable in Neon: ${foundMsg.id} (status: ${foundMsg.status})`);

  // 10. Verify Idempotency on live Neon (retry of same message)
  const retryResult = await processInboundWebhook(conn.id, {
    rawBody: inboundPayload,
    headers: { "x-hub-signature-256": `sha256=${hmacSig}` },
  });
  if (!retryResult.success || !retryResult.duplicate) {
    throw new Error("Expected retry delivery to be recognized as duplicate on Neon.");
  }
  console.log("✓ Idempotency verified on Neon: retry acknowledged as duplicate without duplicate records.");

  // 11. Test delivery status update on live Neon
  const updatedStatus = await updateMessageDeliveryStatus({
    organizationId: testOrg.id,
    integrationId: conn.id,
    externalMessageId: wamid,
    status: "read",
    timestamp: new Date(),
  });
  if (!updatedStatus || updatedStatus.status !== "read" || !updatedStatus.readAt) {
    throw new Error("Failed to update message delivery status on Neon.");
  }
  console.log("✓ Message status updated to 'read' on live Neon.");

  // 12. Cleanup all verification test records from live Neon PostgreSQL
  console.log("12. Cleaning up verification test records from Neon...");
  await db.delete(messages).where(eq(messages.organizationId, testOrg.id));
  await db.delete(conversations).where(eq(conversations.organizationId, testOrg.id));
  await db.delete(contacts).where(eq(contacts.organizationId, testOrg.id));
  await db.delete(integrationCredentials).where(eq(integrationCredentials.organizationId, testOrg.id));
  await db.delete(organizationIntegrations).where(eq(organizationIntegrations.organizationId, testOrg.id));
  await db.delete(organizations).where(eq(organizations.id, testOrg.id));
  await db.delete(users).where(eq(users.id, testUserId));
  console.log("✓ Cleaned up all verification data from Neon PostgreSQL.");

  console.log("\n=======================================================");
  console.log("ALL LIVE NEON POSTGRESQL VERIFICATIONS PASSED FOR M3.2A!");
  console.log("=======================================================");
}

runNeonLiveVerification().catch((err) => {
  console.error("Neon verification failed:", err);
  process.exit(1);
});
