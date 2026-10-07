import crypto from "crypto";
import { db } from "@/db";
import { DbClient } from "@/db/types";
import { integrationCredentials, CredentialType } from "@/db/schema/integrations";
import { eq, and } from "drizzle-orm";

const ENCRYPTION_ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96 bits for GCM

/**
 * Derives a consistent 32-byte master encryption key from environment secrets.
 */
function getMasterKey(): Buffer {
  const secret =
    process.env.INTEGRATION_ENCRYPTION_KEY ||
    process.env.BETTER_AUTH_SECRET ||
    "ghuru-crm-master-fallback-secret-key-32b";
  return crypto.createHash("sha256").update(secret).digest();
}

/**
 * Encrypts a plaintext string into a safe encrypted envelope string:
 * iv:authTag:ciphertext (hex encoded)
 */
export function encryptCredential(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(
    ENCRYPTION_ALGORITHM,
    getMasterKey(),
    iv
  );

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

/**
 * Decrypts an encrypted envelope string back into plaintext.
 */
export function decryptCredential(envelope: string): string {
  const parts = envelope.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid credential envelope format");
  }

  const [ivHex, authTagHex, encryptedHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");

  const decipher = crypto.createDecipheriv(
    ENCRYPTION_ALGORITHM,
    getMasterKey(),
    iv
  );
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedHex, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

/**
 * Creates a safe masked display representation of a secret value.
 * e.g. "whsec_****a1b2" or "sk_****9999"
 */
export function maskSecret(secret: string): string {
  if (!secret) return "";
  if (secret.length <= 8) {
    return "****" + secret.slice(-2);
  }
  const prefix = secret.slice(0, 4);
  const suffix = secret.slice(-4);
  return `${prefix}****${suffix}`;
}

/**
 * Stores or updates credentials for an organization integration.
 * The raw plaintext is encrypted before writing to database.
 */
export async function setIntegrationCredentials(
  organizationId: string,
  integrationId: string,
  credentialType: CredentialType,
  rawSecret: string,
  dbInstance: DbClient = db as DbClient
): Promise<{ id: string; maskedValue: string }> {
  const encryptedData = encryptCredential(rawSecret);
  const maskedValue = maskSecret(rawSecret);

  // Check if credentials record already exists
  const [existing] = await dbInstance
    .select({ id: integrationCredentials.id })
    .from(integrationCredentials)
    .where(
      and(
        eq(integrationCredentials.organizationId, organizationId),
        eq(integrationCredentials.integrationId, integrationId)
      )
    )
    .limit(1);

  if (existing) {
    await dbInstance
      .update(integrationCredentials)
      .set({
        credentialType,
        encryptedData,
        maskedValue,
        updatedAt: new Date(),
      })
      .where(eq(integrationCredentials.id, existing.id));

    return { id: existing.id, maskedValue };
  }

  const newId = crypto.randomUUID();
  await dbInstance.insert(integrationCredentials).values({
    id: newId,
    organizationId,
    integrationId,
    credentialType,
    encryptedData,
    maskedValue,
  });

  return { id: newId, maskedValue };
}

/**
 * Internal-only server-side function to decrypt credentials for provider execution.
 * NEVER exposed via API responses or client-facing code.
 */
export async function getDecryptedCredentials(
  organizationId: string,
  integrationId: string,
  dbInstance: DbClient = db as DbClient
): Promise<string | null> {
  const [cred] = await dbInstance
    .select({
      encryptedData: integrationCredentials.encryptedData,
    })
    .from(integrationCredentials)
    .where(
      and(
        eq(integrationCredentials.organizationId, organizationId),
        eq(integrationCredentials.integrationId, integrationId)
      )
    )
    .limit(1);

  if (!cred) return null;
  return decryptCredential(cred.encryptedData);
}

/**
 * Deletes credentials for an integration upon disconnection.
 */
export async function deleteIntegrationCredentials(
  organizationId: string,
  integrationId: string,
  dbInstance: DbClient = db as DbClient
): Promise<void> {
  await dbInstance
    .delete(integrationCredentials)
    .where(
      and(
        eq(integrationCredentials.organizationId, organizationId),
        eq(integrationCredentials.integrationId, integrationId)
      )
    );
}
