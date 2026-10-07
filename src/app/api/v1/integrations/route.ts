import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/context/organization-context";
import {
  getOrganizationIntegrations,
  createOrganizationIntegration,
} from "@/lib/services/integrations/organization-integration.service";
import { createOrganizationIntegrationSchema } from "@/lib/validations/integrations";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function GET() {
  try {
    const ctx = await requirePermission("integrations.view");

    const integrations = await getOrganizationIntegrations(ctx.organization.id);

    return apiSuccess(integrations);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requirePermission("integrations.connect");

    const body = await req.json();
    const validated = createOrganizationIntegrationSchema.parse(body);

    const integration = await createOrganizationIntegration(
      ctx.organization.id,
      ctx.user.id,
      validated
    );

    return apiSuccess(integration, 201);
  } catch (error) {
    return apiError(error);
  }
}
