import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db";
import * as schema from "@/db/schema";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
    },
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  secret:
    process.env.BETTER_AUTH_SECRET ||
    "development-secret-ghuru-crm-key-min-32-chars-long",
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
});

export type Auth = typeof auth;
