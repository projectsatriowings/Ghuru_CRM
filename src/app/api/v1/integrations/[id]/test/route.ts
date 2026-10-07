import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/context/organization-context";
import { testIntegrationConnection } from "@/lib/services/integrations/organization-integration.service";
import { apiSuccess, apiError } from "@/lib/api-response";

interface RouteProps {
  params: Promise<{ id: string }>;
}

export async function POST(_req: NextRequest, { params }: RouteProps) {
  try {
    const { id } = await params;
    const ctx = await requirePermission("integrations.test");

    const result = await testIntegrationConnection(ctx.organization.id, id);

    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}
