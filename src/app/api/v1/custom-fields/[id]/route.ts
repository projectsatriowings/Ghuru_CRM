import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/context/organization-context";
import {
  getCustomFieldById,
  updateCustomField,
  archiveCustomField,
} from "@/lib/services/custom-field.service";
import { updateCustomFieldSchema } from "@/lib/validations/custom-field";
import { apiSuccess, apiError } from "@/lib/api-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const ctx = await requirePermission("custom_fields.view");

    const field = await getCustomFieldById(ctx.organization.id, id);

    return apiSuccess(field);
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const ctx = await requirePermission("custom_fields.update");

    const body = await req.json();
    const validated = updateCustomFieldSchema.parse(body);

    const updated = await updateCustomField(ctx.organization.id, id, validated);

    return apiSuccess(updated);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const ctx = await requirePermission("custom_fields.delete");

    const archived = await archiveCustomField(ctx.organization.id, id);

    return apiSuccess({
      message: "Custom field archived successfully",
      field: archived,
    });
  } catch (error) {
    return apiError(error);
  }
}
