import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/context/organization-context";
import {
  getWebhookById,
  updateWebhook,
  deleteWebhook,
} from "@/lib/services/integrations/webhook.service";
import { updateWebhookSchema } from "@/lib/validations/integrations";
import { apiSuccess, apiError } from "@/lib/api-response";

interface RouteProps {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: RouteProps) {
  try {
    const { id } = await params;
    const ctx = await requirePermission("integrations.view");

    const webhook = await getWebhookById(ctx.organization.id, id);

    return apiSuccess(webhook);
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(req: NextRequest, { params }: RouteProps) {
  try {
    const { id } = await params;
    const ctx = await requirePermission("webhooks.manage");

    const body = await req.json();
    const validated = updateWebhookSchema.parse(body);

    const updated = await updateWebhook(ctx.organization.id, id, validated);

    return apiSuccess(updated);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteProps) {
  try {
    const { id } = await params;
    const ctx = await requirePermission("webhooks.manage");

    await deleteWebhook(ctx.organization.id, id);

    return apiSuccess({ deleted: true, id });
  } catch (error) {
    return apiError(error);
  }
}
