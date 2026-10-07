import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/context/organization-context";
import { testWebhookPing } from "@/lib/services/integrations/integration-event.service";
import { apiSuccess, apiError } from "@/lib/api-response";

interface RouteProps {
  params: Promise<{ id: string }>;
}

export async function POST(_req: NextRequest, { params }: RouteProps) {
  try {
    const { id } = await params;
    const ctx = await requirePermission("webhooks.manage");

    const result = await testWebhookPing(ctx.organization.id, id);

    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}
