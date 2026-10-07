import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/context/organization-context";
import { getWebhookDeliveries } from "@/lib/services/integrations/webhook.service";
import { apiSuccess, apiError } from "@/lib/api-response";

interface RouteProps {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteProps) {
  try {
    const { id } = await params;
    const ctx = await requirePermission("webhooks.manage");

    const { searchParams } = new URL(req.url);
    const limit = Number(searchParams.get("limit") || 50);

    const deliveries = await getWebhookDeliveries(
      ctx.organization.id,
      id,
      limit
    );

    return apiSuccess(deliveries);
  } catch (error) {
    return apiError(error);
  }
}
