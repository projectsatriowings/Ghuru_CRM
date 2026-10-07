import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/context/organization-context";
import { toggleIntegrationStatus } from "@/lib/services/integrations/organization-integration.service";
import { apiSuccess, apiError } from "@/lib/api-response";

interface RouteProps {
  params: Promise<{ id: string }>;
}

export async function POST(_req: NextRequest, { params }: RouteProps) {
  try {
    const { id } = await params;
    const ctx = await requirePermission("integrations.update");

    const result = await toggleIntegrationStatus(ctx.organization.id, id, true);

    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}
