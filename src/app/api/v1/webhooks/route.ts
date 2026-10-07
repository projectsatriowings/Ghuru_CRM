import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/context/organization-context";
import {
  getWebhooks,
  createWebhook,
} from "@/lib/services/integrations/webhook.service";
import {
  createWebhookSchema,
  webhookQuerySchema,
} from "@/lib/validations/integrations";
import { apiSuccess, apiPaginatedSuccess, apiError } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  try {
    const ctx = await requirePermission("integrations.view");

    const { searchParams } = new URL(req.url);
    const query = webhookQuerySchema.parse({
      active: searchParams.get("active") || undefined,
      page: searchParams.get("page") || 1,
      pageSize: searchParams.get("pageSize") || 20,
    });

    const result = await getWebhooks(ctx.organization.id, query);
    const totalPages = Math.ceil(result.total / query.pageSize) || 1;

    return apiPaginatedSuccess(result.items, {
      page: query.page,
      pageSize: query.pageSize,
      total: result.total,
      totalPages,
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requirePermission("webhooks.manage");

    const body = await req.json();
    const validated = createWebhookSchema.parse(body);

    const webhook = await createWebhook(
      ctx.organization.id,
      ctx.user.id,
      validated
    );

    return apiSuccess(webhook, 201);
  } catch (error) {
    return apiError(error);
  }
}
