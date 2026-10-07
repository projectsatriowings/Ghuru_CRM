import { NextRequest } from "next/server";
import { requireOrganization } from "@/lib/context/organization-context";
import {
  getOrganizationAISettings,
  updateOrganizationAISettings,
} from "@/lib/services/ai/ai-quota.service";
import { updateAISettingsSchema } from "@/lib/validations/ai-governance";
import { apiSuccess, apiError } from "@/lib/api-response";
import { ForbiddenError, ValidationError } from "@/lib/errors";

export async function GET(req: NextRequest) {
  const correlationId =
    req.headers.get("x-request-id") ||
    req.headers.get("x-correlation-id") ||
    `req_${crypto.randomUUID()}`;

  try {
    const ctx = await requireOrganization();

    if (!ctx.hasPermission("ai_governance.view")) {
      throw new ForbiddenError(
        "Forbidden: You do not have permission [ai_governance.view] to view AI governance settings."
      );
    }

    const settings = await getOrganizationAISettings(ctx.organization.id);

    const res = apiSuccess(settings);
    res.headers.set("x-request-id", correlationId);
    return res;
  } catch (error) {
    const res = apiError(error);
    res.headers.set("x-request-id", correlationId);
    return res;
  }
}

export async function PATCH(req: NextRequest) {
  const correlationId =
    req.headers.get("x-request-id") ||
    req.headers.get("x-correlation-id") ||
    `req_${crypto.randomUUID()}`;

  try {
    const ctx = await requireOrganization();

    if (!ctx.hasPermission("ai_governance.manage")) {
      throw new ForbiddenError(
        "Forbidden: You do not have permission [ai_governance.manage] to modify AI governance settings."
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      throw new ValidationError("Invalid JSON body.");
    }

    const parsed = updateAISettingsSchema.safeParse(body);
    if (!parsed.success) {
      const { formatZodError } = await import("@/lib/validations/helpers");
      throw new ValidationError(formatZodError(parsed.error));
    }

    const updated = await updateOrganizationAISettings(
      ctx.organization.id,
      parsed.data
    );

    const res = apiSuccess(updated);
    res.headers.set("x-request-id", correlationId);
    return res;
  } catch (error) {
    const res = apiError(error);
    res.headers.set("x-request-id", correlationId);
    return res;
  }
}
