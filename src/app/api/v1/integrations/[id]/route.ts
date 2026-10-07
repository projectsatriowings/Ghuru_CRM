import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/context/organization-context";
import {
  getOrganizationIntegrationById,
  updateOrganizationIntegration,
  disconnectOrganizationIntegration,
} from "@/lib/services/integrations/organization-integration.service";
import { updateOrganizationIntegrationSchema } from "@/lib/validations/integrations";
import { apiSuccess, apiError } from "@/lib/api-response";

interface RouteProps {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: RouteProps) {
  try {
    const { id } = await params;
    const ctx = await requirePermission("integrations.view");

    const integration = await getOrganizationIntegrationById(
      ctx.organization.id,
      id
    );

    return apiSuccess(integration);
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(req: NextRequest, { params }: RouteProps) {
  try {
    const { id } = await params;
    const ctx = await requirePermission("integrations.update");

    const body = await req.json();
    const validated = updateOrganizationIntegrationSchema.parse(body);

    const updated = await updateOrganizationIntegration(
      ctx.organization.id,
      id,
      validated
    );

    return apiSuccess(updated);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteProps) {
  try {
    const { id } = await params;
    const ctx = await requirePermission("integrations.disconnect");

    const disconnected = await disconnectOrganizationIntegration(
      ctx.organization.id,
      id
    );

    return apiSuccess(disconnected);
  } catch (error) {
    return apiError(error);
  }
}
