import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/context/organization-context";
import {
  getDealById,
  updateDeal,
  archiveDeal,
} from "@/lib/services/deal.service";
import { updateDealSchema } from "@/lib/validations/deal";
import { apiSuccess, apiError } from "@/lib/api-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const ctx = await requirePermission("deals.view");

    const deal = await getDealById(ctx.organization.id, id);

    return apiSuccess(deal);
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const ctx = await requirePermission("deals.update");

    const body = await req.json();
    const validated = updateDealSchema.parse(body);

    const updated = await updateDeal(
      ctx.organization.id,
      id,
      validated,
      undefined,
      ctx.user.id
    );

    return apiSuccess(updated);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const ctx = await requirePermission("deals.delete");

    const archived = await archiveDeal(
      ctx.organization.id,
      id,
      undefined,
      ctx.user.id
    );

    return apiSuccess({
      message: "Deal archived successfully",
      deal: archived,
    });
  } catch (error) {
    return apiError(error);
  }
}
