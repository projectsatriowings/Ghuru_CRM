import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/context/organization-context";
import {
  getApiKeyById,
  revokeApiKey,
} from "@/lib/services/integrations/api-key.service";
import { apiSuccess, apiError } from "@/lib/api-response";

interface RouteProps {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: RouteProps) {
  try {
    const { id } = await params;
    const ctx = await requirePermission("api_keys.manage");

    const key = await getApiKeyById(ctx.organization.id, id);

    return apiSuccess(key);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteProps) {
  try {
    const { id } = await params;
    const ctx = await requirePermission("api_keys.manage");

    const revoked = await revokeApiKey(ctx.organization.id, id);

    return apiSuccess(revoked);
  } catch (error) {
    return apiError(error);
  }
}
