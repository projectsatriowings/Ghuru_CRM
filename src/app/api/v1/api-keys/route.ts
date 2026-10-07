import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/context/organization-context";
import {
  getOrganizationApiKeys,
  createApiKey,
} from "@/lib/services/integrations/api-key.service";
import {
  createApiKeySchema,
  apiKeyQuerySchema,
} from "@/lib/validations/integrations";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  try {
    const ctx = await requirePermission("api_keys.manage");

    const { searchParams } = new URL(req.url);
    const query = apiKeyQuerySchema.parse({
      includeRevoked: searchParams.get("includeRevoked") || undefined,
    });

    const keys = await getOrganizationApiKeys(ctx.organization.id, {
      includeRevoked: query.includeRevoked,
    });

    return apiSuccess(keys);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requirePermission("api_keys.manage");

    const body = await req.json();
    const validated = createApiKeySchema.parse(body);

    const result = await createApiKey(
      ctx.organization.id,
      ctx.user.id,
      validated
    );

    // Returns { key, secret } once so user can copy it
    return apiSuccess(result, 201);
  } catch (error) {
    return apiError(error);
  }
}
